const ejs = require("ejs");
const express = require("express");
require("dotenv").config();
const fetch = require("node-fetch");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const { Readable } = require("stream");
const FormData = require("form-data");
const multer = require("multer");
const verifyFile = require("./snippets/verifyFile");
const path = require("path");

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
          res.locals.message("Logged In!");
          res.redirect("/");
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
  fetch(
    `${process.env.API_URL}file?apiKey=${req.jwt}&dir=${req.query.dir || ""}`
  )
    .then((response) => response.json())
    .then((data) => {
      if (!data.error) {
        res.render("dashboard", {
          title: "Dashboard",
          files: data,
          dir: req.query.dir || "",
          pastDir: req.query.dir ? path.resolve(req.query.dir, "..") : "",
          isRoot:
            req.query.dir == "" ||
            req.query.dir == "/" ||
            req.query.dir == "." ||
            req.query.dir == "./",
        });
      } else {
        res.status(400).json({ error: data.error });
      }
    })
    .catch((error) => {
      console.error("Error:", error);
      res.status(500).json({ error: "An error occurred; " + error });
    });
});

const upload = multer();

app.post("/dashboard/upload", upload.single("file"), async (req, res) => {
  try {
    const { apiKey, dir } = req.body;

    if (!req.file) {
      return res
        .status(400)
        .json({ error: "No file uploaded", success: false });
    }

    // Create FormData
    const formData = new FormData();
    formData.append("apiKey", apiKey || "");
    formData.append("dir", dir || "");

    // Convert file buffer to a readable stream
    const fileStream = new Readable();
    fileStream.push(req.file.buffer);
    fileStream.push(null); // End the stream

    // Append file to FormData
    formData.append("file", fileStream, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });

    // Make the request using node-fetch
    const response = await fetch(`${process.env.API_URL}file/upload`, {
      method: "POST",
      headers: formData.getHeaders(),
      body: formData,
    });

    // Handle response from the forwarded request
    if (!response.ok) {
      const errorResponse = await response.json();
      return res
        .status(response.status)
        .json({ error: errorResponse, success: false });
    }

    const responseData = await response.json();
    res.status(response.status).json(responseData);
  } catch (error) {
    console.error("Error in forwarding file upload:", error.message);
    res.status(500).json({
      error: "An error occurred while forwarding the file upload.",
      success: false,
    });
  }
});

app.get("/dashboard/removeFileByPath", async (req, res) => {
  const { cleanPath } = req.query;

  try {
    const response = await fetch(`${process.env.API_URL}file/removeByPath`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        apiKey: req.jwt,
        file: cleanPath,
      }),
    });

    if (!response.ok) {
      const errorResponse = await response.json();
      return res
        .status(response.status)
        .json({ error: errorResponse, success: false });
    }

    const responseData = await response.json();
    res.redirect("/dashboard?dir=" + req.query.dir || "");
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "An error occurred; " + error });
  }
});

app.post("/dashboard/renameFileByPath", async (req, res) => {
  const { cleanPath, newName } = req.body;
  if (!cleanPath || !newName) {
    return res.status(400).json({ error: "Missing required fields" });
  } else if (cleanPath.includes("..") || newName.includes("..")) {
    return res.status(400).json({ error: "Invalid file path" });
  } else if (cleanPath === newName) {
    return res.status(400).json({ error: "New name is the same as the old" });
  } else if (!verifyFile.checkFileName(newName) && newName !== "") {
    return res.status(400).json({ error: "Invalid file name" });
  }
  try {
    const response = await fetch(`${process.env.API_URL}file/renameByPath`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        apiKey: req.jwt,
        file: cleanPath,
        newName: newName,
      }),
    });

    if (!response.ok) {
      const errorResponse = await response.json();
      return res
        .status(response.status)
        .json({ error: errorResponse, success: false });
    }

    const responseData = await response.json();
    res.redirect("/dashboard?dir=" + (req.query.dir || ""));
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "An error occurred; " + error });
  }
});

app.post("/dashboard/createDir", async (req, res) => {
  const { dirName } = req.body;
  if (!dirName) {
    return res.redirect(
      `/dashboard?dir=${req.query.dir || ""}&message=Missing required fields`
    );
  } else if (dirName.includes("..")) {
    return res.redirect(
      `/dashboard?dir=${req.query.dir || ""}&message=Invalid Directory Name`
    );
  }
  try {
    const response = await fetch(`${process.env.API_URL}file/createDirectory`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        apiKey: req.jwt,
        dir: path.join(req.query.dir || "", dirName),
      }),
    });

    if (!response.ok) {
      const errorResponse = await response.json();
      return res.redirect(
        `/dashboard?dir=${req.query.dir || ""}&message=${errorResponse.error}`
      );
    }

    const responseData = await response.json();
    res.redirect("/dashboard?dir=" + req.query.dir || "");
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "An error occurred; " + error });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
