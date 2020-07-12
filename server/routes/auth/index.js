var express = require("express");
var authRouter = express.Router();
var auth = require('../../auth/index');
var dbIndex = require('../../db/index')

authRouter.post('/AdminSignUp', function (req, res) {
	dbIndex.createNewUser("N/A", req.body.company, req.body.first_name, req.body.last_name, 
		req.body.email, req.body.password, true).then((result) => {
			res.jsonp({success: result});
    }).catch((error) => {
		console.log(error);
        res.jsonp({success: false});
    });
});

module.exports = {authRouter};