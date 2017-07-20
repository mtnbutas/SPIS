const express = require('express');
const router = express.Router();
const OutPatient_Treatment = require('./models').OutPatient_Treatment;
const Check_Up = require('./models').Check_Up;
const Doctor = require('./models').Doctor;
const User_Account = require('./models').User_Account;
const Medication = require('./models').Medication;
const Medical_Procedure = require('./models').Medical_Procedure;
const Billing = require('./models').Billing;
const Billing_Item = require('./models').Billing_Item;
const multer = require('multer');
const fs = require('fs');

///////////////////// MIDDLEWARES ////////////////////////

function requireLoggedIn(req, res, next) {
	const currentInstance = req.session.spisinstance;
	const currentUser = req.session.user;
	if(!currentUser || !currentInstance) {
		return res.redirect('/login');
	}
	next();
}

function requireDoctor(req, res, next) {
	const currentUser = req.session.doctor;
	if(!currentUser) {
		return res.send("You are not authorized to access this page");
	}
	next();
}

var addOPTfileQueue = {};

const upload_file_opts = multer({
	storage: multer.diskStorage({
		destination: function (req, file, cb) {
			if(file.fieldname == 'add-opt-attachments[]'){
				var path = './static/uploads/OPTs';
				cb(null, path);
			}
		},
		filename: function (req, file, cb) {
			cb(null, Date.now()+file.originalname);
		}
	}),
});

var upload_opt_success = upload_file_opts.array('add-opt-attachments[]');

//////////////////////// GET ////////////////////////////////////

router.get('/opt_list/:patient_id',
	function (req, res, next) {
		var fileId = req.signedCookies.optFileId;
		addOPTfileQueue[fileId] = null;
		fileId = Date.now() + "" + Math.floor(Math.random()*10);
		res.cookie('optFileId', fileId, { signed: true });
		addOPTfileQueue[fileId] = {filesArr: []};
		next();
	},
	function (req, res) {
		var patient_id = req.params.patient_id;

		if(req.session.doctor) {
			OutPatient_Treatment.findAll({
				raw: true,
				where: {
					active: true,
				},
				include: [{
			        model: Check_Up,
			        where: {
						patientId: patient_id,
						active: true,
					},
					as: 'parent_record',
					include: [{ 
						model: Doctor,
						where: { id: req.session.doctor.id },
						include: [{ model: User_Account, as: 'username'}]
					}]
			    }]
			}).then(function (results) {
				res.json({opt_list: results});
			});
		} else if(req.session.secretary) {
			OutPatient_Treatment.findAll({
				raw: true,
				where: {
					active: true,
				},
				include: [{
			        model: Check_Up,
			        where: {
						patientId: patient_id,
						active: true,
					},
					as: 'parent_record',
					include: [{ 
						model: Doctor,
						include: [{ model: User_Account, as: 'username'}]
					}]
			    }]
			}).then(function (results) {
				res.json({opt_list: results});
			});
		} else {
			res.send("You are not given access here.");
		}
	}
);

router.get('/opt_edit_json/:opt_id/:patient_id', function(req, res){
	var key = req.params.opt_id;
	var patient_id = req.params.patient_id;

	OutPatient_Treatment.findOne({
		raw: true,
		include: [{
	        model: Check_Up,
	        where: {
				patientId: patient_id,
				active: true,
			},
			as: 'parent_record',
			include: [{ 
				model: Doctor,
				include: [{ model: User_Account, as: 'username'}]
			}],
	    }],
	    where: {
	    	id: key,
	    	active: true,
	    }
	}).then(opt_instance => {

		if(opt_instance != null){
			Medication.findAll({
				where: {
					checkUpId: opt_instance['parent_record.id'],
				},
				raw: true,
			}).then(medication_list => {
				Medical_Procedure.findAll({
					where: {
						checkUpId: opt_instance['parent_record.id'],
					},
					raw: true,
				}).then(procedures_list => {
					res.json({
						opt: opt_instance,
						medications: medication_list,
						med_procedures: procedures_list,
					});
				});
			});
		} else{
			res.json({
				message: "This record doesn't exist."
			})
		}

		
	});
});

