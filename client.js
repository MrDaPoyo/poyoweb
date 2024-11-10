const ejs = require('ejs');
const express = require('express');
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
    fetch('http://localhost:3000/auth/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            user: user,
            password: password
        })
    }).then((response) => {
        console.log(response);
        return res.send(response);
    })
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
