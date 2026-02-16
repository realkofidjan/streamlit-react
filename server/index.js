const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 4000;

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

const DEFAULT_MOVIES_DIR = '/Volumes/Lexar-NK&D/Movies';
const DEFAULT_TV_DIR = '/Volumes/Lexar-NK&D/Tv Shows';

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch { /* use defaults */ }
  return { moviesDir: DEFAULT_MOVIES_DIR, tvDir: DEFAULT_TV_DIR };
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

let config = loadConfig();
let MOVIES_DIR = config.moviesDir;
let TV_DIR = config.tvDir;

const INITIAL_CHUNK = 2 * 1024 * 1024;
const BUFFER_CHUNK = 10 * 1024 * 1024;
const STREAM_HWM = 64 * 1024;

app.use(cors());
app.use(express.json());

// Auto-create data directory and users file
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]');

const MIME_TYPES = {
  '.mp4': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.webm': 'video/webm',
  '.avi': 'video/x-msvideo',
  '.m4v': 'video/mp4',
};
const VIDEO_EXTS = Object.keys(MIME_TYPES);

function listVideoFiles(dir) {
  return fs.readdirSync(dir).filter((f) => {
    if (f.startsWith('.')) return false;
    return VIDEO_EXTS.includes(path.extname(f).toLowerCase());
  });
}

