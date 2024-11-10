const { spawn } = require('child_process');

const server = spawn('node', ['server.js']);
const client = spawn('node', ['client.js']);

server.stdout.on('data', (data) => {
    console.log(`server.js output:\n${data}`);
});

server.stderr.on('data', (data) => {
    console.error(`server.js stderr:\n${data}`);
});

server.on('close', (code) => {
    console.log(`server.js process exited with code ${code}`);
});

client.stdout.on('data', (data) => {
    console.log(`client.js output:\n${data}`);
});

client.stderr.on('data', (data) => {
    console.error(`client.js stderr:\n${data}`);
});

client.on('close', (code) => {
    console.log(`client.js process exited with code ${code}`);
});
