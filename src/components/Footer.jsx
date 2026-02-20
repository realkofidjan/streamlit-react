import { Link } from 'react-router-dom';
import { FaFilm, FaGithub, FaTwitter, FaInstagram } from 'react-icons/fa';
import './Footer.css';

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-top">
          <div className="footer-brand">
            <Link to="/" className="footer-logo">
              <img src="/logo.png" alt="StreamLit Logo" className="footer-logo-img" style={{ height: '32px', objectFit: 'contain', marginRight: '8px' }} />
            </Link>
            <p className="footer-desc">
              Your ultimate destination for movies and TV shows. Discover, explore, and enjoy endless entertainment.
            </p>
          </div>
          <div className="footer-links">
            <h4>Quick Links</h4>
            <Link to="/">Home</Link>
            <Link to="/search?type=movie">Movies</Link>
            <Link to="/search?type=tv">TV Shows</Link>
          </div>
          <div className="footer-social">
            <h4>Follow Us</h4>
            <div className="social-icons">
              <a href="#" aria-label="GitHub"><FaGithub /></a>
              <a href="#" aria-label="Twitter"><FaTwitter /></a>
              <a href="#" aria-label="Instagram"><FaInstagram /></a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} StreamLit. Hobby Project. Powered by TMDB.</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
