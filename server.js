const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');

// ─── Environment & Persistence Configuration ──────────────────────────────────
const isVercel = process.env.VERCEL || false;
const DATA_DIR = isVercel ? '/tmp' : path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const uploadDir = isVercel ? '/tmp/uploads/' : path.join(__dirname, 'public/uploads/');
const SECRET_KEY = 'supersecret_exchange_key';

// ─── Permanent Initial Data (Baked-in fallback) ────────────────────────────────
const INITIAL_DB = {
  "activities": [
    { "id": 1, "user_id": "WKRT94LZ", "activity": "Logged in", "timestamp": "2026-05-03 16:28:04" },
    { "id": 2, "user_id": "ZKBYT4GX", "activity": "Logged in", "timestamp": "2026-05-03 16:38:22" },
    { "id": 3, "user_id": "V0QZS21G", "activity": "Logged in", "timestamp": "2026-05-03 16:49:51" },
    { "id": 4, "user_id": "WVHS54J2", "activity": "Logged in", "timestamp": "2026-05-03 17:10:24" },
    { "id": 5, "user_id": "ADMIN123", "activity": "Logged in", "timestamp": "2026-05-03 17:11:41" },
    { "id": 6, "user_id": "60XI2VRB", "activity": "Logged in", "timestamp": "2026-05-03 17:20:14" },
    { "id": 7, "user_id": "60XI2VRB", "activity": "Logged attendance for 2026-04-03", "timestamp": "2026-05-03 17:20:38" },
    { "id": 8, "user_id": "60XI2VRB", "activity": "Uploaded a photo", "timestamp": "2026-05-03 17:21:05" },
    { "id": 9, "user_id": "60XI2VRB", "activity": "Rated session: Day 1: Orientation", "timestamp": "2026-05-03 17:21:08" },
    { "id": 10, "user_id": "ADMIN123", "activity": "Logged in", "timestamp": "2026-05-03 17:21:33" },
    { "id": 11, "user_id": "ADMIN123", "activity": "Logged in", "timestamp": "2026-05-03 17:29:54" },
    { "id": 12, "user_id": "DCG0NB5P", "activity": "Logged in", "timestamp": "2026-05-03 17:31:03" },
    { "id": 13, "user_id": "0WMGCZKH", "activity": "Logged in", "timestamp": "2026-05-03 17:35:59" },
    { "id": 14, "user_id": "683LZTDM", "activity": "Logged in", "timestamp": "2026-05-03 17:50:21" },
    { "id": 15, "user_id": "mrinalprakash", "activity": "Logged in", "timestamp": "2026-05-03 18:16:22" },
    { "id": 16, "user_id": "RDOLFM67", "activity": "Logged in", "timestamp": "2026-05-03 18:18:06" },
    { "id": 17, "user_id": "mrinalprakash", "activity": "Logged in", "timestamp": "2026-05-03 18:42:23" }
  ],
  "certificates": {},
  "ratings": [
    { "id": 1, "user_id": "60XI2VRB", "session_name": "Day 1: Orientation", "rating": 5, "comments": "", "timestamp": "2026-05-03 17:21:08" }
  ],
  "attendance": [
    { "id": 1, "user_id": "60XI2VRB", "date": "2026-04-03", "status": "Absent", "timestamp": "2026-05-03 17:20:38" }
  ],
  "photos": [
    { "id": 1, "user_id": "60XI2VRB", "filename": "1777828865704-374439463.jpeg", "description": "", "timestamp": "2026-05-03 17:21:05" }
  ],
  "users": {
    "WKRT94LZ": { "id": "WKRT94LZ", "name": "Jane Doe", "password": "$2b$10$9BCLIpi7u5R2wIA/Sa75pevAMpvrPf8w7R1I.M4mIsbkmQfjN3CXC", "role": "student" },
    "VBJDPOSR": { "id": "VBJDPOSR", "name": "kajal", "password": "$2b$10$cLtEjnV.GB2pizSM4qUJQ.2aYhO3RQKDh2PljJIb6UhPtRa8YqhAa", "role": "student" },
    "1XJSVKNI": { "id": "1XJSVKNI", "name": "mrinal", "password": "$2b$10$K7Hmt.HmPQOyWNksapMeZuSgT0FYBoAngSw5.bq83J8VHCMPbvjoC", "role": "student" },
    "ZKBYT4GX": { "id": "ZKBYT4GX", "name": "aman", "password": "$2b$10$phwOnTKP5XONHgS7Vc.pW.s6eU95NSzmaE8aL2nYeUWsrE.BJ4ZlK", "role": "student" },
    "ADMIN123": { "id": "ADMIN123", "name": "Administrator", "password": "$2b$10$rqgam7mCYKs7r2RMoRuGK.bzopQB1/3Q5Lc10jMNZz2JbCb8rRDO2", "role": "admin" },
    "DAJVL90U": { "id": "DAJVL90U", "name": "aman", "password": "$2b$10$ar8F9.Fif2LxixDrZalxFOUBOj4GM7Ygu2kEWvlV.PfHOdz2veBA.", "role": "student" },
    "V0QZS21G": { "id": "V0QZS21G", "name": "aman", "password": "$2b$10$/xp8SWX/IUhFU6eD6g3PpuSQ8fMzK0ZQrCQuWWPUUcmZSMKDz3KyW", "role": "student" },
    "WVHS54J2": { "id": "WVHS54J2", "name": "aman", "password": "$2b$10$pvXXfKhM7JvMqNMaVA0pjONIs3I9pvx3Tf8CJAoFig.ybmjN6PCKC", "role": "student" },
    "KE7DMLGX": { "id": "KE7DMLGX", "name": "aman", "password": "$2b$10$s/JB2ALGnI33SspfZ1vE8.Fxk04APkfBZS2.uL/Yo1pNu0.lYXYKy", "role": "student" },
    "60XI2VRB": { "id": "60XI2VRB", "name": "Akshita", "password": "$2b$10$0VrLPiU0Z8MQC3/dc9rIDuEwIfX/fcylxe.QssG9BGsC9A.1DX.OS", "role": "student" },
    "DCG0NB5P": { "id": "DCG0NB5P", "name": "harshita", "password": "$2b$10$uKYGDAiVDLJOfXyz7Zutr.A6HvIgJwTa79Uc1RPxMfnHIReZ6e5DG", "role": "student" },
    "0WMGCZKH": { "id": "0WMGCZKH", "name": "harshita", "password": "$2b$10$MxTCVeDn35mX1xHQHPcmje4mo2qJdUuvR1AsYeAkh/383nnKoHfRq", "role": "student" },
    "683LZTDM": { "id": "683LZTDM", "name": "hiya", "password": "$2b$10$lmyvsXUE//QOupvPF5eSz.A8OhzCXwF/HqZfF0rLwrHM7I9PFZMOm", "role": "student" },
    "mrinalprakash": { "id": "mrinalprakash", "name": "Mrinal Prakash", "password": "$2b$10$pKE9soIDS2LIY2A9YBwmh.txug5ZURCFhC8J9/5R3SzIA7NO3yOzy", "role": "admin" },
    "akshita": { "id": "akshita", "name": "Akshita", "password": "$2b$10$RhNoLxsLoXhZKSH8AgprGOcBHYFdKYk78dtj6bqxgSOBIWaPj2Zp6", "role": "admin" },
    "harshdevjha": { "id": "harshdevjha", "name": "Harsh Dev Jha", "password": "$2b$10$Zrckve1vYSDq6zbyd7AHQuKl1JVu.uY/RwczpFL0LAd/N4Qmh4Xte", "role": "admin" },
    "amanchapadiya": { "id": "amanchapadiya", "name": "Aman Chapadiya", "password": "$2b$10$AsxETQQ680fAViqvLR6ERuH/1LPJ3rQPffL3wrx30J3IKQlj.EfkO", "role": "admin" },
    "manas": { "id": "manas", "name": "Manas", "password": "$2b$10$CBA6ttabWZHqKzsWOIMnKuV2lkoxucHVN.6jRLbVf/tQJtFNVR6z2", "role": "admin" },
    "67S5TGNB": { "id": "67S5TGNB", "name": "ananya12", "password": "$2b$10$PEbdPkGk9vz9oO1FUfs3y.wp1YOZJo.cEuVYS5DcTkbnwZXlgVKmq", "role": "student" },
    "RDOLFM67": { "id": "RDOLFM67", "name": "Ananya", "password": "$2b$10$Oo6Z0u4RC4b7kodd6H1zhuwbI5/8XYBnMawEBk8F5P0Y3y6Rlr80O", "role": "student" }
  }
};

