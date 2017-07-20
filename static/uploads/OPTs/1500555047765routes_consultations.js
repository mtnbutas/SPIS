const express = require('express');
const router = express.Router();
const Consultation = require('./models').Consultation;
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

var addCCfileQueue = {};

const upload_file_cc = multer({
	storage: multer.diskStorage({
		destination: function (req, file, cb) {
			if(file.fieldname == 'add-cc-attachments[]'){
				var path = './static/uploads/consultations';
				cb(null, path);
			}
		},
		filename: function (req, file, cb) {
			cb(null, Date.now()+file.originalname);
		}
	}),
});

var upload_cc_success = upload_file_cc.array('add-cc-attachments[]');

/////////////////////////////// GET ////////////////////////////////////

router.get('/clinic_consultation_list/:patient_id', requireLoggedIn,
	function (req, res, next) {
		var fileId = req.signedCookies.ccFileId;
		addCCfileQueue[fileId] = null;
		fileId = Date.now() + "" + Math.floor(Math.random()*10);
		res.cookie('ccFileId', fileId, { signed: true });
		addCCfileQueue[fileId] = {filesArr: []};
		next();
	},
	function (req, res) {
		var patient_id = req.params.patient_id;

		if(req.session.doctor) {
			Consultation.findAll({
				raw: true,
				include: [{
			        model: Check_Up,
			        where: {
						patientId: patient_id,
					},
					as: 'parent_record',
					include: [{ 
						model: Doctor,
						where: { id: req.session.doctor.id },
						include: [{ model: User_Account, as: 'username'}]
					}]
			    }]
			}).then(cc_list => {
				res.json({cc_list: cc_list});
			});
		} else if (req.session.secretary) {
			Consultation.findAll({
				raw: true,
				include: [{
			        model: Check_Up,
			        where: {
						patientId: patient_id,
					},
					as: 'parent_record',
					include: [{ 
						model: Doctor,
						include: [{ model: User_Account, as: 'username'}]
					}]
			    }]
			}).then(cc_list => {
				res.json({cc_list: cc_list});
			});
		} else {
			res.send("You are not given access here.");
		}
	}
);

router.get('/clinic_consultation_edit_json/:cc_id/:patient_id', requireLoggedIn, function (req, res) {

	var key = req.params.cc_id;
	var patient_id = req.params.patient_id;

	Consultation.findOne({
		raw: true,
		include: [{
			model: Check_Up,
			where: {
				patientId: patient_id,
			},
			as: 'parent_record',
			include: [{
				model: Doctor,
				include: [{
					model: User_Account,
					as: 'username',
				}],
			}],
		}],
		where: {
			id: key,
		}
	}).then(consultation_instance => {
		Medication.findAll({
			where: {
				checkUpId: consultation_instance['parent_record.id'],
			},
			raw: true,
		}).then(medication_list => {
			Medical_Procedure.findAll({
				where: {
					checkUpId: consultation_instance['parent_record.id'],
				},
				raw: true,
			}).then(procedures_list => {
				res.json({
					consultation: consultation_instance,
					medications: medication_list,
					med_procedures: procedures_list,
				});
			});
		});
	});	
});


////////////////////////////// POST ////////////////////////////////////

router.post('/clinic_consultation_add', requireLoggedIn, upload_file_cc.array('add-cc-attachments[]'), function (req, res) {
	var fileId = req.signedCookies.ccFileId;

	var hospital = req.body['hospital'];
	var p_id = req.body['p-id'];
	var doc = req.body['doctor'];
	var date = req.body['date'];

	if(req.session.doctor) {
		var summary = req.body['summary'].trim();
		var detailed = req.body['detailed-diagnosis'].trim();
		var notes = req.body['notes'].trim();
		var medication = [];
		var medical_procedure = [];
		var billing = [];

		if(req.body['meds'] != null && req.body['meds'] != ''){
			medication = req.body['meds'];
		}

		if(req.body['med_procedures'] != null && req.body['med_procedures'] != ''){
			medical_procedure = req.body['med_procedures'];
		}

		if(req.body['billings'] != null && req.body['billings'] != '') {
			billing = req.body['billings'];
		}

		fields = {
			date: date,
			sum_of_diag: summary,
			detailed_diag: detailed,
			notes: notes,
			attachments: addCCfileQueue[fileId].filesArr,
			parent_record: {
				check_up_type: "Consultation",
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
					as: 'medication',
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
				}]
			}]
		};
	} else if (req.session.secretary) {
		fields = {
			date: date,
			attachments: [],
			parent_record: {
				check_up_type: "Consultation",
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
		};
	}
	Consultation.create(fields, includes).then(consultation_instance => {
		addCCfileQueue[fileId] = null;
		res.json({success: true});
	}).catch(error => {
		console.log(error);
		res.json({error: 'Something went wrong. Please try again later.'});
	});
});

