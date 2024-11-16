const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('./db');
const path = require('path');
const fs = require('fs-extra')
const multer = require('multer');
require('dotenv').config();

const verifyFile = require('./snippets/verifyFile');
const dirWalker = require('./snippets/dirWalker');
const { verify } = require('crypto');
const mailer = require('./mailer');
const proxy = require("./proxyManager");

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

const userBlacklist = ["dns", "social", "faq", "poyoweb", "www","admin","poyo","mrdapoyo", "reporter", "weblink", "oreneta", "neocities", "dapoyo", "bitch", "newrubix", "api", "blog", "official"]
const domainBlacklist = ["poyoweb.me"];

function checkUsername(username) {
    const regex = /^[a-zA-Z0-9]+$/;
    if (username.length > 20) {
        return 'Username must have at max 20 characters';
    } else if (!regex.test(username)) {
        return 'Username must contain only letters and numbers';
    } else if (userBlacklist.includes(username)) {
        return 'Username is blacklisted, try again with another different username';
    } else {
        return true;
    }
}
function checkDomain(inputString) {
  for (const blacklistedUser of domainBlacklist) {
    if (inputString.includes(blacklistedUser)) {
      return false;
    }
  }
  return true;
}

app.post('/auth/register', async (req, res) => {
    var { username, email, password } = req.body;
    username = username.toLowerCase();
    var usernameTest = checkUsername(username);
    if (!usernameTest) {
    	res.status(400).json({error: usernameTest, success: false});
    }
    if (!username || !email || !password) {
        res.status(400).json({ error: 'Missing required fields', success: false});
        return;
    } else if (password.length > 7) {
        try {
            const hashedPassword = await db.hashPassword(password);
            const result = await db.createUser(username, email, await hashedPassword);

            if (result.success) {
                fs.mkdir(path.join(__dirname, 'websites/users', username), { recursive: true });
                mailer.sendVerificationEmail(result.jwt, email);
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


app.get('/auth/verify', (req, res) => {
    const { token } = req.query;

    // Verifying the JWT token 
    jwt.verify(token, process.env.AUTH_SECRET, function (err, decoded) {
        if (err) {
            console.log(err);
            res.status(401).json({error: "Email verification failed, possibly the link is invalid or expired", success: false});
        }
        else {
            db.db.run('UPDATE users SET verified = 1  WHERE id = ?', [decoded.id], (err) => {
                if (err) {
                    console.error(err.message);
                    res.status(400).json({error: "Email verification failed, possibly the link is invalid or expired", success: false});
                } else {
                    var newToken = jwt.sign(
                        { username: decoded.username, email: decoded.email, verified: 1 },
                        process.env.AUTH_SECRET,
                        { expiresIn: "30d" }
                    );
                    res.status(200).json({ token: newToken, message: "Successfully Verified!", success: true });
                }
            });

        }
    });
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
    },
});

const upload = multer({ 
    storage: storage,
    fileFilter: async function (req, file, cb) {
        try {
            const isValid = await verifyFile.checkFileName(file.originalname);
            if (isValid) {
                cb(null, true);
            } else {
                cb(new Error('Invalid file name'), false);
            }
        } catch (error) {
            cb(new Error('Error verifying file name'), false);
        }
    },
 });

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
        try {
            fs.unlink(path.join(__dirname, 'websites/users', await user.username, dir, file.originalname));
        } catch (error) {
            console.log(error);
        }
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


app.post('/file/renameByPath', async (req, res) => {
    const { apiKey, file, newName } = req.body;

    try {
        const user = await verifyApiKey(apiKey);
        if (!user) {
            return res.status(401).json({ error: 'Invalid API key' });
        }

        const userDirectory = path.join('websites/users', user.username);

        // Ensure no directory traversal is possible by normalizing paths
        const sanitizedFilePath = path.normalize(path.join(userDirectory, file));
        const sanitizedNewFilePath = path.normalize(path.join(userDirectory, newName));

        // Check if the resolved paths are still within the intended directory
        if (!sanitizedFilePath.startsWith(userDirectory) || !sanitizedNewFilePath.startsWith(userDirectory)) {
            return res.status(400).json({ error: 'Invalid file path', success: false });
        }

        if (!await fs.pathExists(sanitizedFilePath)) {
            return res.status(404).json({ error: 'File not found', success: false });
        }

        // Update the database with the new file information
        db.insertFileInfo(
            db.getFileIDByPath(file),
            { fileLocation: sanitizedNewFilePath, fileName: newName, fileFullPath: sanitizedNewFilePath, userID: user.id }
        );

        // Rename the file
        await fs.rename(sanitizedFilePath, sanitizedNewFilePath);
        return res.status(200).json({ message: 'File renamed successfully', success: true });

    } catch (error) {
        console.error('Error renaming file:', error);
        return res.status(500).json({ error: 'Internal server error', success: false });
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
            directory = directory.replace(/^(\.\.(\/|\\|$))+/, '');
            try {
                if (!fs.existsSync(directory)) {
                    return res.status(404).json({ error: 'Directory not found' });
                }
                const files = await dirWalker(path.join(__dirname, 'websites/users', await username), directory);
                res.status(200).json({ files });
            } catch (error) {
                res.status(500).json({ error: 'Path not found: ' + error });
            }
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    }
});

app.post('/file/createDirectory', async (req, res) => {
    const { apiKey, dir, baseDir } = req.body;
    var user = await verifyApiKey(apiKey);
    if (!user) {
        return res.status(401).json({ error: 'Invalid API key' });
    } else {
        var username = await user.username;
        if (await username) {
            var directory = path.join(__dirname, 'websites/users', username, baseDir, dir);
            directory = directory.replace(/^(\.\.(\/|\\|$))+/, '');
            try {
                await fs.mkdir(directory, { recursive: true });
                res.status(200).json({ message: 'Directory created successfully', success: true });
            } catch (error) {
                res.status(500).json({ error: 'Error creating directory: ' + error });
            }
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    }
});

app.get('/file/retrieve', async (req, res) => {
    const { apiKey, file } = req.query;
    var user = await verifyApiKey(apiKey);
    if (!user) {
        return res.status(401).json({ error: 'Invalid API key' });
    } else {
        var username = await user.username;
        if (await username) {
            var filePath = path.join('websites/users', username, file);
            filePath = filePath.replace(/^(\.\.(\/|\\|$))+/, '');
            try {
                if (!fs.existsSync(filePath)) {
                    return res.status(404).json({ error: 'File not found' });
                }
                const fileContents = await fs.readFile(filePath, 'utf8');
                console.log(fileContents);
                res.status(200).json({ filename: path.basename(filePath), contents: fileContents });
            } catch (error) {
                res.status(500).json({ error: 'Path not found: ' + error });
            }
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    }
});

app.post("/settings/linkDomain", async (req, res) => {
	const { apiKey, domain } = req.body;
	if (!apiKey || !domain) {
		return res.status(403).json({error: "Missing fields", success: false});
	}
	const domainRegex = /^(?!.*https)(?!.*@)[a-zA-Z0-9-]{1,63}(\.[a-zA-Z]{2,})+$/;
	if (!domainRegex.test(domain)) {
		return res.status(403).json({error:"Invalid domain, make sure to not include 'HTTPS://'s or '@'s", success: false});
	}
	var user = await verifyApiKey(apiKey);
	if (!user) {
		return res.status(403).json({error: "Invalid user", success: false});
	}
	if (domain.includes(process.env.URL.SUFFIX) && !domain == user.username + process.env.URL_SUFFIX)  {
		return res.status(403).json({error: "DONT YOU TRY STEAL ANYONE ELSE'S USERNAME", success: false});
	}
	if (!checkDomain(domain)) {
		return res.status(403.json({error: "Reserved domain", success: false}));
	}
	db.db.run('UPDATE websites SET domain = ?  WHERE userID = ?', [domain, user.id], (err) => {
		if (!err) {
			proxy.updateProxyDomains(await db.getAllDomains());
			return res.status(200).json({message:"Domain updated!", success: true});
		} else {
			return res.status(403).json({error: "Domain is taken!", success: false});
		}
	});
});

// Start the server
app.listen(port, () => {
    console.log(`PoyoWeb! API running at ${process.env.API_URL}:${port}`);
});
