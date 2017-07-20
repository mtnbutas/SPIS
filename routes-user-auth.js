const express = require('express');
const router = new express.Router();
const bcrypt = require('bcrypt');
const User_Account = require('./models').User_Account;
const SPIS_Instance = require('./models').SPIS_Instance;
const Doctor = require('./models').Doctor;
const Secretary = require('./models').Secretary;
const Admin = require('./models').Admin;
const Superuser = require('./models').Superuser;

///////////////////// MIDDLEWARES ////////////////////////

function requireLoggedIn(req, res, next) {
	const currentInstance = req.session.spisinstance;
	const currentUser = req.session.user;
	if(!currentUser || !currentInstance) {
		return res.redirect('/login');
	}
	next();
}

/////////////////////// GET //////////////////////////

router.get('/login', 
	function (req, res, next) {
		const currentUser = req.session.user;
		const spisInstance = req.session.spisinstance;
		if(currentUser && spisInstance) {
			return res.redirect('/');
		}
		next();
	},
	function (req, res) {
		var instances;

		instances = SPIS_Instance.findAll({ where: {status: 'Active'}, attributes: ['description', 'license_no'], raw: true })
		.then(function (hospArr) {
			instances = hospArr;
			console.log(instances);

			Superuser.findAll({
				raw: true,
				where: {
					id: "sayunsuperuser",
				}
			}).then(function(result){
				var superuser = {
					contact_number: result[0].contact_number,
					email: result[0].email,
				}

				res.render('account/login.html', {
					instances : instances,
					superuser: superuser,
				});
			});
		});
	}
);

router.get('/logout', function (req, res) {
	req.session.user = null;
	req.session.admin = null;
	req.session.doctor = null;
	req.session.secretary = null;
	req.session.superuser = null;
	res.redirect('/login');
});

router.get('/check_username/:name', requireLoggedIn, function (req, res) {
	var key = req.params.name;
	console.log(key);
	User_Account.findOne({
		where: {
			id: key,
		},
		raw: true
	}).then(function (result) {
		if (!result) {
			res.json({exists: false});
		}
		else {
			res.json({exists: true, result: result});
		}
	});
});

router.get('/check_password/:id/:old_password', requireLoggedIn, 
	function (req, res, next) {
		if (req.session.user.id != req.params.id) {
			return res.redirect('/');
		}
		next();
	}, function (req, res) {
		console.log(req.params);
		var id = req.params.id;
		User_Account.findOne({ where: {
			id: id
		}}).then(user_instance => {
			if(user_instance != null) {
				if(bcrypt.compareSync(req.params.old_password, user_instance.dataValues.password_hash)) {
					res.json({match: true});
				} else {
					res.json({match: false});
				}
			} else {
				return res.redirect('/');
			}
		});
	}
);

/////////////////////// POST //////////////////////////

router.post('/reset_password/:id', requireLoggedIn, 
	function (req, res, next) {
		if (!req.session.superuser && req.session.user.id != req.params.id) {
			return res.redirect('/');
		}
		next();
	}, function (req, res) {
		User_Account.update({
			password_hash: req.body.new_password
		}, { where: {
			id: req.params.id
		}}).then(user_updated => {
			req.flash('statusMessage', "Password updated successfully.");
			res.redirect('/account_edit/' + req.params.id);
		});
	}
);

router.post('/login', function (req, res) {
	console.log(req.body);
	var username = req.body.username;
	var password = req.body.password;
	var spis_instance = req.body.spis_instance;

	SPIS_Instance.findOne({where : {
		license_no: spis_instance
	}}).then(spisinstance => {
		if(!spisinstance) {
			req.flash('statusMessage', "Please select SPIS Instance");
			req.flash('username', username);
			return res.redirect('/login');
		}
		Superuser.findOne({where: {
			id: username
		}}).then(superuserInstance => {
			if(superuserInstance && bcrypt.compareSync(password, superuserInstance.dataValues.password)) {
				req.session.user = superuserInstance.dataValues;
				req.session.superuser = true;
				req.session.spisinstance = spisinstance.dataValues;
				req.session.admin = null;
				req.session.doctor = null;
				req.session.secretary = null;
				console.log(req.session);
				return res.redirect('/');
			} else {
				req.session.superuser = null
				User_Account.findOne({where: {
					id: username, spisInstanceLicenseNo: spis_instance, active: true
				}}).then (single_user => {
					if(!single_user) {
						req.flash('statusMessage', 'Wrong username and/or password.');
						req.flash('username', username);
						return res.redirect('/login');
					}
					else {
						if(bcrypt.compareSync(password, single_user.dataValues.password_hash)) {
							req.session.user = single_user.dataValues;
							Doctor.findOne({where: {
								usernameId: single_user.dataValues.id
							}}).then(doctorInstance => {
								if(doctorInstance) {
									req.session.doctor = doctorInstance.dataValues;
									req.session.secretary = null;
									Admin.findOne({where: {
										usernameId: single_user.dataValues.id
									}}).then(adminInstance => {
										req.session.admin = false;
										if(adminInstance) {
											req.session.admin = true;
										}
										req.session.spisinstance = spisinstance.dataValues;
										req.session.lab_results_attachment = [];
										req.session.inpatient_attachment = [];
										req.session.outpatient_attachment = [];
										console.log(req.session);
										return res.redirect('/');
									});
								} else {
									Secretary.findOne({where: {
										usernameId: single_user.dataValues.id
									}}).then(secretaryInstance => {
										if(secretaryInstance) {
											req.session.doctor = null;
											req.session.secretary = secretaryInstance.dataValues;
											Admin.findOne({where: {
												usernameId: single_user.dataValues.id
											}}).then(adminInstance => {
												req.session.admin = false;
												if(adminInstance) {
													req.session.admin = true;
												}
												req.session.spisinstance = spisinstance.dataValues;
												console.log(req.session);
												return res.redirect('/');
											});
										} else {
											req.flash('statusMessage', "Error for unknown reason, please refresh page.");
											req.flash('username', username);
											return res.redirect('/login');
										}
									});
								}
							});
							
						} else {
							req.flash('statusMessage', "Wrong username and/or password");
							req.flash('username', username);
							return res.redirect('/');
						}
					};
				});
			}
		});
	});
});


// router.get('/check_license_num/:license_num', requireSuperUser, function(req, res){
// 	var key = req.params.license_num;
// 	console.log(key);
// 	Doctor.findOne({
// 		where: {
// 			license_no: key,
// 		},
// 		raw: true
// 	}).then(function(result){
// 		User_Account.findOne
// 		if (!result) {
// 			res.json({exists: false});
// 		}
// 		else {
// 			res.json({exists: true});
// 		}
// 	});
// });

// router.get('/check_ptr_num/:ptr_num', requireSuperUser, function(req, res){
// 	var key = req.params.ptr_num;
// 	console.log(key);
// 	Doctor.findOne({
// 		where: {
// 			ptr_no: key,
// 		},
// 		raw: true
// 	}).then(function(result){
// 		if (!result) {
// 			res.json({exists: false});
// 		}
// 		else {
// 			res.json({exists: true});
// 		}
// 	});
// });

// router.get('/check_s2_license_num/:s2_num', requireSuperUser, function(req, res){
// 	var key = req.params.s2_num;
// 	console.log(key);
// 	Doctor.findOne({
// 		where: {
// 			s2_license_no: key,
// 		},
// 		raw: true
// 	}).then(function(result){
// 		if (!result) {
// 			res.json({exists: false});
// 		}
// 		else {
// 			res.json({exists: true});
// 		}
// 	});
// });

module.exports = router;