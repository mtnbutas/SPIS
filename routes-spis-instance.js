const express = require('express');
const router = new express.Router();
const bcrypt = require('bcrypt');
const SPIS_Instance = require('./models').SPIS_Instance;
const Superuser = require('./models').Superuser;

///////////////////// MIDDLEWARES ////////////////////////

function requireSuperUser(req, res, next) {
	const currentUser = req.session.user;
	const superu = req.session.superuser;
	if(!currentUser || !superu) {
		return res.redirect('/login');
	}
	next();
}

function logOut(req, res, next) {
	req.session.user = null;
	req.session.admin = null;
	req.session.doctor = null;
	req.session.secretary = null;
	req.session.superuser = null;
	next();
}

/////////////////////// GET //////////////////////////

router.get('/adminlicense', logOut, function (req, res) {
	res.render('spis_instance/su-login.html');
});

router.get('/spis_list', requireSuperUser, function (req, res){
	SPIS_Instance.findAll({
		raw: true,
		order: [
			['license_no', 'DESC']
		]
	}).then(function (results) {
		
		res.render('spis_instance/list-SPIS.html', {
			instances: results,
			user: req.session.user
		});
	});
});

router.get('/spis_edit/:id', requireSuperUser, function (req, res) {
	var key = req.params.id;

	SPIS_Instance.findOne({
		where: {
			license_no: key
		},
		raw: true
	}).then(function (result) {
		res.json(result);
	});
});

/////////////////////// POST //////////////////////////

router.post('/adminlicense', function (req, res) {
	var username = req.body.username;
	var password = req.body.password;

	Superuser.findOne({where: {
		id: username,
	}}).then(superuserInstance => {
		if(!superuserInstance) {
			req.flash('statusMessage', "Wrong username and/or password");
			req.flash('username', username);
			return res.redirect('/adminlicense');
		}
		if(bcrypt.compareSync(password, superuserInstance.dataValues.password)) {
			req.session.user = superuserInstance.dataValues;
			req.session.superuser = true;
			req.session.doctor = false;
			req.session.admin = false;
			req.session.secretary = false;
			res.redirect('/spis_list');
		} else {
			req.flash('statusMessage', "Wrong username and/or password");
			req.flash('username', username);
			return res.redirect('/adminlicense');
		}
	});
});

router.post('/instance_add', requireSuperUser, function (req, res) {
	var description = req.body.description.trim();

	SPIS_Instance.create({
		description: description
	}).then(function (result) {
		res.json({"status": "success"});
	}).catch(function (result) {
		res.json({"status" : "error", "name": req.body.id.trim()});
	});
});

router.post('/instance_edit', requireSuperUser, function (req, res) {
	var description = req.body.description.trim();
	var status = req.body.status;
	var key = req.body.id;

	SPIS_Instance.update({
		description: description,
		status: status,
	},
	{ where: {
			license_no: key,
	}}).then(function (result) {
		res.json({"status": "success"});
	}).catch(function (result) {
		res.json({"status" : "error", "name": req.body.id.trim()});
	});
});

module.exports = router;