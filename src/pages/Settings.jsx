import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaCheck, FaSpinner, FaTimes, FaSync, FaHdd, FaFolder, FaArrowLeft, FaBell, FaUser, FaKey, FaPlus, FaTrash, FaExclamationTriangle, FaChevronRight, FaHome, FaShieldAlt, FaDesktop, FaUsers, FaServer, FaPen } from 'react-icons/fa';
import { getMediaUrl, setMediaUrl } from '../services/media';
import { useUser } from '../contexts/UserContext';
import './Settings.css';

const EMOJI_OPTIONS = ['😀', '😎', '🤖', '👻', '🦊', '🐱', '🦁', '🐼', '🐸', '🦄', '🐶', '🎃', '👑', '⭐', '🔥', '💎', '🎮', '🎬', '🍿', '🎵', '🌈', '🚀', '🧠', '💀'];
const AVATAR_COLORS = ['#e50914', '#3498db', '#2ecc71', '#9b59b6', '#f39c12', '#1abc9c', '#34495e', '#e67e22'];

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: FaHome },
  { id: 'server', label: 'Media Server', icon: FaServer },
  { id: 'security', label: 'Security', icon: FaShieldAlt },
  { id: 'devices', label: 'Devices', icon: FaDesktop },
  { id: 'profiles', label: 'Profiles', icon: FaUsers },
];

