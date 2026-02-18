import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaFilm, FaCog, FaSignOutAlt, FaBell, FaTimes, FaBars, FaHome, FaVideo, FaTv, FaSearch } from 'react-icons/fa';
import { useUser } from '../contexts/UserContext';
import { searchMovies, searchTvShows, getImageUrl } from '../services/tmdb';
import './Header.css';

function Header() {
  const { currentUser, logout, getNotifications, dismissNotification } = useUser();
  const isFiifi = currentUser?.username?.toLowerCase() === 'fiifi';
  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const dropdownRef = useRef(null);
  const menuRef = useRef(null);
  const searchRef = useRef(null);
  const searchTimerRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Header background on scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    setSearchFocused(false);
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

  // Close search on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

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

  // Close notif dropdown on outside click
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

  // Live search — debounce 300ms, fetch both movies + shows, sort by date
  const performSearch = useCallback(async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const [moviesRes, showsRes] = await Promise.all([
        searchMovies(query).catch(() => ({ data: { results: [] } })),
        searchTvShows(query).catch(() => ({ data: { results: [] } })),
      ]);

      const movies = (moviesRes.data.results || []).slice(0, 10).map((m) => ({
        id: m.id,
        title: m.title,
        poster_path: m.poster_path,
        date: m.release_date || '',
        type: 'movie',
        year: m.release_date ? new Date(m.release_date).getFullYear() : null,
      }));

      const shows = (showsRes.data.results || []).slice(0, 10).map((s) => ({
        id: s.id,
        title: s.name,
        poster_path: s.poster_path,
        date: s.first_air_date || '',
        type: 'tv',
        year: s.first_air_date ? new Date(s.first_air_date).getFullYear() : null,
      }));

      const combined = [...movies, ...shows]
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        .slice(0, 5);

      setSearchResults(combined);
    } catch {
      setSearchResults([]);
    }
  }, []);

  const handleSearchInput = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => performSearch(val), 300);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      navigate(`/search?type=movie&query=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
      setSearchResults([]);
      setSearchFocused(false);
    }
    if (e.key === 'Escape') {
      setSearchQuery('');
      setSearchResults([]);
      setSearchFocused(false);
    }
  };

  const goToResult = (r) => {
    const path = r.type === 'movie' ? `/movie/${r.id}` : `/tv/${r.id}`;
    navigate(path);
    setSearchQuery('');
    setSearchResults([]);
    setSearchFocused(false);
  };

  return (
    <>
      <header className={`header${scrolled ? ' scrolled' : ''}`}>
        <div className="header-container">
          <Link to="/" className="logo">
            <FaFilm className="logo-icon" />
            <span>StreamIt</span>
          </Link>

          <nav className="nav-links-left nav-desktop">
            <Link to="/">Home</Link>
            <Link to="/movies">Movies</Link>
            <Link to="/tv-shows">TV Shows</Link>
          </nav>

          {/* Centered Search */}
          <div className="header-search-wrapper" ref={searchRef}>
            <div className="header-search-bar">
              <FaSearch className="header-search-icon" />
              <input
                type="text"
                className="header-search-input"
                placeholder="Search titles..."
                value={searchQuery}
                onChange={handleSearchInput}
                onFocus={() => setSearchFocused(true)}
                onKeyDown={handleSearchKeyDown}
              />
            </div>
            {searchFocused && searchResults.length > 0 && (
              <div className="header-search-dropdown">
                {searchResults.map((r) => (
                  <button
                    key={`${r.type}-${r.id}`}
                    className="header-search-result"
                    onClick={() => goToResult(r)}
                  >
                    <div className="search-result-poster">
                      {r.poster_path ? (
                        <img src={getImageUrl(r.poster_path, 'w92')} alt="" />
                      ) : (
                        <div className="search-result-no-img" />
                      )}
                    </div>
                    <div className="search-result-info">
                      <span className="search-result-title">{r.title}</span>
                      <span className="search-result-meta">
                        {r.type === 'movie' ? 'Movie' : 'TV Show'}
                        {r.year && ` · ${r.year}`}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="nav-links-right nav-desktop">
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
          </div>

          <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen((p) => !p)} aria-label="Toggle menu">
            {mobileMenuOpen ? <FaTimes /> : <FaBars />}
          </button>
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
