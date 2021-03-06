
import React from 'react'
import { FirebaseApp } from '../common/app/app'

import { BrowserRouter as Router, Route } from 'react-router-dom'

import Header from './helpers/Header'
import Home from './Home'
import { Container } from '@material-ui/core'
import AgreementContainer from './agreement/AgreementContainer'
import SignCheck from './helpers/SignCheck'

class AppRouter extends React.Component {
  constructor (props) {
    super(props)
    this.signOut = this.handleSignOut.bind(this)
  }

  /**
     * Handles the sign out button press.
     */
  handleSignOut () {
    FirebaseApp.auth().signOut().catch((error) => {
      this.handleAuthError(error)
    })
  }

  /**
     * Handles Errors from various Promises.
     */
  handleAuthError (error) {
    // Display Error.
    alert('Error: ' + error.message)
    console.log(error)
    // Re-enable the sign-in button.
    this.setState({ loginAttemptInProgress: false })
  }

  render () {
    const user = this.props.user
    return (
      <Router>
        <div>
          <Header
            user={user}
            onSignOut={this.signOut}
          />
          <Container>
            <Route
              path='/' exact render={() => (
                <Home user={user} />
              )}
            />
            <Route
              path='/sign/:type' render={props => (
                <SignCheck agreementType={props.match.params.type} user={user} />
              )}
            />
            <Route
              path='/view/:id' render={props => (
                <AgreementContainer user={user} agreementId={props.match.params.id} />
              )}
            />
          </Container>
        </div>
      </Router>
    )
  }
}

export default AppRouter