// ─── Persistence Helpers ──────────────────────────────────────────────────────
function ensureDirs() {
    [DATA_DIR, uploadDir].forEach(dir => {
        try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
    });
}

function loadDB() {
    ensureDirs();
    try {
        if (fs.existsSync(DB_FILE)) {
            return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        }
    } catch (e) {}
    // If file missing or corrupted, return embedded initial data
    return JSON.parse(JSON.stringify(INITIAL_DB));
}

function saveDB(data) {
    ensureDirs();
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Save DB Error:', e.message);
    }
}

// ─── Express App Setup ───────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadDir));

// Route to serve photos (handles Vercel /tmp/uploads)
app.get('/uploads/:filename', (req, res) => {
    const filePath = path.join(uploadDir, req.params.filename);
    if (fs.existsSync(filePath)) res.sendFile(filePath);
    else res.status(404).send('Photo not found');
});

// Multer Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => { ensureDirs(); cb(null, uploadDir); },
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

// ─── Endpoints ────────────────────────────────────────────────────────────────

app.get('/api/debug', (req, res) => {
    const db = loadDB();
    res.json({
        isVercel,
        dbPath: DB_FILE,
        studentCount: Object.keys(db.users).length,
        attendanceCount: db.attendance.length
    });
});

app.post('/api/register', (req, res) => {
    const { name, password } = req.body;
    if (!name || !password) return res.status(400).json({ error: 'Missing fields' });
    
    const db = loadDB();
    const id = Math.random().toString(36).substring(2, 10).toUpperCase();
    const hash = bcrypt.hashSync(password, 10);
    const tempToken = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    db.users[id] = { id, name, password: hash, role: 'student' };
    db.temp_tokens = db.temp_tokens || {};
    db.temp_tokens[tempToken] = { userId: id, expiresAt: Date.now() + 60000 };
    
    saveDB(db);
    res.status(201).json({ id, tempToken });
});

