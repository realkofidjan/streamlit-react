require('dotenv').config();
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
const NOTIFICATIONS_FILE = path.join(DATA_DIR, 'notifications.json');

const DEFAULT_MOVIES_DIRS = ['/Volumes/Lexar-NK&D/Movies'];
const DEFAULT_TV_DIRS = ['/Volumes/Lexar-NK&D/Tv Shows'];

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      // Migrate old single-string format to arrays
      const moviesDirs = raw.moviesDirs || (raw.moviesDir ? [raw.moviesDir] : DEFAULT_MOVIES_DIRS);
      const tvDirs = raw.tvDirs || (raw.tvDir ? [raw.tvDir] : DEFAULT_TV_DIRS);
      return { moviesDirs, tvDirs };
    }
  } catch { /* use defaults */ }
  return { moviesDirs: [...DEFAULT_MOVIES_DIRS], tvDirs: [...DEFAULT_TV_DIRS] };
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

let config = loadConfig();
let MOVIES_DIRS = config.moviesDirs;
let TV_DIRS = config.tvDirs;

const INITIAL_CHUNK = 1024 * 1024; // 1MB
const BUFFER_CHUNK = 10 * 1024 * 1024; // 10MB
const STREAM_HWM = 64 * 1024;

app.use(cors());
app.use(express.json());

// Auto-create data directory and files
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]');
if (!fs.existsSync(NOTIFICATIONS_FILE)) fs.writeFileSync(NOTIFICATIONS_FILE, '[]');

function readNotifications() {
  try { return JSON.parse(fs.readFileSync(NOTIFICATIONS_FILE, 'utf-8')); } catch { return []; }
}
function writeNotifications(notifs) {
  fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(notifs, null, 2));
}

// Basic health check
app.get('/', (req, res) => {
  res.send('StreamIt Media Server: Online');
});

const MIME_TYPES = {
  '.mp4': 'application/octet-stream', // Was 'video/mp4' - changed to bypass Cloudflare buffering
  '.mkv': 'video/x-matroska',
  '.webm': 'video/webm',
  '.avi': 'video/x-msvideo',
  '.m4v': 'video/mp4',
};
const VIDEO_EXTS = Object.keys(MIME_TYPES);

function listVideoFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => {
    if (f.startsWith('.')) return false;
    return VIDEO_EXTS.includes(path.extname(f).toLowerCase());
  });
}

// List video files across multiple directories
function listVideoFilesMulti(dirs) {
  const all = [];
  for (const dir of dirs) {
    for (const f of listVideoFiles(dir)) {
      all.push({ filename: f, name: f.replace(/\.[^.]+$/, ''), _dir: dir });
    }
  }
  return all;
}

// Find a movie file across all movie dirs
function findMovieFile(filename) {
  for (const dir of MOVIES_DIRS) {
    const filePath = path.join(dir, filename);
    if (fs.existsSync(filePath)) return filePath;
  }
  return null;
}

// List all TV show directories across all TV dirs
function listTvShows() {
  const shows = [];
  for (const dir of TV_DIRS) {
    if (!fs.existsSync(dir)) continue;
    const dirs = fs.readdirSync(dir).filter((f) =>
      !f.startsWith('.') && fs.statSync(path.join(dir, f)).isDirectory()
    );
    for (const d of dirs) {
      shows.push({ name: d, _dir: dir });
    }
  }
  return shows;
}

