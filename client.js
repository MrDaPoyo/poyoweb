const ejs = require('ejs');
const express = require('express');
const app = express();
const port = 8000;

app.set('view engine', 'ejs');

app.get('/', (req, res) => {
    res.render('index', { title: 'Home' });
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
