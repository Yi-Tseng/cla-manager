const admin = require('firebase-admin')
const functions = require('firebase-functions')
const Github = require('./lib/github')
const Gerrit = require('./lib/gerrit')
const Cla = require('./lib/cla')
const Backup = require('./lib/backup.js')
const _ = require('lodash')

admin.initializeApp(functions.config().firebase)
const db = admin.firestore()

const clalib = new Cla(db)
const github = new Github(
  functions.config().github.app_id,
  functions.config().github.key,
  functions.config().github.secret,
  db)
const gerrit = new Gerrit(db)

const backup = new Backup(
  functions.config().backup.bucket_name,
  functions.config().backup.period
)

/**
 * Handles the given event snapshot. The implementation is expected to update
 * the status of the contribution (e.g., PR) on the provider (e.g. Github), and
 * wait for an ack. Event documents should be updated in the DB with an
 * indication if the ack was successful or if any error occurred.
 * @param eventSnapshot
 * @returns {Promise}
 */
const processEvent = async (eventSnapshot) => {
  const event = eventSnapshot.data()
  if (!('provider' in event)) {
    return Promise.reject(new Error('missing provider key in request'))
  }
  if (event.provider === 'github') {
    return github.processEvent(eventSnapshot)
  } else {
    return Promise.reject(new Error(`unknown request type ${event.type}`))
  }
}

/**
 * When a new addendum is created, update the whitelists collection with the
 * list of allowed identities for the parent agreement.
 */
exports.updateWhitelist = functions.firestore
  .document('/addendums/{id}')
  .onCreate(clalib.updateWhitelist)

/**
 * Periodically re-generates all whitelists in case of one-off errors with
 * snapshot-based updateWhitelist.
 */
exports.reconcileWhitelist = functions.pubsub
  .schedule('every 15 minutes')
  .onRun(() => {
    return db.collection('agreements').get()
      .then(query => {
        return Promise.all(query.docs
          .map(doc => clalib.updateWhitelist(null, doc.id)))
      })
      .then(result => {
        console.info(`Successfully updated ${result.length} whitelists`)
      })
      .catch(console.error)
  })

/**
 * Handles GitHub pull requests and other events. For pull requests, the
 * implementation is expected to create a new request document in the DB, which
 * will be picked up by the below function.
 */
exports.githubWebook = functions.https.onRequest(github.handler)

/**
 * When a new CLA validation event is created, e.g. by the GitHub webhook,
 * process it.
 */
exports.handleEvent = functions.firestore
  .document('/events/{id}')
  .onCreate(processEvent)

// TODO: implement cronjob function to periodically clean up acknowledged and
//  outdated events.

/**
 * Handles calls from the Gerrit hook.
 * @type {HttpsFunction}
 */
exports.gerritEndpoint = functions.https.onRequest(gerrit.app)

/**
 * When a whitelist is updated, check for events in state failure that match the
 * added identities and re-process them.
 */
exports.handleWhitelistUpdate = functions.firestore
  .document('/whitelists/{id}')
  .onWrite(snapshot => {
    const oldWhitelist = snapshot.before.data()
    const newWhitelist = snapshot.after.data()
    if (!newWhitelist) {
      return Promise.resolve()
    }
    let addedIdentities
    if (!oldWhitelist) {
      addedIdentities = newWhitelist.values
    } else {
      addedIdentities = _.difference(newWhitelist.values, oldWhitelist.values)
    }
    // Find all events with identity the added one and state 'failure'.
    // Firestore limits query operator 'in' to maximum 10 logical OR operations.
    // As such, we split identities in many arrays, each one with max
    // length 10.
    return Promise.all(_.chunk(addedIdentities, 10)
      .map(identitiesChunk => {
        return db.collection('events')
          .where('status.state', '==', 'failure')
          .where('identity', 'in', identitiesChunk)
          .get().then(query => {
            return Promise.all(query.docs.map(processEvent))
          })
      })).catch(console.error)
  })

/**
 * Periodically backups firestore DB.
 */
exports.scheduledFirestoreExport = backup
