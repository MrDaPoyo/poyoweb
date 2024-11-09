const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('./db');
const path = require('path');
const fs = require('fs-extra')
const multer = require('multer');
require('dotenv').config();

db.setupDB();

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', 'views');

app.get("/", (req, res) => {
    res.render("register");
});

app.post('/auth/register', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
    } else if (password.length > 7) {
        try {
            const hashedPassword = await db.hashPassword(password);
            const result = await db.createUser(username, email, await hashedPassword);

            if (result.success) {
                res.status(201).json({ message: 'User registered successfully', jwt: result.jwt, success: result.success });
            } else {
                res.status(400).json({ error: result.message, success: result.success });
            }
        } catch (error) {
            res.status(500).json({ error: error });
        }
    } else {
        res.status(400).json({ error: 'Password must be at least 8 characters long', success: false });
    }
});

app.post('/auth/login', async (req, res) => {
    const { user, password } = req.body;
    if ((!user) || !password) {
        res.status(400).json({ error: 'Missing required fields', success: false });
        return;
    } else {
        try {
            const result = await db.loginUser(user, password);
            if (result.success) {
                res.status(200).json({ message: 'User logged in successfully', jwt: result.jwt, success: result.success });
            } else {
                res.status(400).json({ error: result.message, success: result.success });
            }
        } catch (error) {
            res.status(500).json({ error: JSON.parse(error) });
        }
    }
});

const storage = multer.diskStorage({
    destination: async function (req, file, cb) {
        const { apiKey, dir } = req.body;

        try {
            // Sanitize dir to prevent directory traversal
            const sanitizedDir = path.normalize(dir || '').replace(/^(\.\.(\/|\\|$))+/, '');
            const username = (await db.findUserById(await jwt.verify(apiKey, process.env.AUTH_SECRET).id)).username;
            
            fs.ensureDirSync(path.join(__dirname, 'websites/users', username, sanitizedDir));
            
            req.body.file = file;
            cb(null, path.join(__dirname, 'websites/users', username, sanitizedDir));
        } catch (error) {
            req.res.status(401).json({ error: 'Invalid API key', success: false });
        }
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage: storage });

app.post('/file/upload', upload.single("file"), (req, res) => {
    var { apiKey, file, dir } = req.body;
    dir = dir || '';
    dir = dir.replace(/^(\.\.(\/|\\|$))+/, '');
    jwt.verify(apiKey, process.env.AUTH_SECRET, async (err, decoded) => {
        if (err) {
            console.log(err);
            return res.status(401).json({ error: 'Invalid API key', success: false });
        } else if (file) {
            const userDir = path.join(__dirname, 'websites/users', (await db.findUserById(decoded.id)).username, dir || '');
            const filePath = path.join(userDir, file.originalname);
            const fileSize = (await fs.stat(filePath)).size;

            const fileData = {
                fileName: file.originalname,
                fileLocation: filePath,
                fileFullPath: filePath,
                fileSize: fileSize,
                status: 'active',
                userID: decoded.id // Assuming the decoded token contains userID
            };

            db.insertFileInfo(file.filename, fileData);

            res.status(200).json({ message: 'File uploaded successfully', file: file });
        } else {
            res.status(400).json({ error: 'No file uploaded', success: false });
        }
    });
});

app.get('/file/', async (req, res) => {
    const { apiKey, dir } = req.query;
    jwt.verify(apiKey, process.env.AUTH_SECRET, async (err, decoded) => {
        if (err) {
            console.log(err);
            return res.status(401).json({ error: 'Invalid API key', success: false });
        } else {
            const files = await db.getAllFilesByUserId(decoded.id);
            res.status(200).json({ files: files });
        }
    });
});

// Start the server
app.listen(port, () => {
    console.log(`PoyoWeb! API running at ${process.env.API_URL}:${port}`);
});