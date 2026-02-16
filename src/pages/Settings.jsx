import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaServer, FaCheck, FaSpinner, FaTimes, FaSync, FaHdd, FaFolder, FaArrowLeft, FaBell, FaUser, FaKey, FaPlus, FaTrash } from 'react-icons/fa';
import { getMediaUrl, setMediaUrl } from '../services/media';
import { useUser } from '../contexts/UserContext';
import './Settings.css';

function Settings() {
  const { currentUser, updateProfile, getNotifications, dismissNotification } = useUser();
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState(null);
  const [movieCount, setMovieCount] = useState(0);
  const [saved, setSaved] = useState(false);

  // Drive config (Fiifi only)
  const isFiifi = currentUser?.username?.toLowerCase() === 'fiifi';
  const [moviesDirs, setMoviesDirs] = useState(['']);
  const [tvDirs, setTvDirs] = useState(['']);
  const [pathStatus, setPathStatus] = useState(null);
  const [pathSaved, setPathSaved] = useState(false);

  // Profile
  const [displayName, setDisplayName] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [profileMsg, setProfileMsg] = useState(null);

  // Notifications (Fiifi only)
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    setUrl(getMediaUrl());
  }, []);

  useEffect(() => {
    if (url) testConnection(url);
  }, []);

  useEffect(() => {
    if (currentUser) setDisplayName(currentUser.username);
  }, [currentUser]);

  // Load current media paths
  useEffect(() => {
    if (!isFiifi) return;
    const loadPaths = async () => {
      try {
        const res = await fetch(`${getMediaUrl()}/api/config/media-paths`);
        if (res.ok) {
          const data = await res.json();
          setMoviesDirs(data.moviesDirs.map((d) => d.path));
          setTvDirs(data.tvDirs.map((d) => d.path));
          setPathStatus(data);
        }
      } catch { /* server offline */ }
    };
    loadPaths();
  }, [isFiifi]);

  // Load notifications (Fiifi only)
  useEffect(() => {
    if (!isFiifi) return;
    const loadNotifs = async () => {
      const notifs = await getNotifications();
      setNotifications(notifs);
    };
    loadNotifs();
  }, [isFiifi, getNotifications]);

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
        body: JSON.stringify({ moviesDirs, tvDirs, userId: currentUser.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setPathStatus(data);
        setPathSaved(true);
        setTimeout(() => setPathSaved(false), 2000);
      }
    } catch { /* server offline */ }
  };

  const handleProfileSave = async () => {
    setProfileMsg(null);
    try {
      const nameChanged = displayName && displayName !== currentUser.username;
      const pinChanged = currentPin && newPin;
      await updateProfile(
        nameChanged ? displayName : undefined,
        pinChanged ? currentPin : undefined,
        pinChanged ? newPin : undefined,
      );
      setProfileMsg({ type: 'success', text: 'Profile updated!' });
      setCurrentPin('');
      setNewPin('');
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.response?.data?.error || 'Failed to update' });
    }
  };

  const handleDismiss = async (notifId) => {
    const remaining = await dismissNotification(notifId);
    setNotifications(remaining);
  };

  const updateDir = (dirs, setDirs, index, value) => {
    const next = [...dirs];
    next[index] = value;
    setDirs(next);
  };

  const addDir = (dirs, setDirs) => {
    setDirs([...dirs, '']);
  };

  const removeDir = (dirs, setDirs, index) => {
    if (dirs.length <= 1) return;
    setDirs(dirs.filter((_, i) => i !== index));
  };

  // Get path status for a specific index
  const getPathExists = (statusArr, index) => {
    if (!pathStatus || !statusArr) return null;
    return statusArr[index];
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

        {currentUser && (
          <div className="settings-card profile-config">
            <h2 className="settings-card-title"><FaUser /> Profile</h2>
            <p className="settings-card-desc">Update your display name or change your PIN.</p>

            <label className="settings-label">Display Name</label>
            <input
              type="text"
              className="settings-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
            />

            <label className="settings-label"><FaKey /> Change PIN</label>
            <div className="pin-row">
              <input
                type="password"
                className="settings-input pin-input"
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value)}
                placeholder="Current PIN"
                maxLength={4}
              />
              <input
                type="password"
                className="settings-input pin-input"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                placeholder="New PIN"
                maxLength={4}
              />
            </div>

            {profileMsg && (
              <div className={`settings-status ${profileMsg.type === 'success' ? 'online' : 'offline'}`}>
                {profileMsg.type === 'success' ? <FaCheck /> : <FaTimes />} {profileMsg.text}
              </div>
            )}

            <button className="settings-btn save profile-save" onClick={handleProfileSave}>
              Save Profile
            </button>
          </div>
        )}

        {isFiifi && (
          <div className="settings-card drive-config">
            <h2 className="settings-card-title"><FaHdd /> Drive Configuration</h2>
            <p className="settings-card-desc">Set the folders where your movies and TV shows are stored. Add multiple paths if content is spread across drives.</p>

            <label className="settings-label"><FaFolder /> Movies Folders</label>
            {moviesDirs.map((dir, i) => (
              <div key={i} className="multi-path-row">
                <input
                  type="text"
                  className="settings-input"
                  value={dir}
                  onChange={(e) => updateDir(moviesDirs, setMoviesDirs, i, e.target.value)}
                  placeholder="/Volumes/MyDrive/Movies"
                />
                {(() => {
                  const s = getPathExists(pathStatus?.moviesDirs, i);
                  if (!s) return null;
                  return (
                    <span className={`path-status-inline ${s.exists ? 'found' : 'missing'}`}>
                      {s.exists ? <FaCheck /> : <FaTimes />}
                    </span>
                  );
                })()}
                {moviesDirs.length > 1 && (
                  <button className="path-remove-btn" onClick={() => removeDir(moviesDirs, setMoviesDirs, i)}>
                    <FaTrash />
                  </button>
                )}
              </div>
            ))}
            <button className="path-add-btn" onClick={() => addDir(moviesDirs, setMoviesDirs)}>
              <FaPlus /> Add movies folder
            </button>

            <label className="settings-label"><FaFolder /> TV Shows Folders</label>
            {tvDirs.map((dir, i) => (
              <div key={i} className="multi-path-row">
                <input
                  type="text"
                  className="settings-input"
                  value={dir}
                  onChange={(e) => updateDir(tvDirs, setTvDirs, i, e.target.value)}
                  placeholder="/Volumes/MyDrive/Tv Shows"
                />
                {(() => {
                  const s = getPathExists(pathStatus?.tvDirs, i);
                  if (!s) return null;
                  return (
                    <span className={`path-status-inline ${s.exists ? 'found' : 'missing'}`}>
                      {s.exists ? <FaCheck /> : <FaTimes />}
                    </span>
                  );
                })()}
                {tvDirs.length > 1 && (
                  <button className="path-remove-btn" onClick={() => removeDir(tvDirs, setTvDirs, i)}>
                    <FaTrash />
                  </button>
                )}
              </div>
            ))}
            <button className="path-add-btn" onClick={() => addDir(tvDirs, setTvDirs)}>
              <FaPlus /> Add TV shows folder
            </button>

            <button className="settings-btn save drive-save" onClick={handleSavePaths}>
              {pathSaved ? <><FaCheck /> Saved</> : 'Save Paths'}
            </button>
          </div>
        )}

        {isFiifi && notifications.length > 0 && (
          <div className="settings-card notif-config">
            <h2 className="settings-card-title"><FaBell /> Download Requests</h2>
            <p className="settings-card-desc">Users have requested these shows to be downloaded.</p>
            <div className="notif-list">
              {notifications.map((n) => (
                <div key={n.id} className="notif-item">
                  <div className="notif-content">
                    <strong>{n.fromUser}</strong> requested <strong>{n.showName}</strong>
                    {n.message && <span className="notif-detail"> — {n.message}</span>}
                    <span className="notif-date">{new Date(n.createdAt).toLocaleDateString()}</span>
                  </div>
                  <button className="notif-dismiss" onClick={() => handleDismiss(n.id)}>
                    <FaTimes />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Settings;
