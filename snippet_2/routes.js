// lib/auth/routes.js

var bcrypt = require('bcrypt-nodejs');
var base32 = require('thirty-two');
var utils = require('../common/js/utils.js');
var dbFn = require('../common/js/dbfunctions.js');
var emailFn = require('../common/js/emailfunctions.js');
var path = require('path');
const totp = require('notp').totp;
const htmlPath = path.join(__dirname, 'html');
const fs = require('fs');

// JWT
const jwt = require('jsonwebtoken');

// Token's Blacklist
const blacklist = require('../common/js/blacklist.js');

const logger = require('winston');
const KtfLib = require(process.env.KTFLIBPATH);
const JWTPTE = fs.readFileSync('./jwtkey', 'utf8');
const JWTPUB = fs.readFileSync('./jwtkey.pub', 'utf8');
const JWTNET = process.env.JWT_NETWORK;

let appCFG = require('../common/config/server-config.js');

// Cookie & Token Time-To-Live (TTL)
let userCookieTTL = appCFG.userCookieTTL // 3 minutes
let tokenTTL = appCFG.tokenTTL // dev: 15mins, test: 30mins, prod: 15mins

// URLs of all rest servers
let authServer = appCFG.authServer;
let exporterServer = appCFG.exporterServer;
let importerServer = appCFG.importerServer;
let financierServer = appCFG.financierServer;
let logisticsServer = appCFG.logisticsServer;
let platformServer = appCFG.platformServer;
let inspector1Server = appCFG.inspector1Server;
let inspector2Server = appCFG.inspector2Server;

