const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');

// ─── Environment Detection ───────────────────────────────────────────────────
let isVercel = false;
try {
    const testPath = path.join(__dirname, '.test-write');
    fs.writeFileSync(testPath, 'test');
    fs.unlinkSync(testPath);
} catch (err) {
    isVercel = true;
}

const DATA_DIR = isVercel ? '/tmp' : path.join(__dirname, 'data');
const DB_FILE  = path.join(DATA_DIR, 'db.json');
const uploadDir = isVercel ? '/tmp/uploads/' : path.join(__dirname, 'public/uploads/');

// ─── Ensure directories exist ─────────────────────────────────────────────────
[DATA_DIR, uploadDir].forEach(dir => {
    try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
});

// ─── Pre-computed bcrypt hashes for admin accounts ───────────────────────────
// Generated with: bcrypt.hashSync('password', 10)
// These are hardcoded so login works instantly on cold start (no DB needed)
const ADMIN_ACCOUNTS = {
    'mrinalprakash': {
        id: 'mrinalprakash', name: 'Mrinal Prakash',
        password: bcrypt.hashSync('mrinalprakash', 10), role: 'admin'
    },
    'akshita': {
        id: 'akshita', name: 'Akshita',
        password: bcrypt.hashSync('akshita', 10), role: 'admin'
    },
    'harshdevjha': {
        id: 'harshdevjha', name: 'Harsh Dev Jha',
        password: bcrypt.hashSync('harshdevjha', 10), role: 'admin'
    },
    'amanchapadiya': {
        id: 'amanchapadiya', name: 'Aman Chapadiya',
        password: bcrypt.hashSync('amanchapadiya', 10), role: 'admin'
    },
    'manas': {
        id: 'manas', name: 'Manas',
        password: bcrypt.hashSync('manas', 10), role: 'admin'
    }
};

// ─── Pure-JS JSON Database (no native bindings) ──────────────────────────────
function loadDB() {
    try {
        if (fs.existsSync(DB_FILE)) {
            return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        }
    } catch (e) {}
    return { users: {}, activities: [], attendance: [], photos: [], ratings: [], certificates: {} };
}

function saveDB(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data));
    } catch (e) {
        console.error('Failed to save DB:', e.message);
    }
}

// ─── Express App ─────────────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = 'supersecret_exchange_key';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadDir));

// ─── Multer ───────────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname))
});
const upload = multer({ storage });

// ─── Auth Middleware ──────────────────────────────────────────────────────────
function authenticateToken(req, res, next) {
    const token = (req.headers['authorization'] || '').split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: 'Forbidden' });
        req.user = user;
        next();
    });
}

function authenticateAdmin(req, res, next) {
    authenticateToken(req, res, () => {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
        next();
    });
}

// ─── Debug Route ──────────────────────────────────────────────────────────────
app.get('/api/debug', (req, res) => {
    const db = loadDB();
    res.json({
        isVercel, DATA_DIR, DB_FILE, uploadDir,
        adminCount: Object.keys(ADMIN_ACCOUNTS).length,
        studentCount: Object.keys(db.users).length
    });
});

// ─── Helper ───────────────────────────────────────────────────────────────────
function generateUniqueId(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let available = chars.split('');
    let id = '';
    for (let i = 0; i < length && available.length; i++) {
        const idx = Math.floor(Math.random() * available.length);
        id += available.splice(idx, 1)[0];
    }
    return id;
}

