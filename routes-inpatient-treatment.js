const express = require('express');
const router = express.Router();
const InPatient_Treatment = require('./models').InPatient_Treatment;
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

var addIPTfileQueue = {};

const upload_file_ipts = multer({
	storage: multer.diskStorage({
		destination: function (req, file, cb) {
			if(file.fieldname == 'add-ipt-attachments[]'){
				var path = './static/uploads/IPTs';
				cb(null, path);
			}
		},
		filename: function (req, file, cb) {
			cb(null, Date.now()+file.originalname);
		}
	}),
});

var upload_ipt_success = upload_file_ipts.array('add-ipt-attachments[]');

//////////////////////////// GET ////////////////////////////////////

router.get('/ipt_list/:patient_id', requireLoggedIn,
	function (req, res, next) {
		var fileId = req.signedCookies.iptFileId;
		addIPTfileQueue[fileId] = null;
		fileId = Date.now() + "" + Math.floor(Math.random()*10);
		res.cookie('iptFileId', fileId, { signed: true });
		addIPTfileQueue[fileId] = {filesArr: []};
		next();
	},
	function (req, res) {
		var patient_id = req.params.patient_id;

		if(req.session.doctor) {
			InPatient_Treatment.findAll({
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
			}).then(ipt_list => {
				res.json({ipt_list: ipt_list});
			});
		} else if (req.session.secretary) {
			InPatient_Treatment.findAll({
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
			}).then(ipt_list => {
				res.json({ipt_list: ipt_list});
			});
		} else {
			res.send("You are not given access here.");
		}
	}
);

router.get('/ipt_edit_json/:ipt_id/:patient_id', function (req, res) {
	var key = req.params.ipt_id;
	var patient_id = req.params.patient_id, result;

	InPatient_Treatment.findOne({
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
				include: [{
					model: User_Account,
					as: 'username'
				}],
			}],
		}],
		where: {
			id: key,
			active: true,
		}
	}).then(ipt_instance => {

		if(ipt_instance){
			Medication.findAll({
				where: {
					checkUpId: ipt_instance['parent_record.id'],
				},
				raw: true,
			}).then(medication_list => {
				Medical_Procedure.findAll({
					where: {
						checkUpId: ipt_instance['parent_record.id'],
					},
					raw: true,
				}).then(procedures_list => {
					res.json({
						ipt: ipt_instance,
						medications: medication_list,
						med_procedures: procedures_list,
					});
				});
			});
		} else {
			res.send({
				message: "This record doesn't exist."
			});
		}

	});
});

