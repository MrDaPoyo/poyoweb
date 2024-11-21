const sqlite3 = require('sqlite3').verbose();

// Open the database connection to 'poyoweb.db'
let db = new sqlite3.Database('poyoweb.db', sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database "poyoweb.db".');
  }
});

// Function to add a new column only if it doesn't exist
const addColumnIfNotExists = (tableName, columnName, columnType) => {
  const checkColumnQuery = `PRAGMA table_info(${tableName});`;

  db.all(checkColumnQuery, [], (err, rows) => {
    if (err) {
      console.error('Error checking table info:', err.message);
      return;
    }

    // Check if the column already exists
    const columnExists = rows.some(row => row.name === columnName);

    if (!columnExists) {
      const alterTableQuery = `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType};`;
      db.run(alterTableQuery, (err) => {
        if (err) {
          console.error(`Error adding column "${columnName}":`, err.message);
        } else {
          console.log(`Column "${columnName}" added successfully.`);
        }
      });
    } else {
      console.log(`Column "${columnName}" already exists in the "${tableName}" table.`);
    }
  });
};

// Add a column to the 'users' table if it doesn't exist
// addColumnIfNotExists('users', 'admin', 'INTEGER NOT NULL DEFAULT 0');

// Close the database connection
db.close((err) => {
  if (err) {
    console.error('Error closing database:', err.message);
  } else {
    console.log('Database connection closed.');
  }
});