router.get("/opt_delete/:opt_id", requireLoggedIn, function(req, res){
	console.log("OPT DELETE");
	console.log(req.params);
	var key = req.params.opt_id;
	var opt, meds = [], med_procs = [], childRecords, hasChildRecords;

	OutPatient_Treatment.findOne({
		where: {
			id: key,
			active: true,
		},
		raw: true,
		attributes: ['id', 'parentRecordId'],
	}).then(function(result){
		console.log( result );
		opt = result;
		Medication.findAll({
			where: {
				checkUpId: opt['parentRecordId'],
			},
			raw: true,
			attributes: ['id'],
		}).then(function(results){

			meds = results;

			Medical_Procedure.findAll({
				where: {
					checkUpId: opt['parentRecordId'],
				},
				raw: true,
				attributes: ['id'],
			}).then(function(results){

				med_procs = results;

				if(meds.length+med_procs.length > 0)
					hasChildRecords = true;
				else
					hasChildRecords = false;
				
				res.json({
					hasChildRecords: hasChildRecords,
					meds_count: meds.length,
					medical_procedure_count: med_procs.length,
				});
			});
		});
	});
});

//////////////////////// POST ////////////////////////////////////

router.post('/opt_add', upload_file_opts.array('add-opt-attachments[]'), function (req, res) {
	var fileId = req.signedCookies.optFileId;
	var fields, includes;

	var date = req.body['opt-date'];
	var hospital = req.body['hospital'];
	var p_id = req.body['opt-p-id'];
	var doc = req.body['doctor'];

	if(req.session.doctor) {
		var medication = [];
		var medical_procedure = [];
		var billing = [];
		var summary = req.body['summary'].trim();
		var details = req.body['detailed-diagnosis'].trim();
		var notes = req.body['notes'].trim();

		if(req.body['meds'] != null && req.body['meds'] != '') {
			medication = req.body['meds'];
		}

		if(req.body['med_procedures'] != null && req.body['med_procedures'] != '') {
			medical_procedure = req.body['med_procedures'];
		}

		if(req.body['billings'] != null && req.body['billings'] != '') {
			billing = req.body['billings'];
		}

		fields = {
			date: date,
			sum_of_diag: summary,
			detailed_diag: details,
			notes: notes,
			attachments: addOPTfileQueue[fileId].filesArr,
			parent_record: {
				check_up_type: "Out-Patient-Treatment",
				hospitalName: hospital,
				patientId: p_id,
				doctorId: doc,
				medication: medication,
				medical_procedure: medical_procedure,
				receipt: {
					billing_items: billing
				}
			}
		};
		includes = {
			include: [{
				model: Check_Up,
				as: 'parent_record',
				include: [{
					model: Medication,
					as: 'medication'
				}, {
					model: Medical_Procedure,
					as: 'medical_procedure',
				}, {
					model: Billing,
					as: 'receipt',
					include: [{
						model: Billing_Item,
						as: 'billing_items'
					}]
				}],
			}]
		};
	} else if (req.session.secretary) {
		fields = {
			date: date,
			attachments: [],
			parent_record: {
				check_up_type: "Out-Patient-Treatment",
				hospitalName: hospital,
				patientId: p_id,
				doctorId: doc
			}
		};
		includes = {
			include: [{
				model: Check_Up,
				as: 'parent_record'
			}]
		}
	}
	OutPatient_Treatment.create(fields, includes).then(checkUp_data => {
		addOPTfileQueue[fileId] = null;
		res.json({success: true});
	}).catch(error => {
		console.log(error);
		res.json({error: 'Something went wrong. Please try again later.'});
	});
});

router.post('/upload_files_opt', requireLoggedIn, function (req, res) {
	upload_opt_success (req, res, function (err) {
		if (err) {
			return res.json({error: "Your upload failed. Please try again later."});
		}
		var fileId = req.signedCookies.optFileId;
		addOPTfileQueue[fileId].filesArr.push(req.files[0].path);
		res.json({});
	});
});

