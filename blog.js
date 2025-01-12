const express = require('express');
const path = require('path');
const fs = require('fs');
const showdown = require('showdown');

const router = express.Router();

// Route to serve tutorials
router.get('/', (req, res) => {
    const tutorialsDir = path.join(__dirname, 'blog_posts');
    fs.readdir(tutorialsDir, (err, files) => {
        if (err) {
            return res.status(500).send('Unable to scan blog directory');
        }

        const blogPosts = files.filter(file => file.endsWith('.md')).map(file => {
            const filePath = path.join(tutorialsDir, file);
            const data = fs.readFileSync(filePath, 'utf8');
            const converter = new showdown.Converter({metadata: true});
            converter.makeHtml(data);
            const metadata = converter.getMetadata();
            return {
                id: path.basename(file, '.md'),
                author: metadata.author || 'Unknown',
                title: metadata.title || path.basename(file, '.md'),
                description: metadata.description || '',
                keywords: metadata.keywords || [],
                file: file
            };
        });

        if (blogPosts.length === 0) {
            return res.render('blogIndex', { title: "Blog" });
        }
        res.render('blogIndex', { title: "Blog", blogPosts });
    });
});

router.get('/:tutorial', (req, res) => {
    const tutorialName = req.params.tutorial;
    const tutorialPath = path.join(__dirname, 'blog_posts', `${tutorialName}.md`);


    if(tutorialName == "rss") {
        const tutorialsDir = path.join(__dirname, 'blog_posts');
        fs.readdir(tutorialsDir, (err, files) => {
        
            const blogPosts = files.filter(file => file.endsWith('.md')).map(file => {
                const filePath = path.join(tutorialsDir, file);
                const data = fs.readFileSync(filePath, 'utf8');
                const converter = new showdown.Converter({metadata: true});
                converter.makeHtml(data);
                const metadata = converter.getMetadata();
                return {
                    id: path.basename(file, '.md'),
                    author: metadata.author || 'Unknown',
                    title: metadata.title || path.basename(file, '.md'),
                    description: metadata.description || '',
                    keywords: metadata.keywords || [],
                    published: metadata.published,
                    file: file
                };
            });
            res.render('rss', {blogPosts});
        });
        return;
    }

    fs.readFile(tutorialPath, 'utf8', (err, data) => {
        if (err) {
            return res.status(404).send('Post not found');
        }

        const converter = new showdown.Converter({metadata: true});
        const html = converter.makeHtml(data);
        const metadata = converter.getMetadata();
        const tutorial = {
            title: metadata.title || tutorialName,
            author: metadata.author || 'Unknown',
            description: metadata.description || 'No description provided',
            keywords: metadata.keywords || ["No tags"],
            content: html
        };
        res.render('blogPost',{ tutorial, title: "Blog Post -> " + tutorial.title });
    });
});

module.exports = router;
