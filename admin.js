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

app.use(cookieParser());
app.set("view engine", "ejs");
app.set("views", "views");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.get("/", async (req, res) => {
	res.render("adminIndex");	
});

router.use((req, res, next) => {
  res.status(404).text("404 not found"));
});


module.exports = router;