function hasRepeatingChars(str) {
    return /(.)\\1/.test(str);
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// Register
app.post('/api/register', (req, res) => {
    const { name, password } = req.body;
    if (!name || !password) return res.status(400).json({ error: 'Name and password are required' });

    const db = loadDB();
    let id;
    do { id = generateUniqueId(); } while (db.users[id]);

    const hash = bcrypt.hashSync(password, 10);
    db.users[id] = { id, name, password: hash, role: 'student' };
    saveDB(db);
    res.status(201).json({ message: 'User registered successfully', id });
});

// Login
app.post('/api/login', (req, res) => {
    const { id, password } = req.body;
    if (!id || !password) return res.status(400).json({ error: 'ID and password are required' });

    // Check hardcoded admins first (works even if /tmp is wiped)
    const adminUser = ADMIN_ACCOUNTS[id];
    if (adminUser) {
        const isMatch = bcrypt.compareSync(password, adminUser.password);
        if (!isMatch) return res.status(401).json({ error: 'Invalid ID or password' });
        const token = jwt.sign({ id: adminUser.id, name: adminUser.name, role: 'admin' }, SECRET_KEY, { expiresIn: '24h' });
        return res.json({ message: 'Login successful', token, user: { id: adminUser.id, name: adminUser.name, role: 'admin' } });
    }

    // Check student accounts from JSON db
    const db = loadDB();
    const user = db.users[id];
    if (!user) return res.status(401).json({ error: 'Invalid ID or password' });

    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid ID or password' });

    db.activities.push({ user_id: id, activity: 'Logged in', timestamp: new Date().toISOString() });
    saveDB(db);

    const token = jwt.sign({ id: user.id, name: user.name, role: user.role }, SECRET_KEY, { expiresIn: '24h' });
    res.json({ message: 'Login successful', token, user: { id: user.id, name: user.name, role: user.role } });
});

// Dashboard
app.get('/api/dashboard', authenticateToken, (req, res) => {
    res.json({ message: `Welcome to the Student Exchange Program Dashboard, ${req.user.name}!`, user: req.user });
});

// Attendance
app.post('/api/attendance', authenticateToken, (req, res) => {
    const { date, session, status } = req.body;
    const db = loadDB();
    db.attendance.push({ 
        id: Date.now(), 
        user_id: req.user.id, 
        date, 
        session, 
        status, 
        timestamp: new Date().toISOString() 
    });
    db.activities.push({ user_id: req.user.id, activity: `Logged attendance for ${date} (${session})`, timestamp: new Date().toISOString() });
    saveDB(db);
    res.json({ message: 'Attendance logged successfully' });
});

// Upload photo
app.post('/api/upload-photo', authenticateToken, upload.single('photo'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const db = loadDB();
    db.photos.push({ id: Date.now(), user_id: req.user.id, filename: req.file.filename, description: req.body.description, timestamp: new Date().toISOString() });
    db.activities.push({ user_id: req.user.id, activity: 'Uploaded a photo', timestamp: new Date().toISOString() });
    saveDB(db);
    res.json({ message: 'Photo uploaded successfully', filename: req.file.filename });
});

// Rate session
app.post('/api/rate-session', authenticateToken, (req, res) => {
    const { session_name, rating, comments } = req.body;
    const db = loadDB();
    db.ratings.push({ id: Date.now(), user_id: req.user.id, session_name, rating, comments, timestamp: new Date().toISOString() });
    db.activities.push({ user_id: req.user.id, activity: `Rated session: ${session_name}`, timestamp: new Date().toISOString() });
    saveDB(db);
    res.json({ message: 'Rating submitted successfully' });
});

// Admin Dashboard
app.get('/api/admin/dashboard', authenticateAdmin, (req, res) => {
    const db = loadDB();
    const users = Object.values(db.users).map(u => ({ id: u.id, name: u.name, role: u.role }));

    const withName = (records) => records.map(r => {
        const user = db.users[r.user_id] || {};
        return { ...r, name: user.name || r.user_id, student_id: r.user_id };
    });

    res.json({
        users,
        attendance: withName([...db.attendance].reverse()),
        photos: withName([...db.photos].reverse()),
        ratings: withName([...db.ratings].reverse()),
        activities: withName([...db.activities].reverse().slice(0, 100)),
        certificates: db.certificates
    });
});

// Admin upload certificate
app.post('/api/admin/certificate/:userId', authenticateAdmin, upload.single('certificate'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No certificate file provided' });
    const db = loadDB();
    db.certificates[req.params.userId] = { filename: req.file.filename, timestamp: new Date().toISOString() };
    saveDB(db);
    res.json({ message: 'Certificate uploaded successfully', filename: req.file.filename });
});

// Student get certificate
app.get('/api/user/certificate', authenticateToken, (req, res) => {
    const db = loadDB();
    const cert = db.certificates[req.user.id];
    if (!cert) return res.status(404).json({ error: 'Certificate not found' });
    res.json({ filename: cert.filename, timestamp: cert.timestamp });
});

// SPA fallback
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err);
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

if (!isVercel) {
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

module.exports = app;
