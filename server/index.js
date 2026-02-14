const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 4000;

const MOVIES_DIR = '/Volumes/Lexar-NK&D/Movies';
const TV_DIR = '/Volumes/Lexar-NK&D/Tv Shows';

app.use(cors());

// ---------- MOVIES ----------

// List all movie files
app.get('/api/movies', (req, res) => {
  try {
    const files = fs.readdirSync(MOVIES_DIR).filter((f) => {
      if (f.startsWith('.')) return false;
      const ext = path.extname(f).toLowerCase();
      return ['.mp4', '.mkv', '.avi', '.webm', '.m4v'].includes(ext);
    });
    const movies = files.map((f) => ({
      filename: f,
      name: f.replace(/\.[^.]+$/, ''),
    }));
    res.json(movies);
  } catch (err) {
    res.status(500).json({ error: 'Cannot read movies directory' });
  }
});

// Search movie files by name
app.get('/api/movies/search', (req, res) => {
  const query = (req.query.q || '').toLowerCase();
  if (!query) return res.json([]);

  try {
    const files = fs.readdirSync(MOVIES_DIR).filter((f) => {
      if (f.startsWith('.')) return false;
      const ext = path.extname(f).toLowerCase();
      return ['.mp4', '.mkv', '.avi', '.webm', '.m4v'].includes(ext);
    });

    const matches = files
      .filter((f) => f.toLowerCase().includes(query))
      .map((f) => ({
        filename: f,
        name: f.replace(/\.[^.]+$/, ''),
      }));

    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: 'Cannot search movies' });
  }
});

// Stream a movie file (supports range requests for seeking)
app.get('/api/movies/stream/:filename', (req, res) => {
  const filePath = path.join(MOVIES_DIR, req.params.filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const ext = path.extname(filePath).toLowerCase();

  const mimeTypes = {
    '.mp4': 'video/mp4',
    '.mkv': 'video/x-matroska',
    '.webm': 'video/webm',
    '.avi': 'video/x-msvideo',
    '.m4v': 'video/mp4',
  };
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    const stream = fs.createReadStream(filePath, { start, end });
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentType,
    });
    stream.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

// ---------- TV SHOWS ----------

// List all TV shows (folders)
app.get('/api/tv', (req, res) => {
  try {
    const dirs = fs.readdirSync(TV_DIR).filter((f) => {
      return fs.statSync(path.join(TV_DIR, f)).isDirectory();
    });
    const shows = dirs.map((d) => ({ name: d }));
    res.json(shows);
  } catch (err) {
    res.status(500).json({ error: 'Cannot read TV directory' });
  }
});

// Search TV show folders by name
app.get('/api/tv/search', (req, res) => {
  const query = (req.query.q || '').toLowerCase();
  if (!query) return res.json([]);

  try {
    const dirs = fs.readdirSync(TV_DIR).filter((f) => {
      return fs.statSync(path.join(TV_DIR, f)).isDirectory();
    });

    const matches = dirs
      .filter((d) => d.toLowerCase().includes(query))
      .map((d) => ({ name: d }));

    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: 'Cannot search TV shows' });
  }
});

// List seasons for a TV show
app.get('/api/tv/:show/seasons', (req, res) => {
  const showDir = path.join(TV_DIR, req.params.show);

  if (!fs.existsSync(showDir)) {
    return res.status(404).json({ error: 'Show not found' });
  }

  try {
    const dirs = fs.readdirSync(showDir).filter((f) => {
      return fs.statSync(path.join(showDir, f)).isDirectory();
    });
    res.json(dirs.map((d) => ({ name: d })));
  } catch (err) {
    res.status(500).json({ error: 'Cannot read seasons' });
  }
});

// List episodes for a season
app.get('/api/tv/:show/:season/episodes', (req, res) => {
  const seasonDir = path.join(TV_DIR, req.params.show, req.params.season);

  if (!fs.existsSync(seasonDir)) {
    return res.status(404).json({ error: 'Season not found' });
  }

  try {
    const files = fs.readdirSync(seasonDir).filter((f) => {
      if (f.startsWith('.')) return false;
      const ext = path.extname(f).toLowerCase();
      return ['.mp4', '.mkv', '.avi', '.webm', '.m4v'].includes(ext);
    });

    const episodes = files.map((f) => ({
      filename: f,
      name: f.replace(/\.[^.]+$/, ''),
    }));
    res.json(episodes);
  } catch (err) {
    res.status(500).json({ error: 'Cannot read episodes' });
  }
});

// Stream a TV episode (supports range requests)
app.get('/api/tv/:show/:season/stream/:filename', (req, res) => {
  const filePath = path.join(
    TV_DIR,
    req.params.show,
    req.params.season,
    req.params.filename
  );

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const ext = path.extname(filePath).toLowerCase();

  const mimeTypes = {
    '.mp4': 'video/mp4',
    '.mkv': 'video/x-matroska',
    '.webm': 'video/webm',
    '.avi': 'video/x-msvideo',
    '.m4v': 'video/mp4',
  };
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    const stream = fs.createReadStream(filePath, { start, end });
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentType,
    });
    stream.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

app.listen(PORT, () => {
  console.log(`Media server running on http://localhost:${PORT}`);
  console.log(`Movies: ${MOVIES_DIR}`);
  console.log(`TV Shows: ${TV_DIR}`);
});
