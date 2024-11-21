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

const notLoggedInMiddleware = (req, res, next) => {
  if (res.locals.loggedIn) {
    res.redirect("/");
  } else {
    next();
  }
};

const loggedInMiddleware = (req, res, next) => {
  if (!res.locals.loggedIn) {
    res.redirect("/auth/login");
  } else {
    next();
  }
}

router.get("/", checkAuthMiddleware,	async (req, res) => {
	res.render("adminIndex", {title: "Index"});	
});

router.get("/auth/login", notLoggedInMiddleware, (req, res) => {
  res.render("adminLogin", { title: "Login" });
});

router.post("/auth/login", notLoggedInMiddleware, async (req, res) => {
  const { user, password } = req.body;
  if (!user || !password) {
    res.status(400).json({ error: "Missing required fields", success: false });
    return;
  } else {
    try {
      const response = await fetch(process.env.API_URL + "admin/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user: user,
          password: password,
        }),
        timeout: 5000,
      });
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};
      if (data.success) {
        res.cookie("auth", data.jwt, { httpOnly: true });
        res.locals.loggedIn = true;
        res.redirect("/?message=Successfully logged in");
      } else {
        res.clearCookie("auth");
        res.locals.loggedIn = false;
        res.render("/?message=Error");
      }
    } catch (error) {
      console.error("Error:", error);
      res.status(500).json({ error: "An error occurred; " + error });
    }
  }
});

router.use((req, res, next) => {
  res.status(404).send("404 not found");
});


module.exports = router;