// Find a TV show directory across all TV dirs
function findTvShowDir(showName) {
  for (const dir of TV_DIRS) {
    const showDir = path.join(dir, showName);
    if (fs.existsSync(showDir) && fs.statSync(showDir).isDirectory()) return showDir;
  }
  return null;
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
  const ext = path.extname(filePath).toLowerCase();
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const requestedEnd = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    // Use smaller chunks for initial request to make Safari happy
    const maxChunk = start === 0 ? INITIAL_CHUNK : BUFFER_CHUNK;

    // If client requested a specific end, RESPECT IT unless it's way too big
    let end = requestedEnd;
    if (!parts[1]) {
      // No end specified, use our chunk size
      end = Math.min(start + maxChunk - 1, fileSize - 1);
    } else {
      // End specified, but check if we should still limit it (e.g. download accelerators requesting whole file)
      // For now, let's respect the request if it's small, but cap huge requests
      if (end - start > BUFFER_CHUNK) {
        end = Math.min(start + maxChunk - 1, fileSize - 1);
      }
    }

    // Ensure we don't go past file size
    end = Math.min(end, fileSize - 1);

    const chunkSize = end - start + 1;

    // Log the range request for debugging
    console.log(`Stream: ${req.url} | Range: ${start}-${end}/${fileSize} (${chunkSize} bytes)`);

    const stream = fs.createReadStream(filePath, { start, end, highWaterMark: STREAM_HWM });
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    });

    stream.pipe(res);
    stream.on('error', (err) => {
      if (err.code === 'ECONNRESET' || err.code === 'EPIPE') {
        // Client closed connection, normal for video streaming
        return;
      }
      console.error('Stream error:', err);
    });
  } else {
    const end = Math.min(INITIAL_CHUNK - 1, fileSize - 1);
    const chunkSize = end + 1;
    const stream = fs.createReadStream(filePath, { start: 0, end, highWaterMark: STREAM_HWM });
    res.writeHead(206, {
      'Content-Range': `bytes 0-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
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
  if (users.length >= 6) return res.status(400).json({ error: 'Maximum of 6 profiles reached' });
  const user = {
    id: crypto.randomUUID(),
    username,
    pin: String(pin),
    avatar: avatar || 'red',
    emoji: null,
    watchHistory: { movies: {}, episodes: {} },
    watchlist: { movies: {}, shows: {} },
    createdAt: new Date().toISOString(),
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

app.delete('/api/users/:id', (req, res) => {
  const users = readUsers();
  const index = users.findIndex((u) => u.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'User not found' });
  const { pin, adminId } = req.body || {};

  // Admin delete: Fiifi can delete any user without their PIN
  if (adminId) {
    const admin = users.find((u) => u.id === adminId);
    if (!admin || admin.username.toLowerCase() !== 'fiifi') {
      return res.status(403).json({ error: 'Only admin can delete other users' });
    }
  } else {
    // Self-delete: requires own PIN
    if (users[index].pin !== String(pin)) return res.status(401).json({ error: 'Invalid PIN' });
  }

  users.splice(index, 1);
  writeUsers(users);
  res.json({ success: true });
});

// ========== PROFILE ==========

app.put('/api/users/:id/profile', (req, res) => {
  const { username, currentPin, newPin, emoji, avatar } = req.body;
  const users = readUsers();
  const user = users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (username !== undefined) user.username = username;
  if (emoji !== undefined) user.emoji = emoji === '' ? null : emoji;
  if (avatar !== undefined) user.avatar = avatar;
  if (currentPin && newPin) {
    if (user.pin !== String(currentPin)) return res.status(401).json({ error: 'Current PIN is incorrect' });
    user.pin = String(newPin);
  }

  console.log(`[PROFILE UPDATE] User ${user.username} (${user.id}) updated:`, {
    username: user.username,
    emoji: user.emoji,
    avatar: user.avatar
  });

  writeUsers(users);
  const { pin: _, ...safe } = user;
  res.json(safe);
});

// ========== NOTIFICATIONS ==========

app.get('/api/notifications', (req, res) => {
  res.json(readNotifications());
});

app.post('/api/notifications', (req, res) => {
  const { fromUser, showName, showId, message } = req.body;
  if (!fromUser || !showName) return res.status(400).json({ error: 'fromUser and showName required' });
  const notifs = readNotifications();
  const notif = {
    id: crypto.randomUUID(),
    fromUser,
    showName,
    showId: showId || null,
    message: message || '',
    createdAt: new Date().toISOString(),
  };
  notifs.push(notif);
  writeNotifications(notifs);
  res.status(201).json(notif);
});

app.delete('/api/notifications/:id', (req, res) => {
  let notifs = readNotifications();
  notifs = notifs.filter((n) => n.id !== req.params.id);
  writeNotifications(notifs);
  res.json(notifs);
});

// ========== CONFIG ==========

app.get('/api/config/media-paths', (req, res) => {
  res.json({
    moviesDirs: MOVIES_DIRS.map((d) => ({ path: d, exists: fs.existsSync(d) })),
    tvDirs: TV_DIRS.map((d) => ({ path: d, exists: fs.existsSync(d) })),
  });
});

app.put('/api/config/media-paths', (req, res) => {
  const { moviesDirs, tvDirs, userId } = req.body;
  // Only Fiifi can change paths
  const users = readUsers();
  const user = users.find((u) => u.id === userId);
  if (!user || user.username.toLowerCase() !== 'fiifi') {
    return res.status(403).json({ error: 'Not authorized' });
  }
  if (!moviesDirs || !tvDirs || !Array.isArray(moviesDirs) || !Array.isArray(tvDirs)) {
    return res.status(400).json({ error: 'moviesDirs and tvDirs arrays required' });
  }
  // Filter out empty strings
  MOVIES_DIRS = moviesDirs.filter((d) => d.trim());
  TV_DIRS = tvDirs.filter((d) => d.trim());
  config = { moviesDirs: MOVIES_DIRS, tvDirs: TV_DIRS };
  saveConfig(config);

  res.json({
    moviesDirs: MOVIES_DIRS.map((d) => ({ path: d, exists: fs.existsSync(d) })),
    tvDirs: TV_DIRS.map((d) => ({ path: d, exists: fs.existsSync(d) })),
  });
});

// ========== LIBRARY ==========

app.get('/api/library', (req, res) => {
  try {
    const movies = listVideoFilesMulti(MOVIES_DIRS).map(({ filename, name }) => ({ filename, name }));
    const shows = listTvShows().map(({ name }) => ({ name }));
    // Deduplicate TV shows by name
    const seen = new Set();
    const tvShows = shows.filter((s) => {
      if (seen.has(s.name)) return false;
      seen.add(s.name);
      return true;
    });
    res.json({ movies, tvShows });
  } catch (err) {
    res.status(500).json({ error: 'Cannot read library' });
  }
});

// ========== MOVIES ==========

app.get('/api/movies', (req, res) => {
  try {
    const movies = listVideoFilesMulti(MOVIES_DIRS).map(({ filename, name }) => ({ filename, name }));
    res.json(movies);
  } catch (err) {
    res.status(500).json({ error: 'Cannot read movies directory' });
  }
});

function normalizeSearch(str) {
  return str.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

app.get('/api/movies/search', (req, res) => {
  const query = normalizeSearch(req.query.q || '');
  if (!query) return res.json([]);
  try {
    const movies = listVideoFilesMulti(MOVIES_DIRS);
    const matches = movies
      .filter((m) => normalizeSearch(m.filename).includes(query))
      .map(({ filename, name }) => ({ filename, name }));
    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: 'Cannot search movies' });
  }
});

app.get('/api/movies/stream/:filename', (req, res) => {
  const filePath = findMovieFile(req.params.filename);
  if (!filePath) return res.status(404).json({ error: 'File not found' });
  streamFile(filePath, req, res);
});

// ========== TV SHOWS ==========

app.get('/api/tv', (req, res) => {
  try {
    const shows = listTvShows();
    const seen = new Set();
    const unique = shows.filter((s) => {
      if (seen.has(s.name)) return false;
      seen.add(s.name);
      return true;
    });
    res.json(unique.map(({ name }) => ({ name })));
  } catch (err) {
    res.status(500).json({ error: 'Cannot read TV directory' });
  }
});

app.get('/api/tv/search', (req, res) => {
  const query = normalizeSearch(req.query.q || '');
  if (!query) return res.json([]);
  try {
    const shows = listTvShows();
    const seen = new Set();
    const matches = shows
      .filter((s) => normalizeSearch(s.name).includes(query))
      .filter((s) => {
        if (seen.has(s.name)) return false;
        seen.add(s.name);
        return true;
      })
      .map(({ name }) => ({ name }));
    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: 'Cannot search TV shows' });
  }
});

app.get('/api/tv/:show/seasons', (req, res) => {
  const showDir = findTvShowDir(req.params.show);
  if (!showDir) return res.status(404).json({ error: 'Show not found' });
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
  const showDir = findTvShowDir(req.params.show);
  if (!showDir) return res.status(404).json({ error: 'Show not found' });
  const seasonDir = path.join(showDir, req.params.season);
  if (!fs.existsSync(seasonDir)) return res.status(404).json({ error: 'Season not found' });
  try {
    const files = listVideoFiles(seasonDir);
    res.json(files.map((f) => ({ filename: f, name: f.replace(/\.[^.]+$/, '') })));
  } catch (err) {
    res.status(500).json({ error: 'Cannot read episodes' });
  }
});

app.get('/api/tv/:show/:season/stream/:filename', (req, res) => {
  const showDir = findTvShowDir(req.params.show);
  if (!showDir) return res.status(404).json({ error: 'Show not found' });
  streamFile(path.join(showDir, req.params.season, req.params.filename), req, res);
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
  // Use first movies dir as default download target
  const targetDir = MOVIES_DIRS[0] || '/tmp';
  const item = { type: 'movie', targetName, targetDir, url: `https://vidfast.pro/movie/${tmdbId}`, status: 'queued' };
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
  // Use first TV dir as default, or find existing show dir
  const existingShowDir = findTvShowDir(showName);
  const targetDir = existingShowDir
    ? path.join(existingShowDir, `Season ${season}`)
    : path.join(TV_DIRS[0] || '/tmp', showName, `Season ${season}`);
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  const item = { type: 'episode', targetName, targetDir, url: `https://vidfast.pro/tv/${tmdbId}/${season}/${episode}`, status: 'queued' };
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

// ========== SUBTITLES (OpenSubtitles API proxy) ==========

const OPENSUBTITLES_API_KEY = process.env.OPENSUBTITLES_API_KEY || '';
const OPENSUBTITLES_BASE = 'https://api.opensubtitles.com/api/v1';

app.get('/api/subtitles/search', async (req, res) => {
  if (!OPENSUBTITLES_API_KEY) return res.status(503).json({ error: 'OPENSUBTITLES_API_KEY not configured' });
  const { tmdb_id, type, season, episode, languages } = req.query;
  if (!tmdb_id) return res.status(400).json({ error: 'tmdb_id required' });

  try {
    const params = new URLSearchParams({ tmdb_id, languages: languages || 'en' });
    if (type === 'episode' && season && episode) {
      params.set('season_number', season);
      params.set('episode_number', episode);
    }
    const response = await fetch(`${OPENSUBTITLES_BASE}/subtitles?${params}`, {
      headers: {
        'Api-Key': OPENSUBTITLES_API_KEY,
        'Content-Type': 'application/json',
        'User-Agent': 'MediaPlayerApp v1.0',
      },
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Subtitle search error:', err.message);
    res.status(500).json({ error: 'Subtitle search failed' });
  }
});

function srtToVtt(srt) {
  let vtt = 'WEBVTT\n\n';
  vtt += srt
    .replace(/\r\n/g, '\n')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
    .replace(/^\d+\n/gm, '');
  return vtt;
}

app.get('/api/subtitles/download', async (req, res) => {
  if (!OPENSUBTITLES_API_KEY) return res.status(503).json({ error: 'OPENSUBTITLES_API_KEY not configured' });
  const { file_id } = req.query;
  if (!file_id) return res.status(400).json({ error: 'file_id required' });

  try {
    // Step 1: Request download link
    const dlRes = await fetch(`${OPENSUBTITLES_BASE}/download`, {
      method: 'POST',
      headers: {
        'Api-Key': OPENSUBTITLES_API_KEY,
        'Content-Type': 'application/json',
        'User-Agent': 'MediaPlayerApp v1.0',
      },
      body: JSON.stringify({ file_id: parseInt(file_id) }),
    });
    const dlData = await dlRes.json();
    console.log(`[subtitles] Download API response (status ${dlRes.status}):`, JSON.stringify(dlData));
    if (!dlData.link) return res.status(404).json({ error: 'No download link returned', details: dlData });

    // Step 2: Fetch the SRT content
    const srtRes = await fetch(dlData.link);
    const srtText = await srtRes.text();

    // Step 3: Convert to VTT and return
    const vtt = srtToVtt(srtText);
    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(vtt);
  } catch (err) {
    console.error('Subtitle download error:', err.message);
    res.status(500).json({ error: 'Subtitle download failed' });
  }
});

// ========== START ==========

app.listen(PORT, () => {
  console.log(`Media server running on http://localhost:${PORT}`);
  console.log(`Movies dirs: ${MOVIES_DIRS.join(', ')}`);
  console.log(`TV dirs: ${TV_DIRS.join(', ')}`);
});