router.post('/opt_edit/:opt_id/:cu_id', function(req, res) {
	var key = req.params.opt_id;
	var cu_id = req.params.cu_id;
	var date = null;

	var date = req.body['date'];
	var hospital = req.body['hospital'];
	var doc = req.body['doctor'];

	if (req.session.doctor) {
		var summary = req.body['summary'].trim();
		var details = req.body['detailed-diagnosis'].trim();
		var notes = req.body['notes'].trim();

		OutPatient_Treatment.update({
			date: date,
			sum_of_diag: summary,
			detailed_diag: details,
			notes: notes,
		},{
			where:{
				id: key,
			}
		}).then(updated_opt => {
			Check_Up.update({
				hospitalName: hospital,
				doctorId: doc,
			}, {
				where: {
					id: cu_id,
				}
			}).then(updated_check_up => {
				res.json({success: true});
			}).catch(function (error) {
				console.log(error);
				res.json({error: error});
			});

		}).catch(function (error) {
			console.log(error);
			res.json({error: error});
		});
	} else if (req.session.secretary) {
		OutPatient_Treatment.update({
			date: date
		},{
			where:{
				id: key,
			}
		}).then(updated_opt => {
			Check_Up.update({
				hospitalName: hospital,
				doctorId: doc,
			}, {
				where: {
					id: cu_id,
				}
			}).then(updated_check_up => {
				res.json({success: true});
			}).catch(function (error) {
				console.log(error);
				res.json({error: error});
			});
		}).catch(function (error) {
			console.log(error);
			res.json({error: error});
		});
	}
});

router.post('/delete_files_opt/:opt_id', requireLoggedIn, function (req, res) {
	var opt_id = req.params.opt_id;
	console.log(req.body.key);
	if (fs.existsSync(req.body.key)) {
		fs.unlink(req.body.key);
	}
	OutPatient_Treatment.findOne({
		where: {
			id: opt_id
		}
	}).then(opt_instance => {
		if(opt_instance) {
			var clone_arr_attachments = opt_instance.attachments.slice(0);
			var index_to_remove = clone_arr_attachments.indexOf(req.body.key);
			if (index_to_remove > -1) {
			    clone_arr_attachments.splice(index_to_remove, 1);
			}
			opt_instance.update({ attachments: clone_arr_attachments }).then(() => { return res.json({}); });
		} else {
			res.json({error: "Something went wrong..."});
		}
	});
});

router.post("/upload_files_edit_opt/:opt_id", requireLoggedIn, function (req, res) {
	upload_opt_success (req, res, function (err) {
		if (err) {
			return res.json({error: "Your upload failed. Please try again later."});
		}
		OutPatient_Treatment.findOne({
			where: {
				id: req.params.opt_id
			}
		}).then(opt_instance => {
			if(opt_instance) {
				var clone_arr_attachments = opt_instance.attachments.slice(0);
				clone_arr_attachments.push(req.files[0].path);
				opt_instance.update({ attachments: clone_arr_attachments }).then(() => { return res.json({}); });
			} else {
				res.json({error: "Something went wrong..."});
			}
		});
	});
});

router.post("/opt_edit_add_medication/:cu_id", requireLoggedIn, function (req, res) {
	var key = req.params.cu_id;
	Medication.create({
		name: req.body['name'].trim(),
		dosage: req.body['dosage'].trim(),
		frequency: req.body['frequency'].trim(),
		type: req.body['type'],
		notes: req.body['notes'].trim(),
		checkUpId: key,
	}).then(med_instance => {
		Billing.findOne({
			where: {
				receiptId: key,
			},
			raw: true,
		}).then(billing_instance => {
			Billing_Item.create({
				description: req.body['name'].trim(),
				billingId: billing_instance['id'],
			}).then(billing_item => {
				res.json({id: med_instance.id});
			});
		});
	});
});