module.exports = function (app, server) {
	app.use('/*', validateToken);

	// HOME PAGE
	app.get('/', function (req, res) {
		logger.info('GET: /');
		res.sendFile(htmlPath+'/index.html');
	});

	// LOGIN
	// Show Login Form
	app.get('/login', function (req, res) {
		logger.info('GET: /login');
		res.sendFile(htmlPath+'/login.html');
	});


	// Verify Login
	app.post('/login', function(req, res){
		logger.info('POST: /login');

		let username = req.body.username;
		let acctRole = req.body.acctRole;
		let pw = req.body.password;

		dbFn.findUserByUsername(username, acctRole, function (err, obj) {
			if (err) {
				res.redirect('/login');
			}

			if (obj) {
				if(obj.status == 'INACTIVE') {
					// INACTIVE account
					res.json({login: false, msg: 'Incorrect username or password'});
				}
				else {
					if (!bcrypt.compareSync(pw, obj.password)) {
						// Invalid password
						res.json({login: false, msg: 'Incorrect username or password'});
					} else {
						res.cookie('user', {id: obj.id, username: username, acctRole: acctRole}, {maxAge: userCookieTTL, httpOnly: true});
						res.json({login: true});
					}
				}
			} else {
				// Invalid username
				res.json({login: false, msg: 'Incorrect username or password'});
			}
		});
	});

	// 2FA LOGIN
	// Show 2FA page
	app.get('/login-otp', function (req, res) {
		logger.info('GET: /login-otp');

		res.sendFile(htmlPath+'/login-otp.html');
	});

	// Generate QR image
	app.get('/qr-image', function (req, res) {
		logger.info('GET: /qr-image');

		let user = req.cookies.user; // Temporary

		dbFn.findKeyForUsername(user.acctRole, user.username, function (err, obj) {
			if (err) { 
				res.redirect('/login'); 
			}

			if (obj) {
				// Two-factor auth has already been setup but no first totp verification is done
				if(obj.verified == 'false'){
					var encodedKey = obj.value;

					// generate QR code for scanning into Google Authenticator
					// reference: https://github.com/google/google-authenticator/wiki/Key-Uri-Format
					var otpUrl = 'otpauth://totp/Kommerce:' + user.username+ '-' + user.acctRole
						+ '?secret=' + encodedKey + '&period=' + (obj.period || 30) + '&issuer=Kommerce';

					res.json({otpUrl: otpUrl});
				} else {
					res.json({otpUrl: null});
				}
			} else {
				// New two-factor setup.  generate and save a secret key
				var key = utils.randomKey(50);
				var encodedKey = base32.encode(key);

				// generate QR code for scanning into Google Authenticator
				// reference: https://github.com/google/google-authenticator/wiki/Key-Uri-Format
				var otpUrl = 'otpauth://totp/Kommerce:' + user.username+ '-' + user.acctRole
					+ '?secret=' + encodedKey + '&period=30&issuer=Kommerce';

				dbFn.saveKeyForUserId(user.acctRole, user.username, encodedKey, 30, function (err) {
					if (err) {
						res.redirect('/login');  
					}

					res.json({otpUrl: otpUrl});
				});
			}
		});
	});

	// Verify 2FA
	app.post('/login-otp', function(req, res){
		logger.info('POST: /login-otp');

		let otpCode = req.body.otpCode;
		let id = req.cookies.user.id;
		let username = req.cookies.user.username;
		let acctRole = req.cookies.user.acctRole;
		let jwtID = 'auth'+utils.getRandomInt(0, 99999);
		let cookieName = dbFn.getDBTableName(acctRole)+'_authtoken';

		dbFn.findKeyForUsername(acctRole, username, function (err, obj) {
			if (err) {
				res.json({twofa: false, msg: "Invalid one-time code"}); 
			}

			if (obj) {
				let key = base32.decode(obj.value);

				//Verify totp submitted by user
				let verifyOTP = totp.verify(otpCode, key);

				if (verifyOTP) {
					// If 2FA login success, generate json web token with 15 minutes time-to-live
					let authToken = jwt.sign({ "id": id, "username": username, "acctRole": acctRole, "network": JWTNET }, JWTPTE, {expiresIn: tokenTTL, jwtid: jwtID, algorithm: 'RS256'});

					res.clearCookie('user');
					let redirectURL = getRestServerUrl(acctRole);

					if (obj.verified == 'true') {
						// Redirect to the respective rest-server
						res.json({twofa: true, token: authToken, url: redirectURL});
					} else {
						dbFn.updateKeyForUsername(acctRole, username, function(err, obj) {
							if (err) {
								res.json({twofa: false, msg: "Invalid one-time code"});
							}

							// Redirect to the respective rest-server
							res.json({twofa: true, token: authToken, url: redirectURL});
						})
					}
				} else {
					// Verification of One-time password failed
					res.json({twofa: false, msg: "Invalid one-time code"});
				}
			}
		});
	});

	// TOKEN REFRESH
	app.post('/refresh', function (req, res) {
		logger.info('POST: /refresh');

		var cookieName;

		if(req.headers.referer) {
			cookieName = getCookieNameFromDomain(req.headers.referer);
		}

		let token = req.headers.cookie.split(cookieName+'=')[1];

		jwt.verify(token, JWTPUB, { algorithm: 'RS256' }, function(error, decodedToken) {
			let id = decodedToken.id;
			let username = decodedToken.username;
			let acctRole = decodedToken.acctRole;
			let jwtID = 'auth'+utils.getRandomInt(1, 99999);
			let currentTime = utils.getCurrentSeconds();

			if(currentTime < decodedToken.exp) {
				let ttl = decodedToken.exp - currentTime;

				blacklist.set(decodedToken.jti, ttl);
			}

			let authToken = jwt.sign({ "id": id, "username": username, "acctRole": acctRole, "network": JWTNET }, JWTPTE, {expiresIn: tokenTTL, jwtid: jwtID, algorithm: 'RS256'});

			res.json({success: true, token: authToken});
		});
	});

	// SIGNUP
	// Show Signup Form
	app.get('/signup', function (req, res) {
		logger.info('GET: /signup');

		res.sendFile(htmlPath+'/signup.html');
	});

	// Verify Signup
	app.post('/signup', function (req, res, next) {
		logger.info('POST: /signup');

		var emailVerifyCode = base32.encode(utils.randomKey(50));
		var acctRole = req.body.acctRole;

		//If password complexity is not met
		if(!utils.checkPWComplexity(req.body.password)) {
			res.json({success: false, msg: 'Your password does not meet the requirements (At least 8 characters with a mix of upper, lower cases, number and symbols)'});
		}
		//If password complexity is met
		else {
			switch (acctRole) {
				case 'Importer':
					dbFn.insertAcctReq(req.body.username, req.body.password, acctRole, req.body.region, emailVerifyCode, function (err, obj) {
						if (err) { 
							res.json({success: false, msg: 'Unsuccessful Registration'});
						}

						if (obj) {
							emailFn.sendEmailVCode(obj.reqId, req.body.username, emailVerifyCode);
							res.json({success: true, msg: 'Successful Registration'});
						}
					});
					break;
				case 'Exporter':
				case 'Financier':
				case 'Logistics':
				case 'Inspector1':
				case 'Inspector2':
					dbFn.insertAcctReq(req.body.username, req.body.password, acctRole, null, emailVerifyCode, function (err, obj) {
						if (err) {
							res.json({success: false, msg: 'Unsuccessful Registration'});
						}

						if (obj) {
							emailFn.sendEmailVCode(obj.reqId, req.body.username, emailVerifyCode);
							res.json({success: true, msg: 'Successful Registration'});
						}
					});
					break;
				case 'Platform':
					//Insert into platform table (temporary until further discussion on registering of platform accounts)
					dbFn.insertUser(req.body.username, req.body.password, acctRole, null, async function (err, obj) {
						if (err) { 
							res.json({success: false, msg: 'Unsuccessful Registration'});
						}

						var composerConnection = await KtfLib.createConnection()
												.catch((err) => {
													res.status(400).send("Error");
													logger.error(err);
													return;
												});

						// Create corresponding platform record in fabric
						await composerConnection.adminCreatePlatform(obj.id)
						.catch((err)=>{
							res.status(400).send("Error");
							logger.error(err);
							return;
						});

						await composerConnection.disconnect();

						res.json({success: true, msg: 'Successful Registration'});

					});
					break;
			}

		} // End of password complexity else statement
	});

	// EMAIL VERIFICATION
	app.get('/verify-email', function (req, res, next) {
		logger.info('GET: /verify-email');
		dbFn.findAcctReqByIdEmailVCode(req.query.id, req.query.vcode, function (err, obj) {
			if (err) {
				res.redirect('/');
			}

			if (obj) {
				dbFn.updateAcctReqEmailVerified(obj.reqId, function (err, obj) {
					if (err) {
						res.redirect('/'); 
					}

					res.redirect('/?msg=Email Verified');
				});
			}
		});
	});

	// LOGOUT
	app.post('/logout', function (req, res, next) {
		logger.info('POST: /logout');
		var cookieName;

		if(req.headers.referer) {
			cookieName = getCookieNameFromDomain(req.headers.referer);
		}

		let token = req.headers.cookie.split(cookieName+'=')[1];
		let currentTime = utils.getCurrentSeconds();

		jwt.verify(token, JWTPUB, { algorithm: 'RS256' }, function(error, decodedToken) {
			if(error) {
				return res.status(401).send({ "err": "Invalid session" });
			}

			if(currentTime < decodedToken.exp) {
				let ttl = decodedToken.exp - currentTime;

				blacklist.set(decodedToken.jti, ttl);
			}

			res.clearCookie(cookieName);
			res.status(200).send();
		});
	});

	// CHANGING OF ACCOUNT'S PASSWORD
	// Verify changing of password
	app.post('/changepw', function(req, res) {
		logger.info('POST: /changepw');

		var cookieName;

		if(req.headers.referer) {
			cookieName = getCookieNameFromDomain(req.headers.referer);
		}

		let token = req.headers.cookie.split(cookieName+'=')[1];
		let currentTime = utils.getCurrentSeconds();

		jwt.verify(token, JWTPUB, { algorithm: 'RS256' }, function(error, decodedToken) {
			dbFn.findUserByUsername(decodedToken.username, decodedToken.acctRole, function (err, result) {
				if(err) {
					res.json({success: false, msg:'Your account password has not been successfully updated'});
				}

				if(result) {
					// If password complexity is not met
					if(!utils.checkPWComplexity(req.body.confirmpw)) {
						res.json({success: false, msg:'Your new password does not meet the requirements (At least 8 chracters with a mix of upper, lower cases, number and symbols)'});
					}
					// If password complexity is met
					else {

						// Current password field does not equal to the existing password from the database
						if(!bcrypt.compareSync(req.body.curpw, result.password)) {
							res.json({success: false, msg:'Incorrect current password, please enter your passwords again'});
						}
						// Current password field equal to the existing password from the database
						else {
							if(req.body.curpw == req.body.newpw && req.body.curpw == req.body.confirmpw) {
								res.json({success: false, msg:'Please ensure your new password is different from your current password'});
							}
							else if(req.body.newpw == req.body.confirmpw) {
								//Update password of a user
								dbFn.updateUserPassword(req.body.confirmpw, result.username, result.acctRole, function(err, result) {
									if(err) {
										res.json({success: false, msg:'Your account password has not been successfully updated'});
									}

									if(result) {
										if(currentTime < decodedToken.exp) {
											let ttl = decodedToken.exp - currentTime;

											// Invalidate token
											blacklist.set(decodedToken.jti, ttl);

											// Remove cookie from client
											res.clearCookie(cookieName);
										}

										res.json({success: true, msg:'Your account password has been successfully updated, please login again', redirectURL: authServer+'/login'});
									} else {
										res.json({success: false, msg:'Your account password has not been successfully updated'});
									}
								})
							}
						}

					}
				}
			})
		});
	});

	// POPULATE REGIONS DROPDOWN LIST
	app.get('/regions', async function (req, res) {
		logger.info('GET: /regions');
		var composerConnection = await KtfLib.createConnection();

		let regionList = await composerConnection.getRegions()
			.catch((err) => {
				res.status(400).send("Error");
				logger.error(err);
				return;
			});

		await composerConnection.disconnect()
			.catch((err) => {
				res.status(400).send("Error");
				logger.error(err);
				return;
			});

		res.send(regionList);
	});
};

