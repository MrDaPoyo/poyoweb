const sqlite3 = require('sqlite3').verbose();

// Open the database (replace 'database.db' with the path to your SQLite database)
let db = new sqlite3.Database('poyoweb.db', sqlite3.OPEN_READONLY, (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the SQLite database.');
});

// Function to print all rows of a table
function printTableData(tableName) {
    console.log(`\nData from table: ${tableName}`);
    db.all(`SELECT * FROM ${tableName}`, [], (err, rows) => {
        if (err) {
            console.error(err.message);
        }
        if (rows.length === 0) {
            console.log(`Table "${tableName}" is empty.`);
        } else {
            console.table(rows); // Prints in a nice table format
        }
    });
}

// Get all table names and print data for each table
db.all(`SELECT name FROM sqlite_master WHERE type='table'`, [], (err, rows) => {
    if (err) {
        throw err;
    }

    rows.forEach((row) => {
        printTableData(row.name);
    });
});

// Close the database connection (with a delay to allow queries to finish)
db.close((err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Closed the database connection.');
});