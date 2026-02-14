import { Link } from 'react-router-dom';
import { FaFilm, FaCog } from 'react-icons/fa';
import './Header.css';

function Header() {
  return (
    <header className="header">
      <div className="header-container">
        <Link to="/" className="logo">
          <FaFilm className="logo-icon" />
          <span>StreamIt</span>
        </Link>
        <nav className="nav-links">
          <Link to="/">Home</Link>
          <Link to="/settings" title="Settings"><FaCog /></Link>
        </nav>
      </div>
    </header>
  );
}

export default Header;
