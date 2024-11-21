const ejs = require("ejs");
const express = require("express");
require("dotenv").config();
const fetch = require("node-fetch");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const multer = require("multer");;
const path = require("path");
const db = require("./db");

var router = express.Router();

const checkAuthMiddleware = (req, res, next) => {
  const token = req.cookies.auth;
  req.jwt = token;
  res.locals.jwt = token;
  res.locals.url = process.env.URL_ENTIRE;
  res.locals.message = req.query.message || res.locals.message ||  undefined;
  res.locals.ip = process.env.SERVER_IP;
  res.locals.dns = process.env.DNS_URL;

  if (!token) {
    res.locals.loggedIn = false;
    return next();
  }

  jwt.verify(token, process.env.AUTH_SECRET, async (err, decoded) => {
    if (err) {
      res.locals.loggedIn = false;
    } else {
      var user = await db.findUserById(await decoded.id);
      if (!user) {
      	res.clearCookie("auth");
        res.redirect("/?message=Invalid auth cookie");
      } else {
      	res.locals.loggedIn = true;
      	res.locals.user = await user;
      	req.user = await user;
      }
    }
    next();
  });
};

router.get("/", checkAuthMiddleware,	async (req, res) => {
	res.render("adminIndex", {title: "Index"});	
});

router.use((req, res, next) => {
  res.status(404).send("404 not found");
});


module.exports = router;
