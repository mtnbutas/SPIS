const Sequelize = require('sequelize');
const database = require('./database');
const bcrypt = require('bcrypt');

const user_types = ['Doctor', 'Secretary'];
const institution_types = ['Clinic', 'Hospital', 'Laboratory', 'Others'];
const spis_instance_types = ['Active', 'Inactive'];
const title_types = ['Ms.', 'Mr.', 'Mrs.', 'Dr.'];
const sex_types = ['Female', 'Male'];
const check_up_types = ['Consultation', 'In-Patient-Treatment', 'Out-Patient-Treatment']
const inpatient_status_types = ['Confined', 'Discharged'];
const medication_types = ['Maintenance', 'Non-Maintenance'];
const billing_status_types = ['Fully Paid', 'Partially Paid', 'Deferred', 'Waived'];
const civil_status_types = ['Single', 'Married', 'Divorced', 'Separated', 'Widowed'];
const queue_status_types = ['Waiting', 'Done', 'Current'];

const User_Account = database.define('user_account', {
	id: {
		type: Sequelize.STRING(20),
		primaryKey: true,
		allowNull: false
	},
	title: {
		type: Sequelize.ENUM,
		values: title_types,
		defaultValue: 'Mr.'
	},
	first_name: {
		type: Sequelize.STRING(50),
		allowNull: false,
		set(val) {
	    	this.setDataValue('first_name', val.toUpperCase());
	    },
		validate: {
			notEmpty: true
		}
	},
	middle_name: {
		type: Sequelize.STRING(30),
		allowNull: false,
		set(val) {
	    	this.setDataValue('middle_name', val.toUpperCase());
	    }
	},
	last_name: {
		type: Sequelize.STRING(30),
		allowNull: false,
		set(val) {
	    	this.setDataValue('last_name', val.toUpperCase());
	    },
	    validate: {
			notEmpty: true
		}
	},
	suffix: {
		type: Sequelize.STRING(30),
		allowNull: true,
		set(val) {
			if (val) {
	    		this.setDataValue('suffix', val.toUpperCase());
	    	}
	    }
	},
	contact_numbers: {
		type: Sequelize.ARRAY(Sequelize.STRING),
		allowNull: false,
		notEmpty: true
	},
	email: {
		type: Sequelize.STRING(50),
		allowNull: true,
		validate: {
			isValidEmail: function (val) {
				if (val) {
					var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
					if (!re.test(val)) {
						throw new Error("Invalid Email");
					}
				}
			}
		}
	},
	user_type: {
		type: Sequelize.ENUM,
		values: user_types,
		allowNull: false,
		defaultValue: 'Secretary'
	},
	isAdmin: {
		type: Sequelize.BOOLEAN,
		defaultValue: false,
		allowNull: false
	},
	password_hash: {
		type: Sequelize.STRING,
		allowNull: false,
		set: function (val) {
			this.setDataValue('password_hash', bcrypt.hashSync(val, 10));
		},
		validate: {
			isLongEnough: function (val) {
				if (val.length < 7) {
					throw new Error("Please choose a longer password");
				}
			}
		}
	},
	photo: {
		type: Sequelize.STRING
	}, 
	active: {
		type: Sequelize.BOOLEAN,
		defaultValue: true,
	}
	}, {
	timestamps: true
});

const Superuser = database.define('superuser', {
	id: {
		type: Sequelize.STRING(20),
		primaryKey: true,
		allowNull: false
	},
	password: {
		type: Sequelize.STRING,
		allowNull: false,
		set: function (val) {
			this.setDataValue('password', bcrypt.hashSync(val, 10));
		}
	},
	contact_number: {
		type: Sequelize.ARRAY(Sequelize.STRING(20)),
		allowNull: false,
		notEmpty: true
	},
	email: {
		type: Sequelize.STRING(50),
		allowNull: false,
		validate: {
			isEmail: true,
			notEmpty: true
		}
	}
});