router.get("/ipt_delete/:ipt_id", requireLoggedIn, function(req, res){
	var key = req.params.ipt_id, ipt, meds = [], med_procs = [];

	InPatient_Treatment.findOne({
		where: {
			id: key,
			active: true,
		},
		raw: true,
		attributes: ['id', 'parentRecordId'],
	}).then(function(result){
		ipt = result;
		Medication.findAll({
			where: {
				checkUpId: ipt['parentRecordId']
			},
			raw: true,
			attributes: ['id'],
		}).then(function(results){
			meds = results;

			Medical_Procedure.findAll({
				where: {
					checkUpId: ipt['parentRecordId'],
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

/////////////////////////// POST ////////////////////////////////////

router.post('/ipt_add', requireLoggedIn, upload_file_ipts.array('add-ipt-attachments[]'), function (req, res) {
	var fileId = req.signedCookies.iptFileId;
	var fields, includes;

	var confine = req.body['confinement-date'];
	var hospital = req.body['hospital'];
	var p_id = req.body['p-id'];
	var doc = req.body['doctor'];
	var discharge = null;

	if (req.body['discharge-date'] && req.body['discharge-date'].trim() !== "") {
		discharge = req.body['discharge-date'];
	};

	if (req.session.doctor) {
		var medication = [];
		var medical_procedure = [];
		var summary = req.body['summary'].trim();
		var details = req.body['detailed-diagnosis'].trim();
		var notes = req.body['notes'].trim();
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
			conf_date: confine,
			discharge_date: discharge,
			sum_of_diag: summary,
			detailed_diag: details,
			notes: notes,
			attachments: addIPTfileQueue[fileId].filesArr,
			parent_record: {
				check_up_type: "In-Patient-Treatment",
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
		
	}  else if (req.session.secretary) {
		fields = {
			conf_date: confine,
			discharge_date: discharge,
			attachments: [],
			parent_record: {
				check_up_type: "In-Patient-Treatment",
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

	InPatient_Treatment.create(fields, includes).then(checkUp_data => {
		addIPTfileQueue[fileId] = null;
		res.json({success: true});
	}).catch(error => {
		console.log(error);
		res.json({error: 'Something went wrong. Please try again later.'});
	});
});

router.post('/upload_files_ipt_results', requireLoggedIn, function (req, res) {
	upload_ipt_success (req, res, function (err) {
		if (err) {
			return res.json({error: "Your upload failed. Please try again later."});
		}
		var fileId = req.signedCookies.iptFileId;
		addIPTfileQueue[fileId].filesArr.push(req.files[0].path);
		res.json({});
	});
});

router.post('/ipt_edit/:ipt_id/:cu_id', function (req, res) {
	var key = req.params.ipt_id;
	var cu_id = req.params.cu_id;

	var confine = null, discharge = null;

	var dis_date = req.body['discharge-date'].split("-");

	if((dis_date[0] != "" && dis_date[1] != "" && dis_date[2] != "") && (dis_date[0] != 'null' && dis_date[1] != 'null' && dis_date[2] != 'null') ){
		discharge = req.body['discharge-date'];
	}

	confine = req.body['confinement-date'];
	var hospital = req.body['hospital'];
	var doc = req.body['doctor'];
	
	if (req.session.doctor) {
		var summary = req.body['summary'];
		var details = req.body['detailed-diagnosis'];
		var notes = req.body['notes'];

		InPatient_Treatment.update({
			conf_date: confine,
			discharge_date: discharge,
			sum_of_diag: summary,
			detailed_diag: details,
			notes: notes,
		},{
			where:{
				id: key,
				active: true,
			}
		}).then(updated_ipt => {

			if(updated_ipt){
				Check_Up.update({
					hospitalName: hospital,
					doctorId: doc,
				}, {
					where: {
						id: cu_id,
						active: true,
					}
				}).then(updated_check_up => {

					if(updated_check_up){
						res.json({success: true});
					} else{
						res.send({
							message: "This record doesn't exist."
						});
					}

					
				}).catch(function (error) {
					console.log(error);
					res.json({error: error});
				});
			} else{
				res.send({
					message: "This record doesn't exist."
				});
			}

			

		}).catch(function (error) {
			console.log(error);
			res.json({error: error});
		});
	} else if (req.session.secretary) {
		InPatient_Treatment.update({
			conf_date: confine,
			discharge_date: discharge
		},{
			where:{
				id: key,
				active: true,
			}
		}).then(updated_ipt => {

			if(updated_ipt){
				Check_Up.update({
					hospitalName: hospital,
					doctorId: doc,
				}, {
					where: {
						id: cu_id,
						active: true,
					}
				}).then(updated_check_up => {

					if(updated_check_up){
						res.json({success: true});
					} else{
						res.send({
							message: "This record doesn't exist."
						})
					}
					
				}).catch(function (error) {
					console.log(error);
					res.json({error: error});
				});
			} else{
				res.send({
					message: "This record doesn't exist."
				})
			}
			
		}).catch(function (error) {
			console.log(error);
			res.json({error: error});
		});
	}
});

router.post('/delete_files_ipt/:ipt_id', requireLoggedIn, function (req, res) {
	var ipt_id = req.params.ipt_id;
	if (fs.existsSync(req.body.key)) {
		fs.unlink(req.body.key);
	}
	InPatient_Treatment.findOne({
		where: {
			id: ipt_id
		}
	}).then(ipt_instance => {
		if(ipt_instance) {
			var clone_arr_attachments = ipt_instance.attachments.slice(0);
			var index_to_remove = clone_arr_attachments.indexOf(req.body.key);
			if (index_to_remove > -1) {
			    clone_arr_attachments.splice(index_to_remove, 1);
			}
			ipt_instance.update({ attachments: clone_arr_attachments }).then(() => { return res.json({}); });
		} else {
			res.json({});
		}
	});
});

router.post("/upload_files_edit_ipt/:ipt_id", requireLoggedIn, function (req, res) {
	upload_ipt_success (req, res, function (err) {
		if (err) {
			return res.json({error: "Your upload failed. Please try again later."});
		}
		InPatient_Treatment.findOne({
			where: {
				id: req.params.ipt_id
			}
		}).then(ipt_instance => {
			if(ipt_instance) {
				var clone_arr_attachments = ipt_instance.attachments.slice(0);
				clone_arr_attachments.push(req.files[0].path);
				ipt_instance.update({ attachments: clone_arr_attachments }).then(() => { return res.json({}); });
			} else {
				res.json({});
			}
		});
	});
});

router.post("/ipt_edit_add_medication/:cu_id", requireLoggedIn, function (req, res) {
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
		}).then(billing_instance =>{
			Billing_Item.create({
				description: req.body['name'].trim(),
				billingId: billing_instance['id'],
			}).then(billing_item => {
				res.json({id: med_instance.id});
			})
		});
	});
});

router.post("/ipt_edit_add_medical_procedure/:cu_id", requireLoggedIn, function (req, res) {
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

router.post("/ipt_delete_confirmed/:ipt_id", requireLoggedIn, function(req, res){
	var key = req.params.ipt_id;
	InPatient_Treatment.update({
		active: false,
	}, {
		where: {
			id: key,
		},
		returning: true,
		raw: true,
	}).then(function(ipt_resut){
		Check_Up.update({
			active: false,
		}, {
			where: {
				id: ipt_resut['parentRecordId'],
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

		res.json({success: true});
	}).catch(function(error){
		console.log(error);
		res.json({success: false});
	});
});

module.exports = router;