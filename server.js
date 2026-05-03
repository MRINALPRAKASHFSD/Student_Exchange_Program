const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = 'supersecret_exchange_key';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database setup
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) {
        console.error('Database opening error: ', err);
    } else {
        console.log('Connected to the SQLite database.');
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT,
            password TEXT,
            role TEXT DEFAULT 'student'
        )`);
        
        db.run(`CREATE TABLE IF NOT EXISTS activities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            activity TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
    }
});

// Helper function to generate an ID with non-repeating characters
function generateUniqueId(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = '';
    let availableChars = chars.split('');
    
    for (let i = 0; i < length; i++) {
        if (availableChars.length === 0) break;
        const randomIndex = Math.floor(Math.random() * availableChars.length);
        id += availableChars[randomIndex];
        availableChars.splice(randomIndex, 1); // Remove the used character
    }
    return id;
}

// Validation function for consecutive non-repeating characters in string
function hasRepeatingChars(str) {
    return /(.)\1/.test(str);
}

// Register route
app.post('/api/register', (req, res) => {
    const { name, password } = req.body;

    if (!name || !password) {
        return res.status(400).json({ error: 'Name and password are required' });
    }

    if (hasRepeatingChars(password)) {
        return res.status(400).json({ error: 'Password must consist of non-repeating characters.' });
    }

    let id;
    let idExists = true;
    
    // Generate a unique ID and ensure it doesn't exist
    const createAccount = () => {
        id = generateUniqueId();
        db.get('SELECT id FROM users WHERE id = ?', [id], (err, row) => {
            if (row) {
                createAccount(); // Retry if ID exists (highly unlikely)
            } else {
                bcrypt.hash(password, 10, (err, hash) => {
                    if (err) return res.status(500).json({ error: 'Hashing error' });
                    
                    db.run('INSERT INTO users (id, name, password) VALUES (?, ?, ?)', [id, name, hash], function(err) {
                        if (err) return res.status(500).json({ error: 'Database error' });
                        res.status(201).json({ message: 'User registered successfully', id: id });
                    });
                });
            }
        });
    };
    createAccount();
});

// Login route
app.post('/api/login', (req, res) => {
    const { id, password } = req.body;

    if (!id || !password) {
        return res.status(400).json({ error: 'ID and password are required' });
    }

    db.get('SELECT * FROM users WHERE id = ?', [id], (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!user) return res.status(401).json({ error: 'Invalid ID or password' });

        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) return res.status(500).json({ error: 'Comparison error' });
            if (!isMatch) return res.status(401).json({ error: 'Invalid ID or password' });

            const token = jwt.sign({ id: user.id, name: user.name, role: user.role }, SECRET_KEY, { expiresIn: '1h' });
            
            // Log activity
            db.run('INSERT INTO activities (user_id, activity) VALUES (?, ?)', [user.id, 'Logged in']);
            
            res.json({ message: 'Login successful', token, user: { id: user.id, name: user.name, role: user.role } });
        });
    });
});

// Middleware to verify token
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.status(401).json({ error: 'Unauthorized' });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: 'Forbidden' });
        req.user = user;
        next();
    });
}

// Dashboard data route
app.get('/api/dashboard', authenticateToken, (req, res) => {
    res.json({ message: `Welcome to the Student Exchange Program Dashboard, ${req.user.name}!`, user: req.user });
});

// Fallback to index.html for SPA-like behavior if needed
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
