import { Link } from 'react-router-dom';
import { FaFilm, FaCog, FaSignOutAlt } from 'react-icons/fa';
import { useUser } from '../contexts/UserContext';
import './Header.css';

function Header() {
  const { currentUser, logout } = useUser();

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
