const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 4000;

const MOVIES_DIR = '/Volumes/Lexar-NK&D/Movies';
const TV_DIR = '/Volumes/Lexar-NK&D/Tv Shows';

// First request = 2MB for fast playback start; subsequent = 10MB for aggressive buffering
const INITIAL_CHUNK = 2 * 1024 * 1024;
const BUFFER_CHUNK = 10 * 1024 * 1024;
const STREAM_HWM = 64 * 1024;

app.use(cors());

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
    // First chunk (start=0) is small for fast start; all others are large for aggressive buffering
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
    // No range header — send small initial chunk so browser switches to range requests
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

// ---------- MOVIES ----------

app.get('/api/movies', (req, res) => {
  try {
    const files = listVideoFiles(MOVIES_DIR);
    res.json(files.map((f) => ({ filename: f, name: f.replace(/\.[^.]+$/, '') })));
  } catch (err) {
    res.status(500).json({ error: 'Cannot read movies directory' });
  }
});

app.get('/api/movies/search', (req, res) => {
  const query = (req.query.q || '').toLowerCase();
  if (!query) return res.json([]);
  try {
    const files = listVideoFiles(MOVIES_DIR);
    const matches = files
      .filter((f) => f.toLowerCase().includes(query))
      .map((f) => ({ filename: f, name: f.replace(/\.[^.]+$/, '') }));
    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: 'Cannot search movies' });
  }
});

app.get('/api/movies/stream/:filename', (req, res) => {
  streamFile(path.join(MOVIES_DIR, req.params.filename), req, res);
});

// ---------- TV SHOWS ----------

app.get('/api/tv', (req, res) => {
  try {
    const dirs = fs.readdirSync(TV_DIR).filter((f) =>
      fs.statSync(path.join(TV_DIR, f)).isDirectory()
    );
    res.json(dirs.map((d) => ({ name: d })));
  } catch (err) {
    res.status(500).json({ error: 'Cannot read TV directory' });
  }
});

app.get('/api/tv/search', (req, res) => {
  const query = (req.query.q || '').toLowerCase();
  if (!query) return res.json([]);
  try {
    const dirs = fs.readdirSync(TV_DIR).filter((f) =>
      fs.statSync(path.join(TV_DIR, f)).isDirectory()
    );
    const matches = dirs
      .filter((d) => d.toLowerCase().includes(query))
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
      fs.statSync(path.join(showDir, f)).isDirectory()
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

app.listen(PORT, () => {
  console.log(`Media server running on http://localhost:${PORT}`);
  console.log(`Movies: ${MOVIES_DIR}`);
  console.log(`TV Shows: ${TV_DIR}`);
});