function readUsers() {
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function streamFile(filePath, req, res) {
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const requestedEnd = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const maxChunk = start === 0 ? INITIAL_CHUNK : BUFFER_CHUNK;
    const end = Math.min(requestedEnd, start + maxChunk - 1, fileSize - 1);
    const chunkSize = end - start + 1;
    const stream = fs.createReadStream(filePath, { start, end, highWaterMark: STREAM_HWM });
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
    });
    stream.pipe(res);
  } else {
    const end = Math.min(INITIAL_CHUNK - 1, fileSize - 1);
    const chunkSize = end + 1;
    const stream = fs.createReadStream(filePath, { start: 0, end, highWaterMark: STREAM_HWM });
    res.writeHead(206, {
      'Content-Range': `bytes 0-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
    });
    stream.pipe(res);
  }
}

// ========== USERS ==========

app.get('/api/users', (req, res) => {
  const users = readUsers().map(({ pin, ...u }) => u);
  res.json(users);
});

app.post('/api/users', (req, res) => {
  const { username, pin, avatar } = req.body;
  if (!username || !pin) return res.status(400).json({ error: 'Username and PIN required' });
  const users = readUsers();
  const user = {
    id: crypto.randomUUID(),
    username,
    pin: String(pin),
    avatar: avatar || 'red',
    watchHistory: { movies: {}, episodes: {} },
    watchlist: { movies: {}, shows: {} },
  };
  users.push(user);
  writeUsers(users);
  const { pin: _, ...safe } = user;
  res.status(201).json(safe);
});

app.post('/api/users/login', (req, res) => {
  const { userId, pin } = req.body;
  const users = readUsers();
  const user = users.find((u) => u.id === userId);
  if (!user || user.pin !== String(pin)) return res.status(401).json({ error: 'Invalid PIN' });
  const { pin: _, ...safe } = user;
  res.json(safe);
});

app.get('/api/users/:id/history', (req, res) => {
  const users = readUsers();
  const user = users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user.watchHistory);
});

app.delete('/api/users/:id/history/watching', (req, res) => {
  const users = readUsers();
  const user = users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  for (const entry of Object.values(user.watchHistory.movies)) {
    if (entry.status === 'watching') entry.status = 'watched';
  }
  for (const entry of Object.values(user.watchHistory.episodes)) {
    if (entry.status === 'watching') entry.status = 'watched';
  }
  writeUsers(users);
  res.json(user.watchHistory);
});

app.put('/api/users/:id/history', (req, res) => {
  const { mediaType, mediaId, status, progress, currentTime, filename, showName, season, episode, showId, title, posterPath } = req.body;
  const users = readUsers();
  const user = users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const key = mediaType === 'movie' ? 'movies' : 'episodes';

  // For episodes: mark other episodes of the same show as 'watched'
  // so only the latest episode appears in Continue Watching
  if (mediaType === 'episode' && showId && status === 'watching') {
    for (const [epId, entry] of Object.entries(user.watchHistory.episodes)) {
      if (epId !== mediaId && entry.showId === showId && entry.status === 'watching') {
        entry.status = 'watched';
      }
    }
  }

  user.watchHistory[key][mediaId] = {
    ...(user.watchHistory[key][mediaId] || {}),
    status, progress, filename, title, posterPath,
    ...(currentTime != null && { currentTime }),
    ...(showId && { showId }),
    ...(showName && { showName }),
    ...(season != null && { season }),
    ...(episode != null && { episode }),
    updatedAt: new Date().toISOString(),
  };
  writeUsers(users);
  res.json(user.watchHistory);
});

// ========== WATCHLIST ==========

app.put('/api/users/:id/watchlist', (req, res) => {
  const { type, mediaId, title, posterPath } = req.body;
  const users = readUsers();
  const user = users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!user.watchlist) user.watchlist = { movies: {}, shows: {} };
  const key = type === 'movie' ? 'movies' : 'shows';
  user.watchlist[key][mediaId] = { title, posterPath, addedAt: new Date().toISOString() };
  writeUsers(users);
  res.json(user.watchlist);
});

app.delete('/api/users/:id/watchlist/:type/:mediaId', (req, res) => {
  const users = readUsers();
  const user = users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!user.watchlist) user.watchlist = { movies: {}, shows: {} };
  const key = req.params.type === 'movie' ? 'movies' : 'shows';
  delete user.watchlist[key][req.params.mediaId];
  writeUsers(users);
  res.json(user.watchlist);
});

// ========== CONFIG ==========

app.get('/api/config/media-paths', (req, res) => {
  res.json({
    moviesDir: MOVIES_DIR,
    tvDir: TV_DIR,
    moviesDirExists: fs.existsSync(MOVIES_DIR),
    tvDirExists: fs.existsSync(TV_DIR),
  });
});

app.put('/api/config/media-paths', (req, res) => {
  const { moviesDir, tvDir, userId } = req.body;
  // Only Fiifi can change paths
  const users = readUsers();
  const user = users.find((u) => u.id === userId);
  if (!user || user.username.toLowerCase() !== 'fiifi') {
    return res.status(403).json({ error: 'Not authorized' });
  }
  if (!moviesDir || !tvDir) return res.status(400).json({ error: 'Both paths required' });

  MOVIES_DIR = moviesDir;
  TV_DIR = tvDir;
  config = { moviesDir, tvDir };
  saveConfig(config);

  res.json({
    moviesDir: MOVIES_DIR,
    tvDir: TV_DIR,
    moviesDirExists: fs.existsSync(MOVIES_DIR),
    tvDirExists: fs.existsSync(TV_DIR),
  });
});

// ========== LIBRARY ==========

app.get('/api/library', (req, res) => {
  try {
    const movies = listVideoFiles(MOVIES_DIR).map((f) => ({
      filename: f, name: f.replace(/\.[^.]+$/, ''),
    }));
    let tvShows = [];
    if (fs.existsSync(TV_DIR)) {
      tvShows = fs.readdirSync(TV_DIR)
        .filter((f) => !f.startsWith('.') && fs.statSync(path.join(TV_DIR, f)).isDirectory())
        .map((d) => ({ name: d }));
    }
    res.json({ movies, tvShows });
  } catch (err) {
    res.status(500).json({ error: 'Cannot read library' });
  }
});

// ========== MOVIES ==========

app.get('/api/movies', (req, res) => {
  try {
    const files = listVideoFiles(MOVIES_DIR);
    res.json(files.map((f) => ({ filename: f, name: f.replace(/\.[^.]+$/, '') })));
  } catch (err) {
    res.status(500).json({ error: 'Cannot read movies directory' });
  }
});

app.get('/api/movies/search', (req, res) => {
  const query = normalizeSearch(req.query.q || '');
  if (!query) return res.json([]);
  try {
    const files = listVideoFiles(MOVIES_DIR);
    const matches = files
      .filter((f) => normalizeSearch(f).includes(query))
      .map((f) => ({ filename: f, name: f.replace(/\.[^.]+$/, '') }));
    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: 'Cannot search movies' });
  }
});

app.get('/api/movies/stream/:filename', (req, res) => {
  streamFile(path.join(MOVIES_DIR, req.params.filename), req, res);
});

// ========== TV SHOWS ==========

app.get('/api/tv', (req, res) => {
  try {
    const dirs = fs.readdirSync(TV_DIR).filter((f) =>
      !f.startsWith('.') && fs.statSync(path.join(TV_DIR, f)).isDirectory()
    );
    res.json(dirs.map((d) => ({ name: d })));
  } catch (err) {
    res.status(500).json({ error: 'Cannot read TV directory' });
  }
});

function normalizeSearch(str) {
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

app.get('/api/tv/search', (req, res) => {
  const query = normalizeSearch(req.query.q || '');
  if (!query) return res.json([]);
  try {
    const dirs = fs.readdirSync(TV_DIR).filter((f) =>
      !f.startsWith('.') && fs.statSync(path.join(TV_DIR, f)).isDirectory()
    );
    const matches = dirs
      .filter((d) => normalizeSearch(d).includes(query))
      .map((d) => ({ name: d }));
    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: 'Cannot search TV shows' });
  }
});

app.get('/api/tv/:show/seasons', (req, res) => {
  const showDir = path.join(TV_DIR, req.params.show);
  if (!fs.existsSync(showDir)) return res.status(404).json({ error: 'Show not found' });
  try {
    const dirs = fs.readdirSync(showDir).filter((f) =>
      !f.startsWith('.') && fs.statSync(path.join(showDir, f)).isDirectory()
    );
    res.json(dirs.map((d) => ({ name: d })));
  } catch (err) {
    res.status(500).json({ error: 'Cannot read seasons' });
  }
});

app.get('/api/tv/:show/:season/episodes', (req, res) => {
  const seasonDir = path.join(TV_DIR, req.params.show, req.params.season);
  if (!fs.existsSync(seasonDir)) return res.status(404).json({ error: 'Season not found' });
  try {
    const files = listVideoFiles(seasonDir);
    res.json(files.map((f) => ({ filename: f, name: f.replace(/\.[^.]+$/, '') })));
  } catch (err) {
    res.status(500).json({ error: 'Cannot read episodes' });
  }
});

app.get('/api/tv/:show/:season/stream/:filename', (req, res) => {
  streamFile(path.join(TV_DIR, req.params.show, req.params.season, req.params.filename), req, res);
});

// ========== DOWNLOADS ==========

// Downie landing zone — set Downie's download folder to this path
const DOWNIE_LANDING = path.join(__dirname, 'downie-landing');
if (!fs.existsSync(DOWNIE_LANDING)) fs.mkdirSync(DOWNIE_LANDING, { recursive: true });

// Sequential download queue — Downie downloads one at a time
const downloadQueue = [];
let currentDownload = null;

function processQueue() {
  if (currentDownload || downloadQueue.length === 0) return;
  currentDownload = downloadQueue.shift();
  currentDownload.status = 'downloading';
  console.log(`Opening Downie for: ${currentDownload.targetName}`);
  spawn('open', ['-a', 'Downie 4', currentDownload.url]);
}

app.post('/api/download/movie', (req, res) => {
  const { tmdbId, title, year } = req.body;
  if (!tmdbId || !title) return res.status(400).json({ error: 'tmdbId and title required' });

  const targetName = `${title} (${year || 'Unknown'})`;
  const item = { type: 'movie', targetName, targetDir: MOVIES_DIR, url: `https://mapple.mov/watch/movie/${tmdbId}`, status: 'queued' };
  downloadQueue.push(item);
  processQueue();
  res.json({ ok: true, message: `Will be saved as: ${targetName}`, queue: downloadQueue.length });
});

app.post('/api/download/episode', (req, res) => {
  const { tmdbId, showName, season, episode, episodeTitle } = req.body;
  if (!tmdbId || !showName || !season || !episode) {
    return res.status(400).json({ error: 'tmdbId, showName, season, episode required' });
  }

  const sn = String(season).padStart(2, '0');
  const ep = String(episode).padStart(2, '0');
  const epTitle = episodeTitle ? ` - ${episodeTitle}` : '';
  const targetName = `S${sn}E${ep}${epTitle}`;
  const targetDir = path.join(TV_DIR, showName, `Season ${season}`);
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  const item = { type: 'episode', targetName, targetDir, url: `https://mapple.mov/watch/tv/${tmdbId}-${season}-${episode}`, status: 'queued' };
  downloadQueue.push(item);
  processQueue();
  res.json({ ok: true, message: `Will be saved as: ${showName}/Season ${season}/${targetName}`, queue: downloadQueue.length });
});

// Watch landing zone — when a file appears, it belongs to currentDownload
setInterval(() => {
  if (!currentDownload) return;
  try {
    const files = fs.readdirSync(DOWNIE_LANDING)
      .filter((f) => !f.startsWith('.') && !f.endsWith('.part') && !f.endsWith('.download') && !f.endsWith('.crdownload'))
      .map((f) => {
        const filePath = path.join(DOWNIE_LANDING, f);
        const stat = fs.statSync(filePath);
        return { name: f, path: filePath, size: stat.size, modTime: stat.mtimeMs };
      })
      .filter((f) => f.size > 10000)
      .filter((f) => Date.now() - f.modTime > 5000); // not still being written

    if (files.length === 0) return;

    // Take the first completed file — it belongs to currentDownload
    const file = files[0];
    const ext = path.extname(file.name) || '.mp4';
    const destPath = path.join(currentDownload.targetDir, currentDownload.targetName + ext);

    try {
      fs.renameSync(file.path, destPath);
      console.log(`Moved: ${file.name} -> ${destPath}`);
    } catch {
      fs.copyFileSync(file.path, destPath);
      fs.unlinkSync(file.path);
      console.log(`Copied: ${file.name} -> ${destPath}`);
    }

    console.log(`Download complete: ${currentDownload.targetName}`);
    currentDownload = null;
    processQueue(); // start next in queue
  } catch (err) {
    console.error('Landing zone watch error:', err.message);
  }
}, 5000);

app.get('/api/download/status', (req, res) => {
  res.json({
    landingZone: DOWNIE_LANDING,
    current: currentDownload ? { type: currentDownload.type, targetName: currentDownload.targetName } : null,
    queued: downloadQueue.map((d) => ({ type: d.type, targetName: d.targetName })),
  });
});

// ========== START ==========

app.listen(PORT, () => {
  console.log(`Media server running on http://localhost:${PORT}`);
  console.log(`Movies: ${MOVIES_DIR}`);
  console.log(`TV Shows: ${TV_DIR}`);
});
