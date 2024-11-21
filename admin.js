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

router.get("/", async (req, res) => {
	res.render("adminIndex", {title: "Index"});	
});

router.use((req, res, next) => {
  res.text("404 not found");
});


module.exports = router;
