// addAdmin.js
const sqlite3 = require('sqlite3').verbose();
const { argv } = require('process');

// Extract the username from the command-line arguments
const args = require('yargs')
  .usage('Usage: node $0 --user <username>')
  .option('user', {
    alias: 'u',
    describe: 'Username to update admin status',
    type: 'string',
    demandOption: true,
  })
  .help()
  .alias('help', 'h')
  .argv;

// Database file
const dbFile = 'poyoweb.db';

// Connect to the SQLite database
const db = new sqlite3.Database(dbFile, (err) => {
  if (err) {
    console.error('Error connecting to database:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database.');
});

// Update the user to have admin status
const username = args.user;
const updateQuery = `UPDATE users SET admin = 1 WHERE username = ?`;

db.run(updateQuery, [username], function (err) {
  if (err) {
    console.error('Error updating admin status:', err.message);
  } else if (this.changes === 0) {
    console.log(`No user found with username: ${username}`);
  } else {
    console.log(`Successfully set admin status for user: ${username}`);
  }

  // Close the database connection
  db.close((err) => {
    if (err) {
      console.error('Error closing the database:', err.message);
    } else {
      console.log('Database connection closed.');
    }
  });
});
