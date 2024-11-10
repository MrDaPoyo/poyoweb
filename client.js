const ejs = require('ejs');
const express = require('express');
require('dotenv').config();
const fetch = require('node-fetch');
const cookieParser = require('cookie-parser');

cookieParser();

const app = express();
const port = 8080;

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

app.post('/auth/login', async (req, res) => {
    const { user, password } = req.body;
    if ((!user) || !password) {
        res.status(400).json({ error: 'Missing required fields', success: false });
        return;
    } else {
        try {
            const response = await fetch(process.env.API_URL + 'auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    user: user,
                    password: password
                }),
                timeout: 5000
            });
            const text = await response.text();
            const data = text ? JSON.parse(text) : {};
            if (data.success) {
                res.cookie('auth', data.jwt, { httpOnly: true });
                res.redirect("index", { message: 'User logged in successfully', success: data.success });
            } else {
                res.clearCookie('auth');
                res.render('login', { message: data.error, title: 'Login' });
            }
        } catch (error) {
            console.error('Error:', error);
            res.status(500).json({ error: 'An error occurred; ' + error });
        }
    }
});

app.post('/auth/register', (req, res) => {
    const { username, password, email } = req.body;
    if ((!username) || !password || !email) {
        res.status(400).json({ error: 'Missing required fields', success: false });
        return;
    } else {
        fetch(process.env.API_URL + 'auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: username,
                password: password,
                email: email
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                res.cookie('auth', data.jwt, { httpOnly: true });
                res.redirect("index", { message: data.message, title: 'Home' });
            } else {
                res.status(400).json({ error: data.error, success: data.success });
            }
        })
        .catch(error => {
            console.error('Error:', error);
            res.status(500).json({ error: 'An error occurred; ' + error });
        });
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