const SPIS_Instance = database.define('spis_instance', {
	license_no: {
		type: Sequelize.INTEGER,
		primaryKey: true,
		autoIncrement: true,
		allowNull: false
	},
	description: {
		type: Sequelize.TEXT,
		allowNull: false
	},
	status: {
		type: Sequelize.ENUM,
		values: spis_instance_types,
		defaultValue: 'Active'
	}
});

User_Account.belongsTo(SPIS_Instance);

const Doctor = database.define('doctor', {
	license_no: {
		type: Sequelize.STRING(20),
		allowNull: false
	},
	ptr_no: {
		type: Sequelize.STRING(20),
		allowNull: false
	},
	s2_license_no: {
		type: Sequelize.STRING(20),
		allowNull: false
	},
	signature: {
		type: Sequelize.STRING
	}
});

const Secretary = database.define('secretary');

const Admin = database.define('admin');

Admin.belongsTo(User_Account, {as: 'username'});
Secretary.belongsTo(User_Account, {as: 'username'});
Doctor.belongsTo(User_Account, {as: 'username'});

const Hospital = database.define('hospital', {
	name: {
		type: Sequelize.STRING,
		allowNull: false,
		primaryKey: true,
	},
	address: {
		type: Sequelize.TEXT,
		allowNull: false,
	},
	type: {
		type: Sequelize.ENUM,
		values: institution_types,
		defaultValue: 'Laboratory',
	},
	active: {
		type: Sequelize.BOOLEAN,
		defaultValue: true,
	},
	contact_numbers: {
		type: Sequelize.ARRAY(Sequelize.STRING),
		allowNull: false,
	}
});

Hospital.belongsTo(SPIS_Instance);

const Patient = database.define('patient', {
	id: {
		type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
	},
	reg_date: {
		type: Sequelize.DATE,
		defaultValue: Sequelize.NOW,
	},
	first_name: {
		type: Sequelize.STRING(30),
		allowNull: false,
		set(val) {
	    	this.setDataValue('first_name', val.toUpperCase());
	    },
		validate: {
			notEmpty: true
		}
	},
	middle_name: {
		type: Sequelize.STRING(30),
		allowNull: false,
		set(val) {
	    	this.setDataValue('middle_name', val.toUpperCase());
	    }
	},
	last_name: {
		type: Sequelize.STRING(30),
		allowNull: false,
		set(val) {
	    	this.setDataValue('last_name', val.toUpperCase());
	    },
	    validate: {
			notEmpty: true
		}
	},
	suffix: {
		type: Sequelize.STRING(10),
		allowNull: true
	},
	sex: {
		type: Sequelize.ENUM,
		values: sex_types,
		allowNull: false
	},
	birthdate: {
		type: Sequelize.DATEONLY,
		allowNull: false
	},
	nationality: {
		type: Sequelize.STRING,
		allowNull: true,
	},
	address: {
		type: Sequelize.STRING,
		allowNull: false,
	}, 
	email: {
		type: Sequelize.STRING(50),
		allowNull: true,
		validate: {
			isValidEmail: function (val) {
				if (val) {
					var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
					if (!re.test(val)) {
						throw new Error("Invalid Email");
					}
				}
			}
		}
	},
	phone_number: {
		type: Sequelize.STRING(20),
		allowNull: true,
	}, 
	alt_cn: { // ALTERNATIVE CONTACT NUMBER
 		type: Sequelize.STRING(20),
		allowNull: true,
	},
	em_cp: { // EMERGENCY CONTACT PERSON
		type: Sequelize.STRING(30),
		allowNull: true,
	},
	rel_emcp: { // RELATIONSHIP OF EMERGENCY PERSON
		type: Sequelize.STRING(20),
		allowNull: true,
	},
	emc_n: { // EMERGENCY CONTACT NUMBER
		type: Sequelize.STRING(20),
		allowNull: true,
	},
	f_allergies: { // ALLERGIES TO FOOD
		type: Sequelize.TEXT,
		allowNull: true,
	},
	m_allergies: { // ALLERGIES TO MEDS
		type: Sequelize.TEXT,
		allowNull: true,
	},
	pers_hh: { // PERSONAL HEALTH HISTORY
		type: Sequelize.TEXT,
		allowNull: true,
	},
	imm_fam_hh: { // IMMEDIATE FAMILY HEALTH HISTORY
		type: Sequelize.TEXT,
		allowNull: true,
	},
	prev_medproc: { // PREVIOUS MEDICAL PROCEDURE
		type: Sequelize.TEXT,
		allowNull: true,
	},
	photo: {
		type: Sequelize.STRING
	},
	gen_notes: {
		type: Sequelize.TEXT,
		allowNull: true,
	},
	referred_by: {
		type: Sequelize.TEXT,
		allowNull: true
	},
	civil_status: {
		type: Sequelize.ENUM,
		values: civil_status_types,
		defaultValue: 'Single',
	},
	hmo: {
		type: Sequelize.STRING,
		allowNull: true,
	},
	hmo_no: {
		type: Sequelize.STRING,
		allowNull: true,
	},
	membership: {
		type: Sequelize.DATEONLY,
		allowNull: true,
	},
	expiration: {
		type: Sequelize.DATEONLY,
		allowNull: true,
	},
	company_name: {
		type: Sequelize.STRING,
		allowNull: true,
	},
	insurance: {
		type: Sequelize.TEXT,
		allowNull: true,
	},
	prior_surgeries: {
		type: Sequelize.TEXT,
		allowNull: true,
	},
	active: {
		type: Sequelize.BOOLEAN,
		defaultValue: true,
	},

});

