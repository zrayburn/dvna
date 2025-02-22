var db = require('../models')
var bCrypt = require('bcrypt')
const exec = require('child_process').exec;
var mathjs = require('mathjs')
var libxmljs = require("libxmljs");
var serialize = require("node-serialize")
var validator = require('validator');
const Op = db.Sequelize.Op

module.exports.userSearch = function (req, res) {
	if (!validator.isAlphanumeric(req.body.login)){
		req.flash('warning', 'No Hackers Allowed')
		res.render('app/usersearch', {
				output: null
			})
	}
	var query = "SELECT name,id FROM Users WHERE login='" + req.body.login + "'"; // Attempt to fix SQLi
	db.sequelize.query(query, {
		model: db.User
	}).then(user => {
		if (user.length) {
			var output = {
				user: {
					name: user[0].name,
					id: user[0].id
				}
			}
			res.render('app/usersearch', {
				output: output
			})
		} else {
			req.flash('warning', 'User not found')
			res.render('app/usersearch', {
				output: null
			})
		}
	}).catch(err => {
		req.flash('danger', 'Internal Error')
		res.render('app/usersearch', {
			output: null
		})
	})
}

module.exports.ping = function (req, res) {
	if (!validator.isIP(req.body.address)){ // Block anything that doesn't validate as an IP
		res.render('app/ping', {
				output: "No Hackers!!!"
			})
	}
	exec('ping -c 2 ' + req.body.address, function (err, stdout, stderr) {
		output = stdout + stderr
		res.render('app/ping', {
			output: output
		})
	})
}

module.exports.listProducts = function (req, res) {
	db.Product.findAll().then(products => {
		output = {
			products: products
		}
		res.render('app/products', {
			output: output
		})
	})
}

module.exports.productSearch = function (req, res) {
	db.Product.findAll({
		where: {
			name: {
				[Op.like]: '%' + req.body.name + '%'
			}
		}
	}).then(products => {
		output = {
			products: products,
			// Block reflected XSS by escaping html tags, no SQLi possible.
			searchTerm: validator.escape(req.body.name)
		}
		res.render('app/products', {
			output: output
		})
	})
}

module.exports.modifyProduct = function (req, res) {
	if (!req.query.id || req.query.id == '') {
		output = {
			product: {}
		}
		res.render('app/modifyproduct', {
			output: output,
			csrfToken: req.csrfToken()
		})
	} else {
		db.Product.find({
			where: {
				'id': req.query.id
			}
		}).then(product => {
			if (!product) {
				product = {}
			}
			output = {
				product: product
			}
			res.render('app/modifyproduct', {
				output: output,
				csrfToken: req.csrfToken()
			})
		})
	}
}

module.exports.modifyProductSubmit = function (req, res) {
	if (!req.body.id || req.body.id == '') {
		req.body.id = 0
	}
	db.Product.find({
		where: {
			'id': req.body.id
		}
	}).then(product => {
		if (!product) {
			product = new db.Product()
		}
		// Block stored XSS in products DB
		product.code = validator.escape(req.body.code)
		product.name = validator.escape(req.body.name)
		product.description = validator.escape(req.body.description)
		product.tags = validator.escape(req.body.tags)
		product.save().then(p => {
			if (p) {
				req.flash('success', 'Product added/modified!')
				res.redirect('/app/products')
			}
		}).catch(err => {
			output = {
				product: product
			}
			req.flash('danger',err)
			res.render('app/modifyproduct', {
				output: output,
				csrfToken: req.csrfToken()
			})
		})
	})
}

module.exports.userEdit = function (req, res) {
	res.render('app/useredit', {
		userId: req.user.id,
		userEmail: req.user.email,
		userName: req.user.name,
		csrfToken: req.csrfToken()
	})
}

