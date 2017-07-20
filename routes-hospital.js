const express = require('express');
const router = new express.Router();
const Hospital = require('./models').Hospital;
const Check_Up = require('./models').Check_Up;
const Laboratory = require('./models').Laboratory;

///////////////////// MIDDLEWARES ////////////////////////

function requireLoggedIn(req, res, next) {
	const currentInstance = req.session.spisinstance;
	const currentUser = req.session.user;
	if(!currentUser || !currentInstance) {
		return res.redirect('/login');
	}
	next();
}

function requireSuperUser(req, res, next) {
	const currentUser = req.session.user;
	const superu = req.session.superuser;
	if(!currentUser || !superu) {
		return res.redirect('/login');
	}
	next();
}

function requireSuperAdmin(req, res, next) {
	const admin = req.session.admin;
	const superu = req.session.superuser;
	if(!(admin || superu)) {
		return res.redirect('/login');
	}
	next();
}

function requireAdmin(req, res, next) {
	const admin = req.session.admin;
	if(!admin) {
		return res.redirect('/login');
	}
	next();
}

/////////////////////// GET //////////////////////////

router.get('/hcl_add', requireLoggedIn, requireAdmin, function (req, res) {
	res.render('account/add-hcl.html');
});

router.get('/hcl_edit/:name', requireLoggedIn, requireAdmin, function (req, res) {
	var key = req.params.name;
	var hospital;

	Hospital.findOne({
		where: {
			name: key,
		},
		raw: true
	}).then(function(result){

		if(result){
			hospital = result;
			res.json(hospital);
		} else{
			res.send({
				message: "The record doesn't exist."
			});
		}

		
	});
});

router.get('/hcl_list', requireLoggedIn, requireAdmin, function (req, res) {
	var allHCL = [];
	Hospital.findAll({	
		raw: true,
		where: {
			spisInstanceLicenseNo: req.session.spisinstance.license_no
		},
		order: [
			['createdAt', 'DESC'],
		],
		}).then(function (results) {
			for(var i = 0; i < results.length; i++) {
				var result = results[i];
				allHCL.push({
					name: result.name,
					address: result.address,
					type: result.type,
					contact_num: result.contact_numbers,
					active: result.active,
				});
			}
			res.render('hospital/list-hospital.html', {
				hcls : allHCL,
				admin : req.session.admin,
				superuser : req.session.superuser
			});
	});
});

/////////////////////// POST //////////////////////////

router.post('/hcl_add', requireLoggedIn, requireAdmin, function (req, res) {
	console.log("ADDING HCL");
	console.log(req.body);

	var name = req.body.name;
	var address = req.body.address;
	var type = req.body.type;
	var contact_count = req.body.count;
	var contact_num = [];

	for(var i = 1; i <= contact_count; i++) {
		if( req.body['field' + i] != undefined && req.body['field' + i].trim() != '') {
			contact_num.push( req.body['field' + i] );
		}	
	}
	Hospital.create({
		name: name,
		address: address,
		type: type,
		contact_numbers: contact_num,
		spisInstanceLicenseNo: req.session.spisinstance.license_no
	}).then(function (item) {
		res.redirect("/hcl_list");
	}).catch(function (error) {
		res.json({"status" : "error", "name": req.body.name.trim()});
	});
});

router.post('/hcl_edit', requireLoggedIn, requireAdmin, function (req, res) {
	var name = req.body['edit-name'];
	var address = req.body['edit-address'];
	var type = req.body['edit-type'];
	var active = false;
	var contact_count = req.body['edit-count'];
	console.log(contact_count);
	var key = req.body.key;
	var contact_num = [];

	console.log("IN HCL EDIT");
	console.log(req.body);

	if(req.body['edit-status'] == 'Active') {
		active = true;
	}

	for(var i = 1; i <= contact_count; i++) {
		if( req.body['edit-field' + i] != undefined && req.body['edit-field' + i].trim() != ''){
			contact_num.push( req.body['edit-field' + i] );
		}	
	}

	Hospital.update({
		name: name,
		address: address,
		active: active,
		type: type,
		contact_numbers: contact_num,
	},
	{ where: {
			name: key,
	}}).then(function (item) {
		// res.json({"status": "success"});
		res.redirect('/hcl_list');
	}).catch(function (error) {
		res.json({"status" : "error", "name": req.body.name});
	});
});

// router.post('/hcl_delete/:name', requireLoggedIn, requireAdmin, function(req, res){
// 	console.log("IN HCL DELETE");
// 	var key = req.params.name;
// 	var hospital, cu = [], labs = [];
// 	var hasChildRecord, ipt_count = 0, opt_count = 0, cc_count = 0, lab_count = 0;

// 	Hospital.findOne({
// 		where: {
// 			active: true,
// 			name: key,
// 		},
// 		raw: true,
// 	}).then(function(result){
// 		hospital = result;
// 		if(result){

// 			Check_Up.findAll({
// 				where: {
// 					hospitalName: hospital['name'],
// 					active: true,
// 				},
// 				raw: true,
// 				attributes: ['check_up_type', 'id'],
// 			}).then(function(check_ups){

// 				cu = check_ups;

// 				Laboratory.findAll({
// 					where: {
// 						active: true,
// 						hospitalName: hospital['name'],
// 					},
// 					raw: true,
// 					attributes: ['id'],
// 				}).then(function(laboratories){

// 					labs = laboratories;

// 					if(cu.length+labs.length > 0)
// 						hasChildRecord = true
// 					else
// 						hasChildRecord = false

// 					for(var i = 0; i < cu.length; i++){
// 						if(cu[i]['check_up_type'] == 'In-Patient-Treatment' )
// 							ipt_count+=1;
// 						else if(cu[i]['check_up_type'] == 'Out-Patient-Treatment')
// 							opt_count+=1;
// 						else
// 							cc_count+=1;
// 					}

// 					res.json({
// 						hasChildRecord: hasChildRecord,
// 						ipt_count: ipt_count,
// 						opt_count: opt_count,
// 						cc_count: cc_count,
// 						lab_count: labs.length,
// 					})

// 				});

// 			});

// 		} else{
// 			res.json({
// 				message: "This record doesn't exist."
// 			})
// 		}

// 	});
// });

// router.post('/hcl_delete_confirmed/:name', requireLoggedIn, requireAdmin, function(req, res){
// 	console.log("IN HCL DELETE CONFIRMED");
// 	var key = req.params.name;

// 	Hospital.update({
// 		active: false,
// 	}, {
// 		where: {
// 			name: key,
// 			active: true,
// 		}
// 	}).then(function(result){

// 		if(result){
// 			res.redirect('/hcl_list');
// 		} else {
// 			res.send({
// 				message: "The record doesn't exist."
// 			});
// 		}

// 	});
// })

module.exports = router;