Patient.belongsTo(SPIS_Instance);

const Check_Up = database.define('check_up', {
	id: {
		type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
	},
	check_up_type: {
		type: Sequelize.ENUM,
		values: check_up_types,
		allowNull: false,
	},
	active: {
		type: Sequelize.BOOLEAN,
		defaultValue: true,
	},
});

const InPatient_Treatment = database.define('inpatient_treatment', {
	conf_date: { // CONFINEMENT DATE
		type: Sequelize.DATEONLY,
		allowNull: false,
	},
	discharge_date: { 
		type: Sequelize.DATEONLY,
		allowNull: true,
	},
	sum_of_diag: { // Summary of Diagnosis
		type: Sequelize.TEXT,
		allowNull: true,
	},
	detailed_diag: { // Detailed Diagnosis
		type: Sequelize.TEXT,
		allowNull: true,
	},
	notes: { // Detailed Diagnosis
		type: Sequelize.TEXT,
		allowNull: true,
	},
	attachments: {
		type: Sequelize.ARRAY(Sequelize.STRING),
		allowNull: true,
	},
	status: {
		type: Sequelize.ENUM,
		values: inpatient_status_types,
		defaultValue: 'Confined'
	},
	active: {
		type: Sequelize.BOOLEAN,
		defaultValue: true,
	},
});

InPatient_Treatment.belongsTo(Check_Up, {as: 'parent_record'});

Hospital.hasMany(Check_Up);
Check_Up.belongsTo(Hospital);
Doctor.hasMany(Check_Up);
Check_Up.belongsTo(Doctor);
Patient.hasMany(Check_Up);
Check_Up.belongsTo(Patient);

const Medication = database.define('medication', {
	name: {
		type: Sequelize.STRING,
		allowNull: false,
	},
	dosage: {
		type: Sequelize.STRING,
		allowNull: false,
	},
	frequency: {
		type: Sequelize.STRING,
		allowNull: false,
	},
	notes: {
		type: Sequelize.TEXT,
		allowNull: true,
	},
	type: {
		type: Sequelize.ENUM,
		values: medication_types,
		allowNull: false,
	}
});

Check_Up.hasMany(Medication, {as: "medication"});
Medication.belongsTo(Check_Up);


const Medical_Procedure = database.define('medical_procedure', {
	date: {
		type: Sequelize.DATEONLY,
		allowNull: false,
	},
	description: {
		type: Sequelize.STRING,
		allowNull: false,
	},
	details: {
		type: Sequelize.TEXT,
		allowNull: false,
	},
	attachments: {
		type: Sequelize.ARRAY(Sequelize.STRING),
		allowNull: true,
	}
});

Check_Up.hasMany(Medical_Procedure, {as: "medical_procedure"});
Medical_Procedure.belongsTo(Check_Up);

