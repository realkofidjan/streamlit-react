import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FaPlus, FaUser, FaCog, FaSyncAlt } from 'react-icons/fa';
import { useUser } from '../contexts/UserContext';
import { isServerConfigured } from '../services/media';
import './ProfileSelect.css';

const AVATARS = ['#e50914', '#3498db', '#2ecc71', '#9b59b6', '#f39c12', '#1abc9c'];

function ProfileSelect() {
  const { users, createUser, login, fetchUsers } = useUser();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [showPin, setShowPin] = useState(null);
  const [pin, setPin] = useState('');
  const [newName, setNewName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newAvatar, setNewAvatar] = useState(AVATARS[0]);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');
    try {
      await login(showPin.id, pin);
      navigate('/');
    } catch {
      setError('Wrong PIN');
      setPin('');
    }
  };

  const handleCreate = async () => {
    if (!newName.trim() || newPin.length !== 4) return;
    setError('');
    try {
      const user = await createUser(newName.trim(), newPin, newAvatar);
      await login(user.id, newPin);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create profile');
    }
  };

  if (showPin) {
    return (
      <div className="profile-page">
        <div className="profile-pin-screen">
          <div className="profile-pin-avatar" style={{ background: showPin.avatar }}>
            {showPin.username[0].toUpperCase()}
          </div>
          <h2>{showPin.username}</h2>
          <p className="profile-pin-label">Enter your PIN</p>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            className="pin-text-input"
            value={pin}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, 4);
              setPin(v);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && pin.length === 4) handleLogin();
            }}
            placeholder="----"
            autoFocus
          />
          {error && <p className="pin-error">{error}</p>}
          <div className="pin-actions">
            <button className="pin-submit" onClick={handleLogin} disabled={pin.length !== 4}>
              Enter
            </button>
            <button className="pin-back" onClick={() => { setShowPin(null); setPin(''); setError(''); }}>
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showCreate) {
    return (
      <div className="profile-page">
        <div className="profile-create-screen">
          <h2>Create Profile</h2>
          <div className="create-avatar-preview" style={{ background: newAvatar }}>
            {newName ? newName[0].toUpperCase() : <FaUser />}
          </div>
          <div className="create-avatars">
            {AVATARS.map((c) => (
              <button
                key={c}
                className={`avatar-pick ${c === newAvatar ? 'selected' : ''}`}
                style={{ background: c }}
                onClick={() => setNewAvatar(c)}
              />
            ))}
          </div>
          <input
            className="create-input"
            placeholder="Username"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
          />
          <input
            className="create-input"
            type="password"
            inputMode="numeric"
            maxLength={4}
            placeholder="4-digit PIN"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          />
          {error && <p className="pin-error">{error}</p>}
          <div className="pin-actions">
            <button className="pin-submit" onClick={handleCreate} disabled={!newName.trim() || newPin.length !== 4}>
              Create
            </button>
            <button className="pin-back" onClick={() => { setShowCreate(false); setError(''); }}>
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isServerConfigured()) {
    return (
      <div className="profile-page">
        <h1 className="profile-heading">StreamIt</h1>
        <p className="profile-setup-msg">
          No media server configured. Set your server URL in Settings to get started.
        </p>
        <Link to="/settings" className="profile-setup-btn"><FaCog /> Go to Settings</Link>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-top-bar">
        <button className="profile-top-btn" onClick={fetchUsers} title="Refresh">
          <FaSyncAlt />
        </button>
        <button className="profile-top-btn" onClick={() => navigate('/settings')} title="Settings">
          <FaCog />
        </button>
      </div>
      <h1 className="profile-heading">Who's watching?</h1>
      <div className="profile-grid">
        {users.map((u) => (
          <button key={u.id} className="profile-card" onClick={() => setShowPin(u)}>
            <div className="profile-avatar" style={{ background: u.avatar }}>
              {u.username[0].toUpperCase()}
            </div>
            <span className="profile-name">{u.username}</span>
          </button>
        ))}
        <button className="profile-card add" onClick={() => setShowCreate(true)}>
          <div className="profile-avatar add-avatar">
            <FaPlus />
          </div>
          <span className="profile-name">Add Profile</span>
        </button>
      </div>
    </div>
  );
}

export default ProfileSelect;
