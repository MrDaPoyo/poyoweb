const { exec } = require('child_process');

exec('node server.js', (err, stdout, stderr) => {
    if (err) {
        console.error(`Error running server.js: ${err}`);
        return;
    }
    console.log(`server.js output: ${stdout}`);
    if (stderr) {
        console.error(`server.js stderr: ${stderr}`);
    }
});

exec('node client.js', (err, stdout, stderr) => {
    if (err) {
        console.error(`Error running client.js: ${err}`);
        return;
    }
    console.log(`client.js output: ${stdout}`);
    if (stderr) {
        console.error(`client.js stderr: ${stderr}`);
    }
});