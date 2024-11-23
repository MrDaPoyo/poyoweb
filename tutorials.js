const express = require('express');
const path = require('path');
const fs = require('fs');
const showdown = require('showdown');

const router = express.Router();

// Route to serve tutorials
router.get('/', (req, res) => {
    res.render('tutorialIndex');
});

router.get('/:tutorial', (req, res) => {
    const tutorialName = req.params.tutorial;
    const tutorialPath = path.join(__dirname, 'tutorials', `${tutorialName}.md`);

    fs.readFile(tutorialPath, 'utf8', (err, data) => {
        if (err) {
            return res.status(404).send('Tutorial not found');
        }

        const converter = new showdown.Converter();
        const html = converter.makeHtml(data);
        res.json({ content: html });
    });
});

module.exports = router;