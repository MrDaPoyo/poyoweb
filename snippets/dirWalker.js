var fs = require("fs-extra");
var path = require("path");
var db = require('./../db');
var verifyFile = require('./verifyFile')

function classifyFileType(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    const audioExtensions = ['.mp3', '.wav', '.aac', '.flac', '.ogg', '.wma'];
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.tiff'];
    const documentExtensions = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.txt', '.xls', '.xlsx'];
    const codeExtensions = ['.js', '.html', '.css', '.py', '.java', '.c', '.cpp', '.rb', '.go', '.php'];

    if (audioExtensions.includes(ext)) {
        return 'audio';
    } else if (imageExtensions.includes(ext)) {
        return 'image';
    } else if (documentExtensions.includes(ext)) {
        return 'document';
    } else if (codeExtensions.includes(ext)) {
        return 'code';
    } else {
        return 'unknown';
    }
}

async function readDir(basedir, dir) {
    return new Promise((resolve, reject) => {
        fs.readdir(dir, (err, files) => {
            if (err) {
                reject(err);
            } else {
                console.log(dir);
                files = Promise.all(files.map(async file => {
                    const filePath = path.join(dir, file);
                    const stats = fs.statSync(filePath);
                    let type = '';
                    if (stats.isDirectory()) {
                        type = 'directory';
                    } else {
                        type = 'file';
                    }
                    if (type == 'file') {
                        var openable = verifyFile.checkEditableFile(file);
                        var kind = classifyFileType(file);
                        
                    }
                    const fileId = await db.getFileIDByPath(filePath); // Assuming getFileIdFromDatabase is a function that fetches the file ID from the database
                    return {
                        name: file,
                        filePath: path.relative(basedir, filePath).replace(file, ''),
                        cleanPath: path.relative(basedir, filePath),
                        isDirectory: stats.isDirectory(),
                        size: stats.size,
                        createdAt: stats.birthtime,
                        modifiedAt: stats.mtime,
                        id: fileId,
                        type,
                        openable,
                        kind,
                    };
                }));
                resolve(files);
            }
        });
    });
}
module.exports = readDir;