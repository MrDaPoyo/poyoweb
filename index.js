const express = require('express');
const db = require('./db');
require('dotenv').config();

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', 'views');

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.post('/register', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
    } else if (password.length < 8) {
        try {
            const hashedPassword = await db.hashPassword(password);
            const result = await db.createUser(username, email, await hashedPassword);

            if (result.success) {
                res.status(201).json({ message: 'User registered successfully', result });
            } else {
                res.status(400).json({ error: result.error });
            }
        } catch (error) {
            res.status(500).json({ error: JSON.parse(error) });
        }
    } else {
        res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }
});

app.get("/", (req, res) => {
    res.render("register");
});

// Start the server
app.listen(port, () => {
    console.log(`PoyoWeb! API running at ${process.env.API_URL}:${port}`);
});