// JWT Helper functions
function validateToken(req, res, next) {
	logger.info('JWT Helper: validateToken');
	var nonsecured = ["/", "/signup", "/login", "/login-otp", "/verify-email", "/regions"];
	var secured = ["/changepw", "/refresh", "/logout"];
	var cookieName;

	if(req.headers.referer) {
		cookieName = getCookieNameFromDomain(req.headers.referer);
	}

	let token = req.cookies[cookieName];
	let user = req.cookies.user;

	if (token) {
		jwt.verify(token, JWTPUB, {algorithm: 'RS256'}, function(error, decodedToken) {
			// Invalid Token
			if(error) {
				next();
			}
			// Valid Token
			else {
				// Check for blacklisted tokens (logged out/invalidated tokens)
				blacklist.get(decodedToken.jti, function (err, val) {
					// Token is logged out/invalidated
					if(val) {
						if(nonsecured.includes(req.originalUrl)) {
							next();
						} else {
							res.redirect('/login');
						}
					}
					// Token is authorized
					else {
						let redirectURL = getRestServerUrl(decodedToken.acctRole);

						if(secured.includes(req.originalUrl)) {
							next();
						} else {
							return res.redirect(redirectURL);
						}
					}
				});
			}
		});
	} else {
		if(req.originalUrl == "/login-otp") {
			if(user) {
				next();
			} else {
				return res.redirect('/login');
			}
		} else {
			next();
		}
	}
}