router.post('/upload_files_cc_results', requireLoggedIn, function (req, res) {
	upload_cc_success (req, res, function (err) {
		if (err) {
			return res.json({error: "Your upload failed. Please try again later."});
		}
		var fileId = req.signedCookies.ccFileId;
		addCCfileQueue[fileId].filesArr.push(req.files[0].path);
		res.json({});
	});
});

router.post('/clinic_consultation_edit/:cc_id/:cu_id', function (req, res) {
	var key = req.params.cc_id;
	var cu_id = req.params.cu_id;
	var date = null;

	date = req.body['date'];
	var hospital = req.body['hospital'];
	var doc = req.body['doctor'];
	
	if (req.session.doctor) {
		var summary = req.body['summary'];
		var details = req.body['detailed-diagnosis'];
		var notes = req.body['notes'];

		Consultation.update({
			date: date,
			sum_of_diag: summary,
			detailed_diag: details,
			notes: notes,
		},{
			where:{
				id: key,
			}
		}).then(updated_consultation => {
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
		Consultation.update({
			date: date
		},{
			where:{
				id: key,
			}
		}).then(updated_consultation => {
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

router.post('/delete_files_cc/:cc_id', requireLoggedIn, function (req, res) {
	var cc_id = req.params.cc_id;
	console.log(req.body.key);
	if (fs.existsSync(req.body.key)) {
		fs.unlink(req.body.key);
	}
	Consultation.findOne({
		where: {
			id: cc_id
		}
	}).then(cc_instance => {
		if(cc_instance) {
			var clone_arr_attachments = cc_instance.attachments.slice(0);
			var index_to_remove = clone_arr_attachments.indexOf(req.body.key);
			if (index_to_remove > -1) {
			    clone_arr_attachments.splice(index_to_remove, 1);
			}
			cc_instance.update({ attachments: clone_arr_attachments }).then(() => { return res.json({}); });
		} else {
			res.json({});
		}
	});
});

router.post("/upload_files_edit_cc/:cc_id", requireLoggedIn, function (req, res) {
	upload_cc_success (req, res, function (err) {
		if (err) {
			return res.json({error: "Your upload failed. Please try again later."});
		}
		Consultation.findOne({
			where: {
				id: req.params.cc_id
			}
		}).then(cc_instance => {
			if(cc_instance) {
				var clone_arr_attachments = cc_instance.attachments.slice(0);
				clone_arr_attachments.push(req.files[0].path);
				cc_instance.update({ attachments: clone_arr_attachments }).then(() => { return res.json({}); });
			} else {
				res.json({});
			}
		});
	});
});

router.post("/clinic_consultation_edit_add_medication/:cu_id", requireLoggedIn, function (req, res) {
	var key = req.params.cu_id;

	Medication.create({
		name: req.body['name'],
		dosage: req.body['dosage'],
		frequency: req.body['frequency'],
		type: req.body['type'],
		notes: req.body['notes'],
		checkUpId: key
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

router.post("/clinic_consultation_edit_add_medical_procedure/:cu_id", requireLoggedIn, function (req, res) {
	var key = req.params.cu_id;

	Medical_Procedure.create({
		date: req.body['date'],
		description: req.body['description'],
		details: req.body['details'],
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

router.post("/clinic_consultation_delete/:cc_id", requireLoggedIn, function(req, res){
	console.log("CC DELETE");
	console.log(req.params);
	var key = req.params.cc_id;
	var cc, meds = [], med_procs = [], childRecords, hasChildRecords;

	Consultation.findOne({
		where: {
			id: key,
			active: true,
		},
		raw: true,
		attributes: ['id', 'parentRecordId'],
	}).then(function(result){
		console.log( result );
		cc = result;
		Medication.findAll({
			where: {
				checkUpId: cc['parentRecordId'],
			},
			raw: true,
			attributes: ['id'],
		}).then(function(results){

			meds = results;

			Medical_Procedure.findAll({
				where: {
					checkUpId: cc['parentRecordId'],
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

router.post("/clinic_consultation_delete_confirmed/:cc_id", requireLoggedIn, function(req, res){
	console.log("CC DELETE CONFIRMED");
	console.log(req.params);
	var key = req.params.cc_id;
	Consultation.update({
		active: false,
	}, {
		where: {
			id: key,
		},
		returning: true,
		raw: true,
	}).then(function(cc_result){
		Check_Up.update({
			active: false,
		}, {
			where: {
				id: cc_result['parentRecordId'],
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
		console.log("CC PATIENT TREATMENT CONFIRMED");
		console.log(error);
		res.json({success: false});
	});
});

module.exports = router;