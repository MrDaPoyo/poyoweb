const sqlite3 = require('sqlite3').verbose();
const { on } = require('events');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Create a new database file if it doesn't exist
const db = new sqlite3.Database('./poyoweb.db', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
        console.error(err.message);
    }
});

function setupDB() {
    // Create users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    apiKey TEXT DEFAULT NULL
)`);

    // Create websites table
    db.run(`CREATE TABLE IF NOT EXISTS websites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userID INTEGER NOT NULL,
    name TEXT UNIQUE NOT NULL,
    domain TEXT UNIQUE NOT NULL,
    views INTEGER DEFAULT 0,
    totalSize INTEGER DEFAULT 0,
    tier INTEGER DEFAULT 1,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userID) REFERENCES users(id))`);

    db.run(`CREATE TABLE IF NOT EXISTS files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,  -- Unique ID for each file
            fileName TEXT NOT NULL,                -- Name of the file
            fileLocation TEXT NOT NULL,            -- Location (path) where the file is stored
            fileFullPath TEXT NOT NULL,
            userID INTEGER NOT NULL,               -- ID of the user who uploaded the file
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,  -- Date and time when the file was created
            lastModifiedAt DATETIME DEFAULT CURRENT_TIMESTAMP, -- Last modified date of the file
            fileSize INTEGER DEFAULT 0 NOT NULL,              -- Weight (size) of the file in bytes
            status TEXT DEFAULT 'active',			-- Status of the file (e.g., active, archived, deleted)
            statusLastModifiedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (userID) REFERENCES users(id))`);
}

setupDB();

function hashPassword(password) {
    return new Promise((resolve, reject) => {
        bcrypt.hash(password, 10, (err, hash) => {
            if (err) {
                reject(err);
            }
            resolve(hash);
        });
    });
}

function createUser(username, email, password) {
    return new Promise((resolve, reject) => {
        const query = `INSERT INTO users (username, email, password) VALUES (?, ?, ?)`;
        db.run(query, [username, email, password], function (err) {
            if (err) {
                resolve({ success: false, message: err.message });
            } else {
                const userId = this.lastID;
                resolve({ success: true, jwt: jwt.sign({ id: userId }, process.env.AUTH_SECRET) });
            }
        });
    });
}

function loginUser(userEmailOrName, password) {
    return new Promise((resolve, reject) => {
        const email = userEmailOrName.includes('@') ? userEmailOrName : null;
        if (!email) {
            const query = `SELECT * FROM users WHERE username = ?`;
            db.get(query, [userEmailOrName], async (err, row) => {
                if (err) {
                    reject(err);
                } else if (!row) {
                    resolve({ success: false, message: 'User not found' });
                } else {
                    const match = await bcrypt.compare(password, row.password);
                    if (match) {
                        resolve({ success: true, jwt: jwt.sign({ id: row.id }, process.env.AUTH_SECRET) });
                    } else {
                        resolve({ success: false, message: 'Incorrect password' });
                    }
                }
            });
        } else {
            const query = `SELECT * FROM users WHERE email = ?`;
            db.get(query, [email], async (err, row) => {
                if (err) {
                    reject(err);
                } else if (!row) {
                    resolve({ success: false, message: 'User not found' });
                } else {
                    const match = await bcrypt.compare(password, row.password);
                    if (match) {
                        resolve({ success: true, jwt: jwt.sign({ id: row.id }, process.env.AUTH_SECRET) });
                    } else {
                        resolve({ success: false, message: 'Incorrect password' });
                    }
                }
            });
        }
    });
}

function readUsers() {
    db.all('SELECT * FROM users', async (err, rows) => {
        return rows;
    });
}

function findUserById(id) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE id = ?', [id], (err, row) => {
            if (err) {
                reject(err);
            }
            resolve(row);
        });
    });
}

function findUserByEmail(email) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE email = ?', [email], (err, row) => {
            if (err) {
                reject(err);
            }
            resolve(row)
        })
    });
}

function findUserByUsername(username) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
            if (err) {
                reject(err);
            }
            resolve(row);
        });
    });
}

async function isUserVerifiedById(id) {
    var verified = db.get('SELECT verified FROM users WHERE id = ?', [id]);
    return verified;
}

function addView(name) {
    db.run('UPDATE websites SET views = views + 1 WHERE name = ?', [name]);
}

async function retrieveViews(name, onViews) {
    const promise = new Promise((resolve, reject) => {
        db.get('SELECT views FROM websites WHERE name = ?', [name], (err, views) => {
            resolve(views);
        });
    })
    promise.then(onViews);
    return promise;
}

// Function to add size to the totalSize field for a user's website using the website name
function addSizeByWebsiteName(name, size) {
    db.run('UPDATE websites SET totalSize = totalSize + ? WHERE name = ?', [size, name], (err) => {
        if (err) {
            console.error('Error updating totalSize:', err.message);
        } else {
            console.log(`Added ${size} to totalSize for website: ${name}`);
        }
    });
}

// Function to get the totalSize of a website using the website name
function getTotalSizeByWebsiteName(name) {
    return new Promise((resolve, reject) => {
        db.get('SELECT totalSize FROM websites WHERE name = ?', [name], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row ? row.totalSize : 0);  // Default to 0 if no record is found
            }
        });
    });
}

function insertFileInfo(fileID, updatedData) {
    const selectQuery = `SELECT id FROM files WHERE id = ?`;

    db.get(selectQuery, [fileID], async (err, row) => {
        if (err) {
            return console.error(err.message);
        }
        if (await row) {
            // File exists, perform update
            const updateQuery = `
        UPDATE files
        SET
          fileName = COALESCE(?, fileName),
          fileLocation = COALESCE(?, fileLocation),
          fileFullPath = COALESCE(?, fileFullPath),
          fileSize = COALESCE(?, fileSize),
          status = COALESCE(?, status),
          lastModifiedAt = CURRENT_TIMESTAMP
          WHERE id = ?
      `;

            const updateValues = [
                updatedData.fileName || null,
                updatedData.fileLocation || null,
                updatedData.fileFullPath || null,
                updatedData.fileSize || null,
                updatedData.status || null,
                fileID
            ];

            db.run(updateQuery, updateValues, function (err) {
                if (err) {
                    return console.error(err.message);
                }
                console.log(`Row(s) updated: ${this.changes}`);
            });

        } else {
            // File doesn't exist, perform insert
            const insertQuery = `
        INSERT INTO files (fileName, fileLocation, fileFullPath, fileSize, status, createdAt, lastModifiedAt, userID)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?)
      `;

            const insertValues = [
                updatedData.fileName,
                updatedData.fileLocation,
                updatedData.fileFullPath,
                updatedData.fileSize || 0,
                updatedData.status || 'active',
                updatedData.userID  // Assuming you have userID in the updatedData
            ];

            db.run(insertQuery, insertValues, function (err) {
                if (err) {
                    return console.error(err.message);
                }
                console.log(`Row inserted with ID: ${this.lastID}`);
            });
        }
    });
}

function getAllFilesByUserId(userID) {
    return new Promise((resolve, reject) => {
        const query = `SELECT * FROM files WHERE userID = ?`;

        db.all(query, [userID], (err, rows) => {
            if (err) {
                console.error('Error retrieving files:', err.message);
                reject(err);
            }

            resolve(rows);
        });
    });
}

function getFileById(fileID) {
    return new Promise((resolve, reject) => {
        const query = `SELECT * FROM files WHERE id = ?`;

        db.get(query, [fileID], (err, row) => {
            if (err) {
                console.error('Error retrieving file:', err.message);
                reject(err);
            }

            if (row) {
                resolve(row);  // Return the file if found
            } else {
                console.log(`No file found with ID: ${fileID}`);
                resolve(null);  // Return null if no file was found
            }
        });
    });
}

function getFileIDByPath(filePath) {
    return new Promise((resolve, reject) => {
        const query = `SELECT id FROM files WHERE fileLocation = ? LIMIT 1`;

        db.get(query, [filePath], (err, row) => {
            if (err) {
                console.error('Error retrieving file ID:', err.message);
                reject(err);
            }

            if (row) {
                resolve(row.id);  // Return the file ID if found
            } else {
                console.log(`No file found with path: ${filePath}`);
                resolve(null);  // Return null if no file was found
            }
        });
    });
}

function removeFileByPath(filePath) {
    return new Promise((resolve, reject) => {
        const query = `DELETE FROM files WHERE fileLocation = ?`;

        db.run(query, [filePath], function (err) {
            if (err) {
                console.error('Error deleting file:', err.message);
                reject(err);
            }

            if (this.changes > 0) {
                console.log(`File with path ${filePath} removed from database.`);
                resolve(true); // File successfully deleted
            } else {
                console.log(`No file found with path ${filePath}.`);
                resolve(false); // No file found to delete
            }
        });
    });
}

function removeFileByID(fileID) {
    return new Promise((resolve, reject) => {
        const query = `DELETE FROM files WHERE id = ?`;

        db.run(query, [fileID], function (err) {
            if (err) {
                console.error('Error deleting file:', err.message);
                reject(err);
            }

            if (this.changes > 0) {
                console.log(`File with ID ${fileID} removed from database.`);
                resolve(true); // File successfully deleted
            } else {
                console.log(`No file found with ID ${fileID}.`);
                resolve(false); // No file found to delete
            }
        });
    });
}


function getAllUserNames() {
    return new Promise((resolve, reject) => {
        const query = 'SELECT id, username FROM users WHERE username IS NOT NULL';

        db.all(query, [], (err, rows) => {
            if (err) {
                console.error('Error executing query:', err.message);
                reject(err);
            } else {
                const names = rows.map(row => (//{  id: row.id, 
                    row.username //}
                ));
                resolve(names);
            }
        });
    });
}

function getWebsiteByDomain(domain) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM websites WHERE domain = ?', [domain], (err, row) => {
            if (err) {
                var no = false;
                resolve(no);
            } else {
                if (row) {
                    resolve({ name: row.name, views: row.views, size: row.totalSize, tier: row.tier });
                } else {
                    resolve(false);
                }
            }
        })
    });
}

function createApiKey(username) {
    if (!username) {
        console.log("Failed to create API Key: Missing Username");
        return false;
    }

    // Generate API key
    const apiKey = jwt.sign({ username }, process.env.TOKEN_KEY, { expiresIn: "2y" });

    // Update or insert the API key in the users table
    const query = `UPDATE users SET apiKey = ? WHERE username = ?`;
    db.run(query, [apiKey, username], function (err) {
        if (err) {
            console.error("Error updating API key in database:", err.message);
            return false;
        } else if (this.changes === 0) {
            console.log("No user found with the given username.");
            return false;
        } else {
            console.log(`API key for user '${username}' has been successfully created and saved.`);
            return apiKey;
        }
    });
}

async function verifyApiKey(apiKey) {
    if (apiKey) {
        try {
            const decoded = await jwt.verify(apiKey, process.env.TOKEN_KEY);

            if (await decoded) {
                return await decoded;
            } else {
                return false;
            }
        } catch (err) {
            return false;
        }
    } else {
        return false;
    }
}

function closeDB() {
    db.close((err) => {
        if (err) {
            console.error('Error closing the database:', err.message);
        } else {
            console.log('Closed the database connection.');
        }
    });
}

module.exports = {
    setupDB,
    readUsers,
    findUserByEmail,
    findUserByUsername,
    findUserById,
    isUserVerifiedById,
    addView,
    retrieveViews,
    getWebsiteByDomain,
    getTotalSizeByWebsiteName, // Updated function export
    addSizeByWebsiteName, // Updated function export
    db,
    insertFileInfo,
    getFileById,
    getFileIDByPath,
    removeFileByPath,
    removeFileByID,
    getAllUserNames,
    getAllFilesByUserId,
    createApiKey,
    verifyApiKey,
    createUser,
    hashPassword,
    loginUser
};