app.post('/api/login', (req, res) => {
    const { id, password } = req.body;
    const db = loadDB();
    
    let user = db.users[id];
    let isToken = false;
    
    if (db.temp_tokens && db.temp_tokens[password]) {
        const t = db.temp_tokens[password];
        if (t.expiresAt > Date.now()) {
            user = db.users[t.userId];
            isToken = true;
            delete db.temp_tokens[password];
        }
    }
    
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (!isToken && !bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Invalid password' });
    
    db.activities.push({ user_id: user.id, activity: 'Logged in', timestamp: new Date().toISOString() });
    saveDB(db);
    
    const token = jwt.sign({ id: user.id, name: user.name, role: user.role }, SECRET_KEY, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
});

app.post('/api/attendance', authenticateToken, (req, res) => {
    const { date, session, status } = req.body;
    const db = loadDB();
    db.attendance.push({ id: Date.now(), user_id: req.user.id, date, session, status, timestamp: new Date().toISOString() });
    db.activities.push({ user_id: req.user.id, activity: `Attendance: ${date}`, timestamp: new Date().toISOString() });
    saveDB(db);
    res.json({ success: true });
});

app.post('/api/upload-photo', authenticateToken, upload.single('photo'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const db = loadDB();
    db.photos.push({ id: Date.now(), user_id: req.user.id, filename: req.file.filename, timestamp: new Date().toISOString() });
    db.activities.push({ user_id: req.user.id, activity: 'Photo Upload', timestamp: new Date().toISOString() });
    saveDB(db);
    res.json({ filename: req.file.filename });
});

app.post('/api/rate-session', authenticateToken, (req, res) => {
    const { session_name, rating, comments } = req.body;
    const db = loadDB();
    db.ratings.push({ id: Date.now(), user_id: req.user.id, session_name, rating, comments, timestamp: new Date().toISOString() });
    db.activities.push({ user_id: req.user.id, activity: `Rated: ${session_name}`, timestamp: new Date().toISOString() });
    saveDB(db);
    res.json({ success: true });
});

app.get('/api/admin/dashboard', authenticateAdmin, (req, res) => {
    const db = loadDB();
    const withNames = (arr) => arr.map(item => ({ ...item, name: db.users[item.user_id]?.name || item.user_id }));
    res.json({
        users: Object.values(db.users),
        attendance: withNames(db.attendance),
        photos: withNames(db.photos),
        ratings: withNames(db.ratings),
        activities: withNames(db.activities.slice(-100)),
        certificates: db.certificates
    });
});

app.post('/api/admin/certificate/:userId', authenticateAdmin, upload.single('certificate'), (req, res) => {
    const db = loadDB();
    db.certificates[req.params.userId] = { filename: req.file.filename, timestamp: new Date().toISOString() };
    saveDB(db);
    res.json({ success: true });
});

app.get('/api/user/certificate', authenticateToken, (req, res) => {
    const db = loadDB();
    const cert = db.certificates[req.user.id];
    if (!cert) return res.status(404).json({ error: 'Not found' });
    res.json(cert);
});

app.get('/api/admin/backup', authenticateAdmin, (req, res) => {
    const db = loadDB();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=db_backup.json');
    res.send(JSON.stringify(db, null, 2));
});

// SPA Support
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 3000;
if (!isVercel) app.listen(PORT, () => console.log(`Server on ${PORT}`));

module.exports = app;