function Settings() {
  const navigate = useNavigate();
  const { currentUser, users, updateProfile, deleteUser, adminDeleteUser, getNotifications, dismissNotification, fetchUsers } = useUser();
  const [activeNav, setActiveNav] = useState('overview');

  // Server
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

  // Profile editing
  const [displayName, setDisplayName] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [profileMsg, setProfileMsg] = useState(null);
  const [selectedEmoji, setSelectedEmoji] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Delete own account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePin, setDeletePin] = useState('');
  const [deleteError, setDeleteError] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Admin delete
  const [adminDeleteTarget, setAdminDeleteTarget] = useState(null);
  const [adminDeleting, setAdminDeleting] = useState(false);
  const [adminDeleteError, setAdminDeleteError] = useState(null);

  // Notifications
  const [notifications, setNotifications] = useState([]);

  // Editing other profiles (name/emoji)
  const [editingProfile, setEditingProfile] = useState(null);
  const [editName, setEditName] = useState('');
  const [editEmoji, setEditEmoji] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editMsg, setEditMsg] = useState(null);

  useEffect(() => { setUrl(getMediaUrl()); }, []);
  useEffect(() => { if (url) testConnection(url); }, []);
  useEffect(() => {
    if (currentUser) {
      setDisplayName(currentUser.username);
      setSelectedEmoji(currentUser.emoji || '');
      setSelectedColor(currentUser.avatar || '');
    }
  }, [currentUser]);

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
      } catch { }
    };
    loadPaths();
  }, [isFiifi]);

  useEffect(() => {
    if (!isFiifi) return;
    const loadNotifs = async () => { setNotifications(await getNotifications()); };
    loadNotifs();
  }, [isFiifi, getNotifications]);

  const testConnection = async (testUrl) => {
    setStatus('testing');
    try {
      const res = await fetch(`${testUrl}/api/movies`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) { setMovieCount((await res.json()).length); setStatus('online'); }
      else setStatus('offline');
    } catch { setStatus('offline'); }
  };

  const handleSave = () => {
    const cleaned = url.replace(/\/+$/, '');
    setMediaUrl(cleaned); setUrl(cleaned); setSaved(true);
    testConnection(cleaned);
    setTimeout(() => setSaved(false), 2000);
    // Refresh page to pull new data from new server
    setTimeout(() => window.location.reload(), 1500);
  };

  const handleSavePaths = async () => {
    try {
      const res = await fetch(`${getMediaUrl()}/api/config/media-paths`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moviesDirs, tvDirs, userId: currentUser.id }),
      });
      if (res.ok) { setPathStatus(await res.json()); setPathSaved(true); setTimeout(() => setPathSaved(false), 2000); }
    } catch { }
  };

  const handleProfileSave = async () => {
    setProfileMsg(null);
    try {
      const nameChanged = displayName && displayName !== currentUser.username;
      const pinChanged = currentPin && newPin;
      // Always send emoji and color so they persist
      await updateProfile(
        nameChanged ? displayName : undefined,
        pinChanged ? currentPin : undefined,
        pinChanged ? newPin : undefined,
        selectedEmoji,         // always send current emoji value
        selectedColor || undefined,
      );
      setProfileMsg({ type: 'success', text: 'Profile updated!' });
      setCurrentPin(''); setNewPin('');
    } catch (err) { setProfileMsg({ type: 'error', text: err.response?.data?.error || 'Failed to update' }); }
  };

  const handleDeleteAccount = async () => {
    if (!currentUser || !deletePin) return;
    setDeleteError(null); setDeleting(true);
    try { await deleteUser(currentUser.id, deletePin); navigate('/profiles'); }
    catch (err) { setDeleteError(err.response?.data?.error || 'Failed to delete account'); }
    finally { setDeleting(false); }
  };

  const handleAdminDelete = async (userId) => {
    setAdminDeleteError(null); setAdminDeleting(true);
    try {
      await adminDeleteUser(userId);
      setAdminDeleteTarget(null);
      await fetchUsers();
    } catch (err) { setAdminDeleteError(err.response?.data?.error || 'Failed to delete'); }
    finally { setAdminDeleting(false); }
  };

  const handleDismiss = async (notifId) => { setNotifications(await dismissNotification(notifId)); };
  const updateDir = (dirs, setDirs, i, val) => { const n = [...dirs]; n[i] = val; setDirs(n); };
  const addDir = (dirs, setDirs) => setDirs([...dirs, '']);
  const removeDir = (dirs, setDirs, i) => { if (dirs.length <= 1) return; setDirs(dirs.filter((_, j) => j !== i)); };
  const getPathExists = (arr, i) => (!pathStatus || !arr) ? null : arr[i];

  const otherUsers = users.filter(u => u.id !== currentUser?.id);

  return (
    <div className="nf-account-page">
      {/* Left Sidebar */}
      <aside className="nf-account-sidebar">
        <button className="nf-back-link" onClick={() => navigate(currentUser ? '/' : '/profiles')}>
          <FaArrowLeft /> Back to Home
        </button>
        <nav className="nf-sidebar-nav">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nf-sidebar-item ${activeNav === id ? 'active' : ''}`}
              onClick={() => setActiveNav(id)}
            >
              <Icon /> {label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Right Content */}
      <main className="nf-account-content">
        <h1 className="nf-account-title">Account</h1>
        <p className="nf-account-subtitle">
          {activeNav === 'overview' && 'Membership Details'}
          {activeNav === 'server' && 'Media Server Configuration'}
          {activeNav === 'security' && 'Security & PIN'}
          {activeNav === 'devices' && 'Drive Configuration'}
          {activeNav === 'profiles' && 'Profile Management'}
        </p>

        {/* ===== OVERVIEW ===== */}
        {activeNav === 'overview' && (
          <>
            {currentUser && (
              <div className="nf-membership-badge">
                Member since {new Date(currentUser.createdAt || Date.now()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </div>
            )}

            <div className="nf-account-card">
              <div className="nf-card-row">
                <div className="nf-card-left">
                  <strong>Media Server</strong>
                  <span className="nf-card-detail">
                    {status === 'online' ? `Connected — ${movieCount} movies` : 'Not connected'}
                  </span>
                </div>
                <button className="nf-link-btn" onClick={() => setActiveNav('server')}>
                  Manage server <FaChevronRight />
                </button>
              </div>
            </div>

            <h3 className="nf-quick-links-title">Quick Links</h3>
            <div className="nf-account-card">
              <button className="nf-quick-link" onClick={() => setActiveNav('server')}>
                <FaServer className="nf-ql-icon" /> <span>Configure media server</span> <FaChevronRight className="nf-ql-chevron" />
              </button>
              {isFiifi && (
                <button className="nf-quick-link" onClick={() => setActiveNav('devices')}>
                  <FaHdd className="nf-ql-icon" /> <span>Manage drive folders</span> <FaChevronRight className="nf-ql-chevron" />
                </button>
              )}
              <button className="nf-quick-link" onClick={() => setActiveNav('security')}>
                <FaKey className="nf-ql-icon" /> <span>Update password</span> <FaChevronRight className="nf-ql-chevron" />
              </button>
              <button className="nf-quick-link" onClick={() => setActiveNav('profiles')}>
                <FaUsers className="nf-ql-icon" /> <span>Manage profiles ({users.length}/6)</span> <FaChevronRight className="nf-ql-chevron" />
              </button>
              {isFiifi && notifications.length > 0 && (
                <button className="nf-quick-link" onClick={() => setActiveNav('profiles')}>
                  <FaBell className="nf-ql-icon" /> <span>Download requests ({notifications.length})</span> <FaChevronRight className="nf-ql-chevron" />
                </button>
              )}
            </div>
          </>
        )}

        {/* ===== MEDIA SERVER ===== */}
        {activeNav === 'server' && (
          <div className="nf-account-card">
            <label className="nf-field-label">Media Server URL</label>
            <div className="nf-field-row">
              <input type="url" className="nf-field-input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-tunnel.trycloudflare.com" />
              <button className="nf-btn-blue" onClick={handleSave}>{saved ? <><FaCheck /> Saved</> : 'Save'}</button>
              <button className="nf-btn-outline" onClick={() => testConnection(url)}><FaSync /> Test</button>
            </div>
            {status && (
              <div className={`nf-status-pill ${status}`}>
                {status === 'testing' && <><FaSpinner className="spin" /> Testing...</>}
                {status === 'online' && <><FaCheck /> Connected — {movieCount} movies</>}
                {status === 'offline' && <><FaTimes /> Cannot reach server</>}
              </div>
            )}
            <div className="nf-help-block">
              <strong>How to start:</strong> Run <code>bash start-media-server.sh</code> → Copy the tunnel URL → Paste above.
              <br />The page will refresh automatically after saving to load content from the new server.
            </div>
          </div>
        )}

        {/* ===== SECURITY ===== */}
        {activeNav === 'security' && currentUser && (
          <>
            {/* Change PIN */}
            <div className="nf-account-card">
              <h3 className="nf-card-heading"><FaKey /> Change PIN</h3>
              <p className="nf-card-desc">Update the 4-digit PIN used to lock your profile.</p>
              <div className="nf-field-row">
                <input type="password" className="nf-field-input pin" value={currentPin} onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="Current PIN" maxLength={4} />
                <input type="password" className="nf-field-input pin" value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="New PIN" maxLength={4} />
              </div>
              {profileMsg && (
                <div className={`nf-status-pill ${profileMsg.type === 'success' ? 'online' : 'offline'}`}>
                  {profileMsg.type === 'success' ? <FaCheck /> : <FaTimes />} {profileMsg.text}
                </div>
              )}
              <button className="nf-btn-blue" onClick={handleProfileSave} disabled={!currentPin || !newPin}>Save PIN</button>
            </div>

            {/* Delete Own Account */}
            <div className="nf-account-card nf-danger-card">
              <h3 className="nf-danger-title"><FaExclamationTriangle /> Delete Your Account</h3>
              <p className="nf-danger-desc">Permanently remove your profile, watch history, and watchlist.</p>
              {!showDeleteConfirm ? (
                <button className="nf-btn-danger" onClick={() => setShowDeleteConfirm(true)}><FaTrash /> Delete Account</button>
              ) : (
                <div className="nf-delete-form">
                  <div className="nf-field-row">
                    <input type="password" className="nf-field-input pin" value={deletePin} onChange={(e) => setDeletePin(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="Enter PIN" maxLength={4} />
                    <button className="nf-btn-danger" onClick={handleDeleteAccount} disabled={!deletePin || deleting}>
                      {deleting ? <FaSpinner className="spin" /> : 'Confirm Delete'}
                    </button>
                    <button className="nf-btn-outline" onClick={() => { setShowDeleteConfirm(false); setDeletePin(''); setDeleteError(null); }}>Cancel</button>
                  </div>
                  {deleteError && <div className="nf-status-pill offline"><FaTimes /> {deleteError}</div>}
                </div>
              )}
            </div>

            {/* Admin: Delete Other Users */}
            {isFiifi && otherUsers.length > 0 && (
              <div className="nf-account-card">
                <h3 className="nf-card-heading"><FaShieldAlt /> Admin — Manage Users</h3>
                <p className="nf-card-desc">As admin, you can remove other user profiles.</p>
                {otherUsers.map(u => (
                  <div key={u.id} className="nf-user-row">
                    <div className="nf-user-row-left">
                      <div className="nf-mini-avatar" style={{ background: u.avatar }}>
                        {u.emoji || u.username[0].toUpperCase()}
                      </div>
                      <div>
                        <span className="nf-user-row-name">{u.username}</span>
                        <span className="nf-user-row-sub">Created {new Date(u.createdAt || Date.now()).toLocaleDateString()}</span>
                      </div>
                    </div>
                    {adminDeleteTarget === u.id ? (
                      <div className="nf-admin-delete-confirm">
                        <span style={{ fontSize: '0.85rem', color: '#e50914' }}>Delete {u.username}?</span>
                        <button className="nf-btn-danger-sm" onClick={() => handleAdminDelete(u.id)} disabled={adminDeleting}>
                          {adminDeleting ? <FaSpinner className="spin" /> : 'Yes'}
                        </button>
                        <button className="nf-btn-outline-sm" onClick={() => { setAdminDeleteTarget(null); setAdminDeleteError(null); }}>No</button>
                      </div>
                    ) : (
                      <button className="nf-link-btn danger" onClick={() => setAdminDeleteTarget(u.id)}>
                        <FaTrash /> Remove
                      </button>
                    )}
                  </div>
                ))}
                {adminDeleteError && <div className="nf-status-pill offline"><FaTimes /> {adminDeleteError}</div>}
              </div>
            )}
          </>
        )}

        {/* ===== DEVICES (Drive Config) ===== */}
        {activeNav === 'devices' && (
          <>
            {isFiifi ? (
              <div className="nf-account-card">
                <h3 className="nf-card-heading"><FaHdd /> Drive Folders</h3>
                <p className="nf-card-desc">Configure the folders where your movies and TV shows are stored. Add multiple paths if content is spread across drives.</p>

                <label className="nf-field-label"><FaFolder /> Movies Folders</label>
                {moviesDirs.map((dir, i) => (
                  <div key={i} className="nf-path-row">
                    <input type="text" className="nf-field-input" value={dir} onChange={(e) => updateDir(moviesDirs, setMoviesDirs, i, e.target.value)} placeholder="/Volumes/MyDrive/Movies" />
                    {(() => { const s = getPathExists(pathStatus?.moviesDirs, i); if (!s) return null; return <span className={`nf-path-dot ${s.exists ? 'ok' : 'err'}`}>{s.exists ? <FaCheck /> : <FaTimes />}</span>; })()}
                    {moviesDirs.length > 1 && <button className="nf-icon-sm" onClick={() => removeDir(moviesDirs, setMoviesDirs, i)}><FaTrash /></button>}
                  </div>
                ))}
                <button className="nf-add-folder" onClick={() => addDir(moviesDirs, setMoviesDirs)}><FaPlus /> Add folder</button>

                <label className="nf-field-label" style={{ marginTop: '1.5rem' }}><FaFolder /> TV Shows Folders</label>
                {tvDirs.map((dir, i) => (
                  <div key={i} className="nf-path-row">
                    <input type="text" className="nf-field-input" value={dir} onChange={(e) => updateDir(tvDirs, setTvDirs, i, e.target.value)} placeholder="/Volumes/MyDrive/TV Shows" />
                    {(() => { const s = getPathExists(pathStatus?.tvDirs, i); if (!s) return null; return <span className={`nf-path-dot ${s.exists ? 'ok' : 'err'}`}>{s.exists ? <FaCheck /> : <FaTimes />}</span>; })()}
                    {tvDirs.length > 1 && <button className="nf-icon-sm" onClick={() => removeDir(tvDirs, setTvDirs, i)}><FaTrash /></button>}
                  </div>
                ))}
                <button className="nf-add-folder" onClick={() => addDir(tvDirs, setTvDirs)}><FaPlus /> Add folder</button>
                <br />
                <button className="nf-btn-blue" onClick={handleSavePaths}>{pathSaved ? <><FaCheck /> Saved</> : 'Save Paths'}</button>
              </div>
            ) : (
              <div className="nf-account-card">
                <h3 className="nf-card-heading"><FaDesktop /> Devices</h3>
                <p className="nf-card-desc">You are currently streaming from the shared media server. Drive configuration is managed by the admin.</p>
                <div className="nf-device-item">
                  <FaDesktop className="nf-device-icon" />
                  <div>
                    <strong>This Browser</strong>
                    <span className="nf-device-detail">{navigator.userAgent.includes('Mac') ? 'macOS' : navigator.userAgent.includes('Win') ? 'Windows' : 'Browser'} — Active now</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ===== PROFILES ===== */}
        {activeNav === 'profiles' && (
          <>
            {/* Current User Profile Edit */}
            {currentUser && (
              <div className="nf-account-card">
                <h3 className="nf-card-heading"><FaUser /> Your Profile</h3>
                <div className="nf-profile-edit-row">
                  <div className="nf-profile-avatar-lg" style={{ background: selectedColor || currentUser.avatar }}>
                    {selectedEmoji || currentUser.emoji || currentUser.username[0].toUpperCase()}
                  </div>
                  <div className="nf-profile-edit-fields">
                    <label className="nf-field-label">Display Name</label>
                    <input type="text" className="nf-field-input full" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />

                    <label className="nf-field-label" style={{ marginTop: '1rem' }}>Profile Emoji</label>
                    <div className="nf-emoji-selector">
                      <button className="nf-emoji-current" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                        {selectedEmoji || '✏️'} <span className="nf-emoji-label">{selectedEmoji ? 'Change' : 'Set emoji'}</span>
                      </button>
                      {selectedEmoji && (
                        <button className="nf-btn-outline-sm" onClick={() => setSelectedEmoji('')}>Clear</button>
                      )}
                    </div>
                    {showEmojiPicker && (
                      <div className="nf-emoji-grid">
                        {EMOJI_OPTIONS.map(e => (
                          <button key={e} className={`nf-emoji-pick ${selectedEmoji === e ? 'selected' : ''}`} onClick={() => { setSelectedEmoji(e); setShowEmojiPicker(false); }}>
                            {e}
                          </button>
                        ))}
                      </div>
                    )}

                    <label className="nf-field-label" style={{ marginTop: '1rem' }}>Profile Color</label>
                    <div className="nf-color-grid">
                      {AVATAR_COLORS.map(c => (
                        <button key={c} className={`nf-color-pick ${selectedColor === c ? 'selected' : ''}`} style={{ background: c }} onClick={() => setSelectedColor(c)} />
                      ))}
                    </div>
                  </div>
                </div>
                {profileMsg && (
                  <div className={`nf-status-pill ${profileMsg.type === 'success' ? 'online' : 'offline'}`} style={{ marginTop: '1rem' }}>
                    {profileMsg.type === 'success' ? <FaCheck /> : <FaTimes />} {profileMsg.text}
                  </div>
                )}
                <button className="nf-btn-blue" style={{ marginTop: '1rem' }} onClick={handleProfileSave}>Save Profile</button>
              </div>
            )}

            {/* Other Profiles */}
            {otherUsers.length > 0 && (
              <div className="nf-account-card">
                <h3 className="nf-card-heading"><FaUsers /> All Profiles ({users.length}/6)</h3>
                {otherUsers.map(u => (
                  <div key={u.id} className="nf-user-row">
                    <div className="nf-user-row-left">
                      <div className="nf-mini-avatar" style={{ background: u.avatar }}>
                        {u.emoji || u.username[0].toUpperCase()}
                      </div>
                      <div>
                        <span className="nf-user-row-name">{u.username}</span>
                        <span className="nf-user-row-sub">
                          {u.createdAt ? `Joined ${new Date(u.createdAt).toLocaleDateString()}` : 'Member'}
                        </span>
                      </div>
                    </div>
                    {isFiifi && (
                      <button className="nf-link-btn danger" onClick={() => setAdminDeleteTarget(u.id)}>
                        <FaTrash /> Remove
                      </button>
                    )}
                  </div>
                ))}
                {adminDeleteTarget && (
                  <div className="nf-admin-confirm-banner">
                    <FaExclamationTriangle />
                    <span>Delete <strong>{otherUsers.find(u => u.id === adminDeleteTarget)?.username}</strong>?</span>
                    <button className="nf-btn-danger-sm" onClick={() => handleAdminDelete(adminDeleteTarget)} disabled={adminDeleting}>
                      {adminDeleting ? <FaSpinner className="spin" /> : 'Delete'}
                    </button>
                    <button className="nf-btn-outline-sm" onClick={() => setAdminDeleteTarget(null)}>Cancel</button>
                  </div>
                )}
                {adminDeleteError && <div className="nf-status-pill offline"><FaTimes /> {adminDeleteError}</div>}
              </div>
            )}

            {/* Notifications */}
            {isFiifi && notifications.length > 0 && (
              <div className="nf-account-card">
                <h3 className="nf-card-heading"><FaBell /> Download Requests</h3>
                {notifications.map((n) => (
                  <div key={n.id} className="nf-notif-row">
                    <div>
                      <strong>{n.fromUser}</strong> requested <strong>{n.showName}</strong>
                      {n.message && <span className="nf-notif-msg"> — {n.message}</span>}
                    </div>
                    <button className="nf-link-btn danger" onClick={() => handleDismiss(n.id)}>Dismiss</button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default Settings;
