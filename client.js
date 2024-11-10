const ejs = require("ejs");
const express = require("express");
require("dotenv").config();
const fetch = require("node-fetch");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();
const port = 8080;

const checkAuthMiddleware = (req, res, next) => {
  const token = req.cookies.auth;
  req.jwt = token;
  res.locals.jwt = token;

  if (!token) {
    res.locals.loggedIn = false;
    return next();
  }

  jwt.verify(token, process.env.AUTH_SECRET, (err, decoded) => {
    if (err) {
      res.locals.loggedIn = false;
    } else {
      res.locals.loggedIn = true;
      res.locals.user = { id: decoded.id };
    }
    next();
  });
};

const notLoggedInMiddleware = (req, res, next) => {
  const token = req.cookies.auth;
  if (!token) {
    res.locals.loggedIn = false;
    next();
  } else {
    jwt.verify(token, process.env.AUTH_SECRET, (err, decoded) => {
      if (err) {
        res.locals.loggedIn = false;
        next();
      } else if (decoded) {
        res.locals.loggedIn = true;
        user = { id: decoded.id };
        return res.redirect("/");
      } else {
        res.locals.loggedIn = false;
        next();
      }
    });
  }
};

app.use(cookieParser());
app.use(checkAuthMiddleware);

app.set("view engine", "ejs");
app.set("views", "views");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.render("index", { title: "Home" });
});

app.post("/auth/register", notLoggedInMiddleware, (req, res) => {
  const { username, password, email } = req.body;
  if (!username || !password || !email) {
    res.status(400).json({ error: "Missing required fields", success: false });
    return;
  } else {
    fetch(process.env.API_URL + "auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: username,
        password: password,
        email: email,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          res.cookie("auth", data.jwt, { httpOnly: true });
          res.redirect("index", { message: data.message, title: "Home" });
        } else {
          res.status(400).json({ error: data.error, success: data.success });
        }
      })
      .catch((error) => {
        console.error("Error:", error);
        res.status(500).json({ error: "An error occurred; " + error });
      });
  }
});

app.get("/auth/login", notLoggedInMiddleware, (req, res) => {
  res.render("login", { title: "Login" });
});

app.post("/auth/login", notLoggedInMiddleware, async (req, res) => {
  const { user, password } = req.body;
  if (!user || !password) {
    res.status(400).json({ error: "Missing required fields", success: false });
    return;
  } else {
    try {
      const response = await fetch(process.env.API_URL + "auth/login", {
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
        res.redirect("/");
      } else {
        res.clearCookie("auth");
        res.locals.loggedIn = false;
        res.render("login", { message: data.error, title: "Login" });
      }
    } catch (error) {
      console.error("Error:", error);
      res.status(500).json({ error: "An error occurred; " + error });
    }
  }
});

app.get("/auth/logout", (req, res) => {
  res.clearCookie("auth");
  res.redirect("/");
});

app.get("/dashboard", async (req, res) => {
    fetch(`${process.env.API_URL}file?apiKey=${req.jwt}&dir=${req.query.dir || ""}`)
    .then((response) => response.text())
    .then((data) => {
      res.render("dashboard", {
        title: "Dashboard",
        files: JSON.stringify(data),
      });
    })
    .catch((error) => {
      console.error("Error:", error);
      res.status(500).json({ error: "An error occurred; " + error });
    });
});

app.post("/dashboard/upload", async (req, res) => {
  const { file, dir } = req.body;
  fetch(`${process.env.API_URL}file/upload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      file: file,
      apiKey: req.jwt,
      dir: dir,
    }),
  })
    .then((response) => response.text())
    .then((data) => {
      res.text(data);
    })
    .catch((error) => {
      console.error("Error:", error);
      res.status(500).json({ error: "An error occurred; " + error });
    });
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
