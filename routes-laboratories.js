const express = require('express');
const router = express.Router();
const Laboratory = require('./models').Laboratory;
const Hospital = require('./models').Hospital;
const fs = require('fs');

const multer = require('multer');

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

var addLabfileQueue = {};

const upload_file_labs = multer({
	storage: multer.diskStorage({
		destination: function (req, file, cb) {
			if(file.fieldname == 'add-lab-attachments[]'){
				var path = './static/uploads/lab_results';
				cb(null, path);
			}
		},
		filename: function (req, file, cb) {
			cb(null, Date.now()+file.originalname);
		}
	}),
});

var upload_success = upload_file_labs.array('add-lab-attachments[]');

//////////////////////// GET ////////////////////////////////////

router.get('/lab_results_list/:patient_id', requireLoggedIn, 
	function (req, res, next) {
		var fileId = Date.now() + "" + Math.floor(Math.random()*10);
		res.cookie('labFileId', fileId, { signed: true });
		addLabfileQueue[fileId] = {filesArr: []};
		next();
	},
	function (req, res) {
		var patient_id = req.params.patient_id;
		Laboratory.findAll({
			raw: true,
			where: {
				patientId: patient_id,
				active: true,
			}
		}).then(lab_results_list => {
			console.log(lab_results_list);
			res.json({lab_results_list: lab_results_list});
		});
	}
);

router.get('/laboratory_edit/:lab_id', requireLoggedIn, function (req, res){
	var lab_id = req.params.lab_id;

	Laboratory.findOne({
		raw: true,
		where: {
			id: lab_id,
			active: true,
		}
	}).then(lab_result => {

		if(lab_result != null){
			console.log(lab_result);
			res.json({lab_result: lab_result});
		} else{
			res.json({
				message: "This record doesn't exist."
			})
		}

	});
});

//////////////////////// POST ////////////////////////////////////

router.post('/laboratory_add', requireLoggedIn, upload_file_labs.array('add-lab-attachments[]'), function (req, res) {
	var fileId = req.signedCookies.labFileId;
	console.log(req.body);
	if (req.body.notes.trim() === "") { req.body.notes = null; }
	Laboratory.create({
		date: req.body.date,
		description: req.body.description,
		hospitalName: req.body.hospital,
		notes: req.body.notes,
		attachments: addLabfileQueue[fileId].filesArr,
		patientId: req.body.patient_id
	}).then(lab_instance => {
		addLabfileQueue[fileId] = null;
		res.json({success: true});
	}).catch(error => {
		console.log(error);
		res.json({error: 'Something went wrong. Please try again later.'});
	});
});

router.post('/upload_files_lab_results', requireLoggedIn, function (req, res) {
	upload_success (req, res, function (err) {
		if (err) {
			return res.json({error: "Your upload failed. Please try again later."});
		}
		var fileId = req.signedCookies.labFileId;
		addLabfileQueue[fileId].filesArr.push(req.files[0].path);
		res.json({});
	});
});

router.post('/delete_files_lab/:lab_id', requireLoggedIn, function (req, res) {
	var lab_id = req.params.lab_id;
	console.log(req.body.key);
	if (fs.existsSync(req.body.key)) {
		fs.unlink(req.body.key);
	}
	Laboratory.findOne({
		where: {
			id: lab_id
		}
	}).then(lab_instance => {
		if(lab_instance) {
			var clone_arr_attachments = lab_instance.attachments.slice(0);
			var index_to_remove = clone_arr_attachments.indexOf(req.body.key);
			if (index_to_remove > -1) {
			    clone_arr_attachments.splice(index_to_remove, 1);
			}
			lab_instance.update({ attachments: clone_arr_attachments }).then(() => { return res.json({}); });
		} else {
			res.json({});
		}
	});
});

router.post("/upload_files_edit_lab_results/:lab_id", requireLoggedIn, function (req, res) {
	upload_success (req, res, function (err) {
		if (err) {
			return res.json({error: "Your upload failed. Please try again later."});
		}
		Laboratory.findOne({
			where: {
				id: req.params.lab_id
			}
		}).then(lab_instance => {
			if(lab_instance) {
				var clone_arr_attachments = lab_instance.attachments.slice(0);
				clone_arr_attachments.push(req.files[0].path);
				lab_instance.update({ attachments: clone_arr_attachments }).then(() => { return res.json({}); });
			} else {
				res.json({});
			}
		});
	});
});

router.post('/laboratory_edit/:lab_id', requireLoggedIn, function (req, res){
	var lab_id = req.params.lab_id;

	Laboratory.findOne({
		where: {
			id: lab_id,
			active: true,
		}
	}).then(lab_result => {

		if(lab_result) {
			lab_result.date = req.body.date;
			lab_result.hospitalName = req.body.hospital;
			lab_result.description = req.body.description;
			lab_result.notes = req.body.notes;
			lab_result.save().then(() => { res.json({}); });
		}
		else {
			res.json({
				message: "This record doesn't exist."
			});
		}
	});
});

router.post('/laboratory_delete/:lab_id', requireLoggedIn, function(req, res){
	console.log("LAB DELETE ROUTE");

	console.log(req.params);

	var key = req.params.lab_id;

	Laboratory.update({
		active: false,
	}, {
		where: {
			id: key,
		}
	}).then(function(result){
		res.json({success: true});
	}).catch(function(error){
		console.log("LAB TREATMENT CONFIRMED");
		console.log(error);
		res.json({success: false});
	})
	// Laboratory.
});

module.exports = router;