module.exports.userEditSubmit = function (req, res) {
	db.User.find({
		where: {
			'id': req.body.id
		}		
	}).then(user =>{
		// Check if the session user id matches what they are trying to modify
		// https://www.npmjs.com/package/passport populates req.body.id in middleware but it can be modified in post
		if (req.session.passport.user != req.body.id){
			req.flash('warning', 'No hackers')
			res.render('app/useredit', {
				userId: null,
				userEmail: null,
				userName: null,
				csrfToken: req.csrfToken()
			})
			return
		}
		if(req.body.password.length>0){
			if(req.body.password.length>0){
				if (req.body.password == req.body.cpassword) {
					user.password = bCrypt.hashSync(req.body.password, bCrypt.genSaltSync(10), null)
				}else{
					req.flash('warning', 'Passwords dont match')
					res.render('app/useredit', {
						userId: req.user.id,
						userEmail: req.user.email,
						userName: req.user.name,
						csrfToken: req.csrfToken()
					})
					return		
				}
			}else{
				req.flash('warning', 'Invalid Password')
				res.render('app/useredit', {
					userId: req.user.id,
					userEmail: req.user.email,
					userName: req.user.name,
					csrfToken: req.csrfToken()
				})
				return
			}
		}
		user.email = req.body.email
		user.name = req.body.name
		user.save().then(function () {
			req.flash('success',"Updated successfully")
			res.render('app/useredit', {
				userId: req.body.id,
				userEmail: req.body.email,
				userName: req.body.name,
				csrfToken: req.csrfToken()
			})
		})
	})
}

module.exports.redirect = function (req, res) {
	// Super simple method, would be better with verifying it is a valid endpoint
	if (req.query.url && validator.isAlphanumeric(req.query.url)) { 
		res.redirect(req.query.url)
	} else {
		res.send('invalid redirect url')
	}
}

module.exports.calc = function (req, res) {
	if (req.body.eqn) {
		res.render('app/calc', {
			output: mathjs.eval(req.body.eqn)
		})
	} else {
		res.render('app/calc', {
			output: 'Enter a valid math string like (3+3)*2'
		})
	}
}

module.exports.listUsersAPI = function (req, res) {
	db.User.findAll({}).then(users => {
		res.status(200).json({
			success: true,
			users: users
		})
	})
}

module.exports.bulkProductsLegacy = function (req,res){
	// TODO: Deprecate this soon
	if(req.files.products){
		var products = JSON.parse(req.files.products.data.toString('utf8'))
		products.forEach( function (product) {
			var newProduct = new db.Product()
			// This endpoint would allow stored XSS as well, block
			newProduct.name = validator.escape(product.name)
			newProduct.code = validator.escape(product.code)
			newProduct.tags = validator.escape(product.tags)
			newProduct.description = validator.escape(product.description)
			newProduct.save()
		})
		res.redirect('/app/products')
	}else{
		res.render('app/bulkproducts',{messages:{danger:'Invalid file'},legacy:true})
	}
}

module.exports.bulkProducts =  function(req, res) {
	if (req.files.products && req.files.products.mimetype=='text/xml'){
		// noent enables entity parsing? Switch to false to block XXE
		// Ref: https://github.com/libxmljs/libxmljs/blob/23da4cf9eca569a37cc36a26977fa7ab0b53d875/src/xml_document.cc#L286
		var products = libxmljs.parseXmlString(req.files.products.data.toString('utf8'), {noent:false,noblanks:true})
		products.root().childNodes().forEach( product => {
			var newProduct = new db.Product()
			// Block stored XSS within bulk products
			newProduct.name = validator.escape(product.childNodes()[0].text())
			newProduct.code = validator.escape(product.childNodes()[1].text())
			newProduct.tags = validator.escape(product.childNodes()[2].text())
			newProduct.description = validator.escape(product.childNodes()[3].text())
			newProduct.save()
		})
		res.redirect('/app/products')
	}else{
		res.render('app/bulkproducts',{messages:{danger:'Invalid file'},legacy:false})
	}
}