// Rest-server URLs according to account role
function getRestServerUrl (acctRole) {
	var restUrl;

	switch (acctRole) {
		case 'Exporter':
			restUrl = exporterServer+"/main/home";
			break;
		case 'Importer':
			restUrl = importerServer+"/main/home";
			break;
		case 'Financier':
			restUrl = financierServer+"/main/home";
			break;
		case 'Logistics':
			restUrl = logisticsServer+"/main/home";
			break;
		case 'Inspector1':
			restUrl = inspector1Server+"/main/home";
			break;
		case 'Inspector2':
			restUrl = inspector2Server+"/main/home";
			break;
		case 'Platform':
			restUrl = platformServer+"/main/home";
			break;
	}

	return restUrl;
}

//Determine prefix of cookie name from request domain
function getCookieNameFromDomain (domain) {
	var name;
	let protocol = domain.split('//')[0] + '//'; // Gives http:// or https://

	domain = domain.split('//')[1].split('/')[0]; // Gives the domain name like localhost:8050

	// Insert protocol back into the domain string
	domain = protocol + domain; // Gives http://localhost:8050 or https://localhost:8050

	switch (domain) {
		case exporterServer:
			name = 'exporters_authtoken';
			break;
		case importerServer:
			name = 'importers_authtoken';
			break;
		case financierServer:
			name = 'financiers_authtoken';
			break;
		case logisticsServer:
			name = 'logistics_authtoken';
			break;
		case platformServer:
			name = 'platform_authtoken';
			break;
		case inspector1Server:
			name = 'inspector1_authtoken';
			break;
		case inspector2Server:
			name = 'inspector2_authtoken';
			break;
	}

	return name;
}
