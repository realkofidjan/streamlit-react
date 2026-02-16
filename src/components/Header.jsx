import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FaFilm, FaCog, FaSignOutAlt, FaBell, FaTimes } from 'react-icons/fa';
import { useUser } from '../contexts/UserContext';
import './Header.css';

function Header() {
  const { currentUser, logout, getNotifications, dismissNotification } = useUser();
  const isFiifi = currentUser?.username?.toLowerCase() === 'fiifi';
  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!isFiifi) return;
    const load = async () => {
      const notifs = await getNotifications();
      setNotifications(notifs);
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [isFiifi, getNotifications]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDropdown) return;
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showDropdown]);

  const handleDismiss = async (notifId) => {
    const remaining = await dismissNotification(notifId);
    setNotifications(remaining);
  };

  return (
    <header className="header">
      <div className="header-container">
        <Link to="/" className="logo">
          <FaFilm className="logo-icon" />
          <span>StreamIt</span>
        </Link>
        <nav className="nav-links">
          <Link to="/">Home</Link>
          <Link to="/movies">Movies</Link>
          <Link to="/tv-shows">TV Shows</Link>
          {isFiifi && (
            <div className="notif-wrapper" ref={dropdownRef}>
              <button
                className="notif-bell"
                title="Notifications"
                onClick={() => setShowDropdown((p) => !p)}
              >
                <FaBell />
                {notifications.length > 0 && (
                  <span className="notif-badge">{notifications.length}</span>
                )}
              </button>
              {showDropdown && (
                <div className="notif-dropdown">
                  <div className="notif-dropdown-header">
                    <strong>Download Requests</strong>
                  </div>
                  {notifications.length === 0 ? (
                    <p className="notif-empty">No requests</p>
                  ) : (
                    notifications.map((n) => (
                      <div key={n.id} className="notif-dropdown-item">
                        <div className="notif-dropdown-text">
                          <strong>{n.fromUser}</strong> requested <strong>{n.showName}</strong>
                          {n.message && <span className="notif-dropdown-detail"> — {n.message}</span>}
                        </div>
                        <button className="notif-dropdown-dismiss" onClick={() => handleDismiss(n.id)}>
                          <FaTimes />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
          <Link to="/settings" title="Settings"><FaCog /></Link>
          {currentUser && (
            <div className="header-user">
              <div className="header-avatar" style={{ background: currentUser.avatar }}>
                {currentUser.username[0].toUpperCase()}
              </div>
              <button className="header-logout" onClick={logout} title="Switch Profile">
                <FaSignOutAlt />
              </button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}

export default Header;
