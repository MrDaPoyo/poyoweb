const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('./db');
const path = require('path');
const fs = require('fs-extra')
const multer = require('multer');
require('dotenv').config();

const dirWalker = require('./snippets/dirWalker');

db.setupDB();

const app = express();
const port = 9000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', 'views');

async function verifyApiKey(apiKey) {
    return new Promise((resolve, reject) => {
        jwt.verify(apiKey, process.env.AUTH_SECRET, (err, decoded) => {
            if (err) {
                resolve(false);
            } else {
                db.findUserById(decoded.id).then((user) => {
                    if (user) {
                        resolve(user);
                    } else {
                        resolve(false);
                    }
                })
            }
        });
    });
}

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
            const username = await (await verifyApiKey(apiKey)).username;

            fs.ensureDirSync(path.join(__dirname, 'websites/users', await username, sanitizedDir));

            req.body.file = file;
            req.file = file;
            cb(null, path.join(__dirname, 'websites/users', await username, sanitizedDir));
        } catch (error) {
            req.res.status(401).json({ error: 'Invalid API key', success: false });
        }
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage: storage });

app.post('/file/upload', upload.single("file"), async (req, res) => {
    var { apiKey, dir } = req.body;
    var file = req.file;
    dir = dir || '';
    dir = dir.replace(/^(\.\.(\/|\\|$))+/, '');
    var user = await verifyApiKey(apiKey);
    if (file && file.originalname && file.size) {
        var fullPath = path.join(__dirname, 'websites/users', await user.username, dir || '');
        var filePath = path.join(fullPath, file.originalname);
        var resolvedPath = path.resolve(filePath);
        userDir = path.resolve(path.join(__dirname, 'websites/users', await user.username));

        if (!resolvedPath.startsWith(userDir)) {
            return res.status(400).json({ error: 'Invalid file path', success: false });
        }

        const fileSize = (await fs.stat(fullPath)).size;
        var totalSize = await db.getTotalSizeByWebsiteName(await user.username) + fileSize;
        var fileID = await db.getFileIDByPath(filePath);

        if (await totalSize < (process.env.USER_MAX_SIZE || 524288000)) {
            const fileData = {
                fileName: file.originalname,
                fileLocation: path.join(dir, file.originalname),
                fileFullPath: fullPath,
                fileSize: fileSize,
                status: 'active',
                userID: await user.id // Assuming the decoded token contains userID
            };
            db.insertFileInfo(await fileID || null, fileData);
            if (await fileID) {
                const oldFileSize = (await fs.stat(filePath)).size;
                totalSize = totalSize - oldFileSize;
            }
            db.setTotalSizeByWebsiteName(await user.username, await totalSize);
            res.status(200).json({ message: 'File uploaded successfully', file: file });
            return;
        } else {
            res.status(400).json({ error: 'Not enough space for file', success: false });
            return;
        }
    } else {
        res.status(400).json({ error: 'No file uploaded, could be due to missing fields or a suspicious name', success: false });
        return;
    }
});

app.post('/file/renameByPath', async (req, res) => {
    const { apiKey, file, newName } = req.body;
    console.log(apiKey);
    var user = await verifyApiKey(apiKey);
    if (!await user) {
        return res.status(401).json({ error: 'Invalid API key' });
    } else {
        var filePath = path.join(await user.username, file);
        var newFilePath = path.join(await user.username, newName);
        if (!fs.existsSync(path.join('websites/users', filePath))) {
            return res.status(404).json({ error: 'File not found', success: false });
        }
        db.insertFileInfo(db.getFileIDByPath(filePath), { fileLocation: newFilePath, fileName: newName, fileFullPath: path.join('websites/users', newFilePath), userID: await user.id });
        fs.rename(path.join('websites/users', filePath), path.join('websites/users', newFilePath));
        return res.status(200).json({ message: 'File renamed successfully', success: true });
    }
});

app.post('/file/removeByPath', async (req, res) => {
    const { apiKey, file } = req.body;

    try {
        // Verify API key
        const user = jwt.verify(apiKey, process.env.AUTH_SECRET);
        var filePath = path.join((await db.findUserById(user.id)).username, file);
        if (!user) {
            return res.status(401).json({ error: 'Invalid API key' });
        }
        db.removeFileByID(db.getFileIDByPath(filePath));
        var fileSize = (await fs.stat(path.join('websites/users', filePath))).size;
        var totalSize = await db.getTotalSizeByWebsiteName(await db.findUserById(user.id).username) - await fileSize;
        db.setTotalSizeByWebsiteName(await db.findUserById(user.id).username, await totalSize);
        fs.unlink(path.join('websites/users', filePath));
        return res.status(200).json({ message: 'File removed successfully', success: true });

    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/file/', async (req, res) => {
    const { apiKey, dir } = req.query;
    var user = await verifyApiKey(apiKey);
    if (!user) {
        return res.status(401).json({ error: 'Invalid API key' });
    } else {
        var username = await user.username;
        if (await username) {
            var directory = path.join(__dirname, 'websites/users', username);
            if (dir) {
                directory = path.join(directory, dir);
            }
            try {
                const files = await dirWalker(path.join(__dirname, 'websites/users', await username), directory);
                res.status(200).json({ files });
            } catch (error) {
                res.status(500).json({ error: 'Path not found' + error });
            }
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    }
});

// Start the server
app.listen(port, () => {
    console.log(`PoyoWeb! API running at ${process.env.API_URL}:${port}`);
});
