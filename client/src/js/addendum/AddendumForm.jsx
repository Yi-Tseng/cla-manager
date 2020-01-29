import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { ValidatorForm, TextValidator} from 'react-material-ui-form-validator';
import { Box, Button, Grid } from '@material-ui/core';
import { Addendum, AddendumType } from '../../common/model/addendum';
/**
 * Component which given an Addendum id displays it,
 * or display a form to create a new one
 */

function AddendumForm(props) {

	const [added, setAdded] = useState('');
	const [removed, setRemoved] = useState('');

	if (props.addendum) {
		return (
			<Grid container spacing={2}>
				<Grid item xs={12} sm={5}>
					{props.addendum.added.join(', ')}
				</Grid>
				<Grid item xs={12} sm={5}>
					{props.addendum.removed.join(', ')}
				</Grid>
				
			</Grid>
		)
	}

	const signer = {
		"name": "name",
		"email": props.user.email,
	  }

	const handleSubmit = (evt) => {
		evt.preventDefault();

		const addendum = new Addendum(
			null,
			AddendumType.CONTRIBUTOR,
			props.agreementId,
			signer,
			added.split(","),
			removed.split(","),
		)

		addendum.save().then(res => {
			props.callback(res)
			setAdded('')
			setRemoved('')
		})
		.catch(console.error)
	}

	return(
		<ValidatorForm onSubmit={handleSubmit}>
			<Grid container spacing={2}>
				<Grid item xs={12} sm={5}>
					<TextValidator
						fullWidth
						label="Add identities"
						name="added"
						value={added}
						onChange={e => setAdded(e.target.value)}
						validators={['required']}
						errorMessages={['Enter a comma separated list of users']}
						variant="outlined"
					/>
				</Grid>
				<Grid item xs={12} sm={5}>
					<TextValidator
						fullWidth
						label="Remove identities"
						name="removed"
						value={removed}
						onChange={e => setRemoved(e.target.value)}
						validators={['required']}
						errorMessages={['Enter a comma separated list of users']}
						variant="outlined"
					/>
				</Grid>
				<Grid item xs={12} sm={2}>
					<Box textAlign="right" m={1}>
						<Button type="submit"
						variant="contained"
						color="primary"
						size="large"
						>Add</Button>
					</Box>
				</Grid>
			</Grid>
		</ValidatorForm>
	)
}

AddendumForm.propTypes = {
	user: PropTypes.object.isRequired,
	agreementId: PropTypes.string.isRequired,
	addendum: PropTypes.object,
	callback: PropTypes.func,
};

export default AddendumForm