const fs = require('fs').promises;
const path = require('path');
const { db, getUserIDByName, insertFileInfo } = require('./db'); // Import necessary functions from your db module

async function wipeFilesTable() {
    return new Promise((resolve, reject) => {
        db.run('DELETE FROM files', (err) => {
            if (err) {
                reject(err);
            } else {
                console.log('Files table wiped clean.');
                resolve();
            }
        });
    });
}

// Helper function to recursively get all files in a directory
async function getFilesRecursively(directory) {
    let files = [];
    const items = await fs.readdir(directory, { withFileTypes: true });
    
    for (const item of items) {
        const fullPath = path.join(directory, item.name);
        if (item.isDirectory()) {
            const nestedFiles = await getFilesRecursively(fullPath);
            files = files.concat(nestedFiles);
        } else {
            files.push(fullPath);  // Only add files
        }
    }
    
    return files;
}

// Function to populate files table with current files inside websites/users/<username>
async function updateFilesTable() {
    try {
        // Step 1: Wipe the existing files table
        await wipeFilesTable();
        
        // Step 2: Get the list of all users from the database
        const users = await new Promise((resolve, reject) => {
            db.all('SELECT id, username FROM users', (err, rows) => {
                if (err) reject(err);
                resolve(rows);
            });
        });

        // Step 3: Iterate through each user and get files in their directory
        for (const user of users) {
            const userDirectory = path.join('websites/users', user.username);
            try {
                // Get all files for this user
                const files = await getFilesRecursively(userDirectory);
                
                // Step 4: Insert file information into the files table
                for (const file of files) {
                    const fileInfo = await fs.stat(file);  // Get file size, etc.
                    const fileName = path.basename(file);  // Extract the file name
                    const fileLocation = path.dirname(file);  // Extract the file location

                    const updatedData = {
                        fileName: fileName,
                        fileLocation: fileLocation,
                        fileFullPath: file,
                        userID: user.id,
                        fileSize: fileInfo.size,
                        status: 'active',
                    };
                    
                    // Insert or update file in the files table
                    await insertFileInfo(null, updatedData);
                }
            } catch (err) {
                console.error(`Error processing directory for user ${user.username}:`, err.message);
            }
        }

        console.log('Files table successfully updated with current file structure.');
    } catch (err) {
        console.error('Error updating files table:', err.message);
    }
}

// Call the update function
updateFilesTable();
