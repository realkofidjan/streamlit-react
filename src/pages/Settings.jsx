import { useState, useEffect } from 'react';
import { FaServer, FaCheck, FaSpinner, FaTimes, FaSync } from 'react-icons/fa';
import { getMediaUrl, setMediaUrl } from '../services/media';
import './Settings.css';

function Settings() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState(null); // null | 'testing' | 'online' | 'offline'
  const [movieCount, setMovieCount] = useState(0);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setUrl(getMediaUrl());
  }, []);

  useEffect(() => {
    if (url) testConnection(url);
  }, []);

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

  return (
    <div className="settings-page">
      <div className="container">
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
      </div>
    </div>
  );
}

export default Settings;
