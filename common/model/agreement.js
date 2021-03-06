import DB from '../db/db'
import { Addendum } from './addendum'
import { Identity, IdentityType } from './identity'

const agreementCollection = 'agreements'

/**
 * Returns a string that uniquely identifies the given identity in a whitelist.
 * @param identity {Identity}
 * @returns {string}
 */
function identityKey (identity) {
  return `${identity.type}:${identity.value}`
}

/**
 * Types of agreements.
 * @type {{INSTITUTIONAL: string, INDIVIDUAL: string}}
 */
const agreementType = {
  /**
   * Individual CLA.
   */
  INDIVIDUAL: 'individual',
  /**
   * Institutional CLA.
   */
  INSTITUTIONAL: 'institutional'
}

/**
 * Agreement model class.
 */
class agreement {
  /**
   * Creates a new agreement.
   * @param {agreementType} type type of agreement
   * @param {string} body the agreement text body
   * @param {Identity} signer the signer of the agreement
   * @param {string|null} organization organization covered by this agreement
   * @param {string|null} organizationAddress organization address
   */
  constructor (type, body, signer, organization = null, organizationAddress = null) {
    this._id = null
    this._dateSigned = new Date()
    this._type = type
    this._body = body
    this._signer = signer

    // Optional arguments default to null
    if (type === AgreementType.INSTITUTIONAL && organization == null) {
      throw TypeError(`Agreement.type is ${type} and organization is missing`)
    }
    this._organization = organization

    if (type === AgreementType.INSTITUTIONAL && organizationAddress == null) {
      throw TypeError(`Agreement.type is ${type} and organizationAddress is missing`)
    }
    this._organizationAddress = organizationAddress
  }

  /**
   * Returns the agreement ID.
   * @returns {string}
   */
  get id () {
    return this._id
  }

  /**
   * Returns the agreement type.
   * @returns {AgreementType}
   */
  get type () {
    return this._type
  }

  /**
   * Returns the organization.
   * @returns {string}
   */
  get organization () {
    return this._organization
  }

  /**
   * Returns the organization address.
   * @returns {string}
   */
  get organizationAddress () {
    return this._organizationAddress
  }

  /**
   * Returns the body.
   * @returns {string}
   */
  get body () {
    return this._body
  }

  /**
   * Returns the signer.
   * @returns {Identity}
   */
  get signer () {
    return this._signer
  }

  /**
   * Returns the signing date.
   * @returns {Date}
   */
  get dateSigned () {
    return this._dateSigned
  }

  /**
   * Returns the model in JSON compatible format.
   * @returns {Object}
   */
  toJson () {
    const json = {
      dateSigned: this._dateSigned,
      type: this._type,
      body: this._body,
      signer: this._signer.toJson()
    }
    if (this._type === AgreementType.INSTITUTIONAL) {
      json.organization = this._organization
      json.organizationAddress = this._organizationAddress
    }
    return json
  }

  /**
   * Saves the agreement into Firestore and returns the saved instance with
   * non-null id.
   * @returns {Promise<Agreement>}
   */
  save () {
    return DB.connection().collection(agreementCollection)
      .add(this.toJson())
      .then(res => {
        this._id = res.id
        return this
      })
  }

  /**
   * Returns a list of Addendum associated with this list
   * @returns {Promise<Addendum[]>}
   */
  getAddendums () {
    return Addendum.get(this)
  }

  /**
   * Returns all identities that are allowed to contribute under this
   * agreement. The implementation emulates the logic used by the Firebase
   * function to update the whitelist collection in the DB.
   * @returns {Promise<Identity[]>}
   */
  getWhitelist () {
    return this.getAddendums().then(addendums => {
      const whitelistMap = addendums.reduce((map, addendum) => {
        addendum.added.forEach(i => map.set(identityKey(i), i))
        addendum.removed.forEach(i => map.delete(identityKey(i)))
        return map
      }, new Map())
      return Array.from(whitelistMap.values())
    })
  }

  /**
   * Converts from firestore format to Agreement
   * @returns {Agreement}
   */
  static fromDocumentSnapshot (doc) {
    const data = doc.data()
    const signer = Identity.fromJson(data.signer)
    // TODO: create new signer class that extends Identity and provides
    //  additional attributes such as title and phone numbe
    // For now augment instance with missing keys so we can show them in the UI.
    signer.title = data.signer.title
    signer.phoneNumber = data.signer.phoneNumber
    let a
    if (data.type === AgreementType.INDIVIDUAL) {
      a = new Agreement(data.type, data.body, signer)
    } else if (data.type === AgreementType.INSTITUTIONAL) {
      a = new Agreement(data.type, data.body, signer, data.organization, data.organizationAddress)
    }
    a._id = doc.id
    return a
  }

  static subscribe (email, successCb, errorCb) {
    return DB.connection().collection(agreementCollection)
      .where('signer.type', '==', IdentityType.EMAIL)
      .where('signer.value', '==', email)
      .onSnapshot(successCb, errorCb)
  }

  /**
   * Gets an agreement from firestore
   * @returns {Promise<Agreement>}
   */
  static get (agreementId) {
    return DB.connection().collection(agreementCollection)
      .doc(agreementId)
      .get()
      .then(Agreement.fromDocumentSnapshot)
  }
}

export const Agreement = agreement
export const AgreementType = agreementType
