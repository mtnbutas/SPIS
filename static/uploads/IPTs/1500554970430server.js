//Module Dependencies
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const consolidate = require('consolidate');
const database = require('./database');
const session = require('express-session');
const flash = require('express-flash');
const nunjucks = require('nunjucks');
const Doctor = require('./models').Doctor;
const User_Account = require('./models').User_Account;

const port = 8000;
var app = express(),
	http = require('http'),
	server = http.createServer(app),
	io = require('socket.io').listen(server);

server.listen(port, function() {
	console.log('SPIS: Server Running!');
});

app.set('views', __dirname + '/views');
app.use('/static', express.static(__dirname + '/static'));
app.use('/uploads/avatars', express.static(__dirname + '/uploads/avatars'));
app.use('/uploads/signatures', express.static(__dirname + '/uploads/signatures'));
app.use('/uploads/patients', express.static(__dirname + '/uploads/patients'));
app.engine('html', consolidate.nunjucks);

nunjucks.configure(app.get('views'), {
    autoescape: true,
    noCache: true,
    watch: true,
    express: app
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser('secret-cookie'));
app.use(session({ secret: 'secret-cookie', cookie: { httpOnly: false } }));
app.use(flash());

///////////////////// MODULE ROUTES ////////////////////////

app.use(require('./routes-user-auth'));
app.use(require('./routes-accounts'));
app.use(require('./routes-hospital'));
app.use(require('./routes-spis-instance'));
app.use(require('./routes-patient'));
app.use(require('./routes-inpatient-treatment'));
app.use(require('./routes-outpatient-treatment'));
app.use(require('./routes-laboratories'));
app.use(require('./routes-consultations'));
app.use(require('./routes-daily-consultation'));

///////////////////// MIDDLEWARES ////////////////////////

function requireLoggedIn(req, res, next) {
	const currentInstance = req.session.spisinstance;
	const currentUser = req.session.user;
	if(!currentUser || !currentInstance) {
		return res.redirect('/login');
	}
	next();
}


app.get('/', requireLoggedIn, 
	function (req, res, next) {
		if (req.session.superuser) {
			return res.redirect('/account_list');
		}
		next();
	},
	function (req, res) {
		const firstDoctor = null;
		const currentUser = req.session.user;
		if(req.session.secretary) {
			Doctor.findOne({
				raw: true,
				include: [{
					model: User_Account,
					as: 'username',
					required: true,
					where: {
						spisInstanceLicenseNo: req.session.spisinstance.license_no
					}
				}]
			}).then(oneDoctor => {
				res.render('account/home.html', {
					user: currentUser,
					doctor: req.session.doctor,
					secretary: req.session.secretary,
					admin : req.session.admin,
					superuser: req.session.superuser,
					firstDoctor: oneDoctor.usernameId
				});
			});
		}
		else {
			res.render('account/home.html', {
				user: currentUser,
				doctor: req.session.doctor,
				secretary: req.session.secretary,
				admin : req.session.admin,
				superuser: req.session.superuser
			});
		}
	}
);