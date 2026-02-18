import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FaPlus, FaUser } from 'react-icons/fa';
import { useUser } from '../contexts/UserContext';
import { isServerConfigured } from '../services/media';
import './ProfileSelect.css';

const AVATARS = ['#e50914', '#3498db', '#2ecc71', '#9b59b6', '#f39c12', '#1abc9c', '#34495e', '#e67e22'];

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

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

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
            {showPin.emoji || showPin.username[0].toUpperCase()}
          </div>
          <h2 style={{ marginBottom: '1.5rem', color: '#fff' }}>{showPin.username}</h2>
          <p className="profile-pin-label">Profile Lock is on.</p>
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
            placeholder=""
            autoFocus
          />
          {error && <p className="pin-error">{error}</p>}
          <div className="pin-actions">
            <button className="pin-back" onClick={() => { setShowPin(null); setPin(''); setError(''); }}>
              CANCEL
            </button>
            <button className="pin-submit" onClick={handleLogin} disabled={pin.length !== 4} style={{ borderColor: pin.length === 4 ? '#e50914' : '#808080', color: pin.length === 4 ? '#e50914' : '#808080' }}>
              CONTINUE
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
          <h2 style={{ fontSize: '2.5rem', marginBottom: '1rem', fontWeight: 500 }}>Add Profile</h2>
          <p style={{ color: '#666', marginBottom: '2rem' }}>Add a profile for another person watching StreamLit.</p>

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
            placeholder="Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
          />
          <input
            className="create-input"
            type="password"
            inputMode="numeric"
            maxLength={4}
            placeholder="Create PIN (4 digits)"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          />
          {error && <p className="pin-error">{error}</p>}

          <div className="pin-actions" style={{ marginTop: '2rem' }}>
            <button className="pin-submit" onClick={handleCreate} disabled={!newName.trim() || newPin.length !== 4} style={{ background: '#fff', color: '#000', borderColor: '#fff' }}>
              CONTINUE
            </button>
            <button className="pin-back" onClick={() => { setShowCreate(false); setError(''); }}>
              CANCEL
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <h1 className="profile-heading">Who's watching?</h1>

      <div className="profile-grid">
        {users.map((u) => (
          <button key={u.id} className="profile-card" onClick={() => setShowPin(u)}>
            <div className="profile-avatar" style={{ background: u.avatar }}>
              {u.emoji || u.username[0].toUpperCase()}
            </div>
            <span className="profile-name">{u.username}</span>
          </button>
        ))}

        {users.length < 6 && (
          <button className="profile-card add" onClick={() => setShowCreate(true)}>
            <div className="profile-avatar add-avatar">
              <FaPlus style={{ fontSize: '2rem' }} />
            </div>
            <span className="profile-name">Add Profile</span>
          </button>
        )}
      </div>

      <button className="manage-profiles-btn" onClick={() => navigate('/settings')}>
        Settings
      </button>

      {!isServerConfigured() && (
        <div style={{ marginTop: '3rem', textAlign: 'center', opacity: 0.7 }}>
          <p style={{ marginBottom: '1rem', color: '#999' }}>
            No media server configured.
          </p>
          <Link to="/settings" style={{ color: '#fff', textDecoration: 'underline' }}>Go to Settings</Link>
        </div>
      )}
    </div>
  );
}

export default ProfileSelect;