router.post("/opt_edit_add_medical_procedure/:cu_id", requireLoggedIn, function (req, res) {
	var key = req.params.cu_id;
	Medical_Procedure.create({
		date: req.body['date'],
		description: req.body['description'].trim(),
		details: req.body['details'].trim(),
		checkUpId: key,
	}).then(procedure_instance => {
		Billing.findOne({
			where: {
				receiptId: key,
			},
			raw: true,
		}).then(billing_instance => {
			Billing_Item.create({
				description: req.body['description'].trim(),
				billingId: billing_instance['id'],
			}).then(billing_item => {
				res.json({id: procedure_instance.id});
			});
		});
	});
});

router.post("/edit_medication/:med_id", requireLoggedIn, function (req, res) {
	var key = req.params.med_id;
	var name = req.body['name'].trim();

	Medication.findOne({
		where: {
			id: key
		},
		raw: true,
	}).then(med_instance => {
		Medication.update({
			name: name,
			dosage: req.body['dosage'].trim(),
			frequency: req.body['frequency'].trim(),
			type: req.body['type'],
			notes: req.body['notes'].trim()
		}, {
			where: {
				id: key,
			},
			returning: true,
			raw: true,
		}).then(updated_med_instance => {
			if(med_instance['name'] != updated_med_instance['name']){
				Billing.findOne({
					where: {
						receiptId: med_instance['checkUpId'],
					},
					raw: true,
				}).then(billing_instance => {
					Billing_Item.update({
						description: name
					}, {
						where: {
							billingId: billing_instance['id'],
							description: med_instance['name'],
						}
					}).then(billing_item => {
						res.json({id: med_instance.id});
					});
				});
			} else{
				res.json({id: med_instance.id});
			}
		});
	});

	// Medication.update({
	// 	name: req.body['name'].trim(),
	// 	dosage: req.body['dosage'].trim(),
	// 	frequency: req.body['frequency'].trim(),
	// 	type: req.body['type'],
	// 	notes: req.body['notes'].trim()
	// },{
	// 	where: {
	// 		id: key,
	// 	}
	// }).then(med_instance => {
	// 	res.json({id: med_instance.id});
	// });
});

router.post("/edit_medical_procedure/:medproc_id", requireLoggedIn, function (req, res) {
	var key = req.params.medproc_id;
	var desc = req.body['description'].trim();
	Medical_Procedure.findOne({
		where: {
			id: key
		},
		raw: true
	}).then(procedure_instance => {
		Medical_Procedure.update({
			date: req.body['date'],
			description: req.body['description'].trim(),
			details: req.body['details'].trim(),
		}, {
			where: {
				id: key
			}
		}).then(updated_procedure_instance => {
			if(procedure_instance['description'] != updated_procedure_instance['description']){
				Billing.findOne({
					where: {
						receiptId: updated_procedure_instance['checkUpId'],
					},
					raw: true,
				}).then(billing_instance => {
					Billing_Item.update({
						description: desc
					}, {
						where: {
							billingId: billing_instance['id'],
							description: procedure_instance['name'],
						}
					}).then(billing_item => {
						res.json({id: procedure_instance.id});
					});
				});
			} else{
				res.json({id: procedure_instance.id});
			}
		});
	});
});

router.post("/opt_delete_confirmed/:opt_id", requireLoggedIn, function(req, res){
	console.log("OPT DELETE CONFIRMED");
	console.log(req.params);
	var key = req.params.opt_id;
	OutPatient_Treatment.update({
		active: false,
	}, {
		where: {
			id: key,
		},
		returning: true,
		raw: true,
	}).then(function(opt_result){
		Check_Up.update({
			active: false,
		}, {
			where: {
				id: opt_result['parentRecordId'],
			},
			returning: true,
			raw: true,
		}).then(function(check_up_result){

			Billing.destroy({
				where: {
					receiptId: check_up_result['id']
				}
			}).then(function(billing_result){
				res.json({success: true});
			})
		});
	}).catch(function(error){
		console.log("OUT PATIENT TREATMENT CONFIRMED");
		console.log(error);
		res.json({success: false});
	});
});

module.exports = router;