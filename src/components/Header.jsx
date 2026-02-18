import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaFilm, FaCog, FaSignOutAlt, FaBell, FaTimes, FaBars, FaHome, FaVideo, FaTv, FaSearch } from 'react-icons/fa';
import { useUser } from '../contexts/UserContext';
import './Header.css';

function Header() {
  const { currentUser, logout, getNotifications, dismissNotification } = useUser();
  const isFiifi = currentUser?.username?.toLowerCase() === 'fiifi';
  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);
  const menuRef = useRef(null);
  const searchInputRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  // Header background on scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  // Close mobile menu on outside click
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [mobileMenuOpen]);

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
    <>
      <header className={`header${scrolled ? ' scrolled' : ''}`}>
        <div className="header-container">
          <Link to="/" className="logo">
            <FaFilm className="logo-icon" />
            <span>StreamIt</span>
          </Link>
          <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen((p) => !p)} aria-label="Toggle menu">
            {mobileMenuOpen ? <FaTimes /> : <FaBars />}
          </button>
          <nav className="nav-links nav-desktop">
            <Link to="/">Home</Link>
            <Link to="/movies">Movies</Link>
            <Link to="/tv-shows">TV Shows</Link>
            <div className={`header-search ${searchOpen ? 'open' : ''}`}>
              <button
                className="header-search-icon"
                onClick={() => {
                  setSearchOpen(true);
                  setTimeout(() => searchInputRef.current?.focus(), 100);
                }}
              >
                <FaSearch />
              </button>
              {searchOpen && (
                <input
                  ref={searchInputRef}
                  className="header-search-input"
                  type="text"
                  placeholder="Titles, people, genres"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchQuery.trim()) {
                      navigate(`/search?type=movie&query=${encodeURIComponent(searchQuery.trim())}`);
                      setSearchOpen(false);
                      setSearchQuery('');
                    }
                    if (e.key === 'Escape') {
                      setSearchOpen(false);
                      setSearchQuery('');
                    }
                  }}
                  onBlur={() => {
                    if (!searchQuery) setSearchOpen(false);
                  }}
                />
              )}
            </div>
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

      {/* Floating mobile menu */}
      {mobileMenuOpen && <div className="mobile-overlay" />}
      <div className={`mobile-floating-menu ${mobileMenuOpen ? 'open' : ''}`} ref={menuRef}>
        {currentUser && (
          <div className="mobile-menu-profile">
            <div className="mobile-menu-avatar" style={{ background: currentUser.avatar }}>
              {currentUser.username[0].toUpperCase()}
            </div>
            <span className="mobile-menu-username">{currentUser.username}</span>
          </div>
        )}
        <nav className="mobile-menu-nav">
          <Link to="/" className="mobile-menu-link">
            <FaHome /> Home
          </Link>
          <Link to="/movies" className="mobile-menu-link">
            <FaVideo /> Movies
          </Link>
          <Link to="/tv-shows" className="mobile-menu-link">
            <FaTv /> TV Shows
          </Link>
          {isFiifi && (
            <button
              className="mobile-menu-link"
              onClick={() => { setShowDropdown((p) => !p); setMobileMenuOpen(false); }}
            >
              <FaBell />
              Notifications
              {notifications.length > 0 && (
                <span className="mobile-notif-count">{notifications.length}</span>
              )}
            </button>
          )}
          <Link to="/settings" className="mobile-menu-link">
            <FaCog /> Settings
          </Link>
        </nav>
        {currentUser && (
          <button className="mobile-menu-logout" onClick={() => { logout(); setMobileMenuOpen(false); }}>
            <FaSignOutAlt /> Switch Profile
          </button>
        )}
      </div>
    </>
  );
}

export default Header;
