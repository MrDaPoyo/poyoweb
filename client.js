const ejs = require('ejs');
const express = require('express');
require('dotenv').config();

const app = express();
const port = 8000;

app.set('view engine', 'ejs');
app.set('views', 'views');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.get('/', (req, res) => {
    res.render('index', { title: 'Home' });
});

app.get('/auth/login', (req, res) => {
    res.render('login', { title: 'Login' });
});

app.post('/auth/login', (req, res) => {
    const { user, password } = req.body;
    fetch(process.env.API_URL + 'auth/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            user: user,
            password: password
        }),
        timeout: 5000
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            res.redirect('/');
        } else {
            res.render('login', { title: 'Login', message: 'Invalid credentials' });
        }
    })
    .catch(error => {
        console.error('Error:', error);
        res.render('login', { title: 'Login', message: 'An error occurred' });
    });
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
