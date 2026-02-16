import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaServer, FaCheck, FaSpinner, FaTimes, FaSync, FaHdd, FaFolder, FaArrowLeft } from 'react-icons/fa';
import { getMediaUrl, setMediaUrl } from '../services/media';
import { useUser } from '../contexts/UserContext';
import './Settings.css';

function Settings() {
  const { currentUser } = useUser();
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState(null);
  const [movieCount, setMovieCount] = useState(0);
  const [saved, setSaved] = useState(false);

  // Drive config (Fiifi only)
  const isFiifi = currentUser?.username?.toLowerCase() === 'fiifi';
  const [moviesDir, setMoviesDir] = useState('');
  const [tvDir, setTvDir] = useState('');
  const [pathStatus, setPathStatus] = useState(null);
  const [pathSaved, setPathSaved] = useState(false);

  useEffect(() => {
    setUrl(getMediaUrl());
  }, []);

  useEffect(() => {
    if (url) testConnection(url);
  }, []);

  // Load current media paths
  useEffect(() => {
    if (!isFiifi) return;
    const loadPaths = async () => {
      try {
        const res = await fetch(`${getMediaUrl()}/api/config/media-paths`);
        if (res.ok) {
          const data = await res.json();
          setMoviesDir(data.moviesDir);
          setTvDir(data.tvDir);
          setPathStatus(data);
        }
      } catch { /* server offline */ }
    };
    loadPaths();
  }, [isFiifi]);

  const testConnection = async (testUrl) => {
    setStatus('testing');
    try {
      const res = await fetch(`${testUrl}/api/movies`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json();
        setMovieCount(data.length);
        setStatus('online');
      } else {
        setStatus('offline');
      }
    } catch {
      setStatus('offline');
    }
  };

  const handleSave = () => {
    const cleaned = url.replace(/\/+$/, '');
    setMediaUrl(cleaned);
    setUrl(cleaned);
    setSaved(true);
    testConnection(cleaned);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSavePaths = async () => {
    try {
      const res = await fetch(`${getMediaUrl()}/api/config/media-paths`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moviesDir, tvDir, userId: currentUser.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setPathStatus(data);
        setPathSaved(true);
        setTimeout(() => setPathSaved(false), 2000);
      }
    } catch { /* server offline */ }
  };

  return (
    <div className="settings-page">
      <div className="container">
        <Link to={currentUser ? '/' : '/profiles'} className="settings-back"><FaArrowLeft /> Back</Link>
        <h1 className="settings-title"><FaServer /> Media Server</h1>
        <p className="settings-desc">
          Paste your Cloudflare Tunnel URL here so the app can stream movies from your drive.
          This is saved in your browser — no redeploy needed.
        </p>

        <div className="settings-card">
          <label className="settings-label">Media Server URL</label>
          <div className="settings-input-row">
            <input
              type="url"
              className="settings-input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-tunnel.trycloudflare.com"
            />
            <button className="settings-btn save" onClick={handleSave}>
              {saved ? <><FaCheck /> Saved</> : 'Save'}
            </button>
            <button className="settings-btn test" onClick={() => testConnection(url)}>
              <FaSync /> Test
            </button>
          </div>

          <div className={`settings-status ${status || ''}`}>
            {status === 'testing' && <><FaSpinner className="spin" /> Testing connection...</>}
            {status === 'online' && <><FaCheck /> Connected — {movieCount} movies found</>}
            {status === 'offline' && <><FaTimes /> Cannot reach server. Is it running?</>}
          </div>

          <div className="settings-help">
            <h3>How to start your media server:</h3>
            <ol>
              <li>Plug in your external drive</li>
              <li>Open Terminal and run: <code>cd streamlit-react && bash start-media-server.sh</code></li>
              <li>Copy the <code>https://*.trycloudflare.com</code> URL that appears</li>
              <li>Paste it above and click Save</li>
            </ol>
          </div>
        </div>

        {isFiifi && (
          <div className="settings-card drive-config">
            <h2 className="settings-card-title"><FaHdd /> Drive Configuration</h2>
            <p className="settings-card-desc">Set the folders where your movies and TV shows are stored.</p>

            <label className="settings-label"><FaFolder /> Movies Folder</label>
            <input
              type="text"
              className="settings-input"
              value={moviesDir}
              onChange={(e) => setMoviesDir(e.target.value)}
              placeholder="/Volumes/MyDrive/Movies"
            />
            {pathStatus && (
              <span className={`path-status ${pathStatus.moviesDirExists ? 'found' : 'missing'}`}>
                {pathStatus.moviesDirExists ? <><FaCheck /> Folder found</> : <><FaTimes /> Folder not found</>}
              </span>
            )}

            <label className="settings-label"><FaFolder /> TV Shows Folder</label>
            <input
              type="text"
              className="settings-input"
              value={tvDir}
              onChange={(e) => setTvDir(e.target.value)}
              placeholder="/Volumes/MyDrive/Tv Shows"
            />
            {pathStatus && (
              <span className={`path-status ${pathStatus.tvDirExists ? 'found' : 'missing'}`}>
                {pathStatus.tvDirExists ? <><FaCheck /> Folder found</> : <><FaTimes /> Folder not found</>}
              </span>
            )}

            <button className="settings-btn save drive-save" onClick={handleSavePaths}>
              {pathSaved ? <><FaCheck /> Saved</> : 'Save Paths'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Settings;
