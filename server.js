const express = require('express');
let sqlite3;
try {
    sqlite3 = require('sqlite3').verbose();
} catch (e) {
    console.error("Failed to load sqlite3:", e);
    // Dummy object to prevent crashing later in the code
    sqlite3 = {
        Database: class {
            constructor(path, cb) {
                this.isMock = true;
                if (cb) setTimeout(() => cb(new Error("SQLite3 failed to load native bindings: " + e.message)), 0);
            }
            serialize() {}
            run() {}
            get() {}
            all() {}
        }
    };
}
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');

let isVercel = false;
try {
    // Attempt to write a test file to determine if the filesystem is read-only (e.g., Vercel Serverless)
    const testPath = path.join(__dirname, '.test-write');
    fs.writeFileSync(testPath, 'test');
    fs.unlinkSync(testPath);
} catch (err) {
    isVercel = true; // Filesystem is read-only
}

const uploadDir = isVercel ? '/tmp/uploads/' : path.join(__dirname, 'public/uploads/');
try {
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
} catch (e) {
    console.error("Failed to create upload directory:", e);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = 'supersecret_exchange_key';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
if (isVercel) {
    app.use('/uploads', express.static('/tmp/uploads'));
}

app.get('/api/debug', (req, res) => {
    res.json({
        isVercel,
        uploadDir,
        dbPath: isVercel ? '/tmp/database.sqlite' : './database.sqlite',
        dirname: __dirname,
        node_env: process.env.NODE_ENV,
        vercel_env: process.env.VERCEL
    });
});

// Database setup
const dbPath = isVercel ? '/tmp/database.sqlite' : './database.sqlite';
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Database opening error: ', err);
    } else {
        console.log('Connected to the SQLite database.');
        db.serialize(() => {
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
            
            db.run(`CREATE TABLE IF NOT EXISTS attendance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
                date TEXT,
                status TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
            
            db.run(`CREATE TABLE IF NOT EXISTS photos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
                filename TEXT,
                description TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
            
            db.run(`CREATE TABLE IF NOT EXISTS ratings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
                session_name TEXT,
                rating INTEGER,
                comments TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
            
            db.run(`CREATE TABLE IF NOT EXISTS certificates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
                filename TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Ensure default admins exist synchronously to prevent race conditions on cold start
            const defaultAdmins = [
                { id: 'mrinalprakash', name: 'Mrinal Prakash', pass: 'mrinalprakash' },
                { id: 'akshita', name: 'Akshita', pass: 'akshita' },
                { id: 'harshdevjha', name: 'Harsh Dev Jha', pass: 'harshdevjha' },
                { id: 'amanchapadiya', name: 'Aman Chapadiya', pass: 'amanchapadiya' },
                { id: 'manas', name: 'Manas', pass: 'manas' }
            ];

            defaultAdmins.forEach(admin => {
                const hash = bcrypt.hashSync(admin.pass, 10);
                db.run('INSERT OR IGNORE INTO users (id, name, password, role) VALUES (?, ?, ?, ?)', [admin.id, admin.name, hash, 'admin']);
            });
        });
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

// Middleware for Admin access
function authenticateAdmin(req, res, next) {
    authenticateToken(req, res, () => {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        next();
    });
}

// Dashboard data route
app.get('/api/dashboard', authenticateToken, (req, res) => {
    res.json({ message: `Welcome to the Student Exchange Program Dashboard, ${req.user.name}!`, user: req.user });
});

// Post attendance
app.post('/api/attendance', authenticateToken, (req, res) => {
    const { date, status } = req.body;
    db.run('INSERT INTO attendance (user_id, date, status) VALUES (?, ?, ?)', [req.user.id, date, status], function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        
        db.run('INSERT INTO activities (user_id, activity) VALUES (?, ?)', [req.user.id, `Logged attendance for ${date}`]);
        res.json({ message: 'Attendance logged successfully' });
    });
});

// Upload photo
app.post('/api/upload-photo', authenticateToken, upload.single('photo'), (req, res) => {
    const { description } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    db.run('INSERT INTO photos (user_id, filename, description) VALUES (?, ?, ?)', [req.user.id, req.file.filename, description], function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        
        db.run('INSERT INTO activities (user_id, activity) VALUES (?, ?)', [req.user.id, 'Uploaded a photo']);
        res.json({ message: 'Photo uploaded successfully', filename: req.file.filename });
    });
});

// Rate session
app.post('/api/rate-session', authenticateToken, (req, res) => {
    const { session_name, rating, comments } = req.body;
    db.run('INSERT INTO ratings (user_id, session_name, rating, comments) VALUES (?, ?, ?, ?)', [req.user.id, session_name, rating, comments], function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        
        db.run('INSERT INTO activities (user_id, activity) VALUES (?, ?)', [req.user.id, `Rated session: ${session_name}`]);
        res.json({ message: 'Rating submitted successfully' });
    });
});

// Admin Dashboard Data
app.get('/api/admin/dashboard', authenticateAdmin, (req, res) => {
    const data = {};
    db.all('SELECT id, name, role FROM users', [], (err, users) => {
        data.users = users || [];
        db.all('SELECT a.id, u.name, u.id as student_id, a.date, a.status, a.timestamp FROM attendance a JOIN users u ON a.user_id = u.id ORDER BY a.timestamp DESC', [], (err, attendance) => {
            data.attendance = attendance || [];
            db.all('SELECT p.id, u.name, u.id as student_id, p.filename, p.description, p.timestamp FROM photos p JOIN users u ON p.user_id = u.id ORDER BY p.timestamp DESC', [], (err, photos) => {
                data.photos = photos || [];
                db.all('SELECT r.id, u.name, u.id as student_id, r.session_name, r.rating, r.comments, r.timestamp FROM ratings r JOIN users u ON r.user_id = u.id ORDER BY r.timestamp DESC', [], (err, ratings) => {
                    data.ratings = ratings || [];
                    db.all('SELECT ac.id, u.name, u.id as student_id, ac.activity, ac.timestamp FROM activities ac JOIN users u ON ac.user_id = u.id ORDER BY ac.timestamp DESC LIMIT 100', [], (err, activities) => {
                        data.activities = activities || [];
                        res.json(data);
                    });
                });
            });
        });
    });
});

// Admin upload certificate
app.post('/api/admin/certificate/:userId', authenticateAdmin, upload.single('certificate'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No certificate file provided' });
    const { userId } = req.params;
    
    // Replace if exists
    db.run('DELETE FROM certificates WHERE user_id = ?', [userId], (err) => {
        db.run('INSERT INTO certificates (user_id, filename) VALUES (?, ?)', [userId, req.file.filename], function(err) {
            if (err) return res.status(500).json({ error: 'Database error' });
            res.json({ message: 'Certificate uploaded successfully', filename: req.file.filename });
        });
    });
});

// Student get certificate
app.get('/api/user/certificate', authenticateToken, (req, res) => {
    db.get('SELECT filename FROM certificates WHERE user_id = ?', [req.user.id], (err, row) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!row) return res.status(404).json({ error: 'Certificate not found' });
        res.json({ filename: row.filename });
    });
});

// Fallback for SPA routing
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
    console.error("Unhandled Error:", err);
    res.status(500).json({ error: 'Internal Server Error', details: err.message, stack: err.stack });
});

if (!isVercel) {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

module.exports = app;