const OutPatient_Treatment = database.define('outpatient_treatment', {

	date: {
		type: Sequelize.DATEONLY,
		allowNull: false,
	},
	sum_of_diag: { // Summary of Diagnosis
		type: Sequelize.TEXT,
		allowNull: true,
	},
	detailed_diag: {
		type: Sequelize.TEXT,
		allowNull: true,
	},
	notes: {
		type: Sequelize.TEXT,
		allowNull: true,
	},
	attachments: {
		type: Sequelize.ARRAY(Sequelize.STRING),
		allowNull: true,
	},
	active: {
		type: Sequelize.BOOLEAN,
		defaultValue: true,
	},
});

OutPatient_Treatment.belongsTo(Check_Up, {as: 'parent_record'});

const Laboratory = database.define('laboratory', {
	date: {
		type: Sequelize.DATEONLY,
		allowNull: false
	},
	description: {
		type: Sequelize.STRING,
		allowNull: true
	},
	notes: {
		type: Sequelize.TEXT,
		allowNull: true
	},
	attachments: {
		type: Sequelize.ARRAY(Sequelize.STRING),
		allowNull: true
	},
	active: {
		type: Sequelize.BOOLEAN,
		defaultValue: true,
	},
});

Patient.hasMany(Laboratory);
Hospital.hasMany(Laboratory);

const Billing_Item = database.define('billing_item', {
	description: {
		type: Sequelize.STRING,
		allowNull: false
	},
	amount: {
		type: Sequelize.FLOAT,
		allowNull: false,
		defaultValue: 0
	}
});

const Billing = database.define('billing');

Laboratory.hasOne(Billing, {as: 'receipt'});
Billing.hasMany(Billing_Item, {as: 'billing_items', onDelete: 'CASCADE'});
Check_Up.hasOne(Billing, {as: 'receipt'});

const Consultation = database.define('consultation', {
	date: {
		type: Sequelize.DATEONLY,
		allowNull: false
	},
	sum_of_diag: { // Summary of Diagnosis
		type: Sequelize.TEXT,
		allowNull: true,
	},
	detailed_diag: { // Detailed Diagnosis
		type: Sequelize.TEXT,
		allowNull: true,
	},
	notes: { // Detailed Diagnosis
		type: Sequelize.TEXT,
		allowNull: true,
	},
	attachments: {
		type: Sequelize.ARRAY(Sequelize.STRING),
		allowNull: true,
	},
	active: {
		type: Sequelize.BOOLEAN,
		defaultValue: true,
	},
	queue_no: {
		type: Sequelize.INTEGER,
		allowNull: true,
		defaultValue: null,
	},
	status: {
		type: Sequelize.ENUM,
		values: queue_status_types,
		allowNull: true,
		defaultValue: null,
	}
});

Consultation.belongsTo(Check_Up, {as: 'parent_record'});

// database.sync();

// Superuser.sync({ force: true }).then(function () {
// 	Superuser.create({
// 		id: 'sayunsuperuser',
// 		password: 's@yun',
// 		contact_number: ['+639062494175'],
// 		email: 'sales@sayunsolutions.com'
// 	}).then(superuser => {
// 		console.log("Super User Added Successfully.")
// 	}).catch(function(error) {
// 		console.log(error);
// 	});
// });

module.exports.Hospital = Hospital
module.exports.User_Account = User_Account;
module.exports.Doctor = Doctor;
module.exports.Admin = Admin;
module.exports.Secretary = Secretary;
module.exports.Superuser = Superuser;
module.exports.SPIS_Instance = SPIS_Instance;
module.exports.Patient = Patient;
module.exports.InPatient_Treatment = InPatient_Treatment;
module.exports.OutPatient_Treatment = OutPatient_Treatment;
module.exports.Laboratory = Laboratory;
module.exports.Check_Up = Check_Up;
module.exports.Medication = Medication;
module.exports.Medical_Procedure = Medical_Procedure;
module.exports.title_types = title_types;
module.exports.Consultation = Consultation;
module.exports.Billing = Billing;
module.exports.Billing_Item = Billing_Item;