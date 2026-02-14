import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaSearch } from 'react-icons/fa';
import './HeroSearch.css';

function HeroSearch() {
  const [activeTab, setActiveTab] = useState('movie');
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?type=${activeTab}&query=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <section className="hero-search">
      <div className="hero-bg-overlay" />
      <div className="hero-content">
        <h1 className="hero-title">Welcome to StreamIt</h1>
        <p className="hero-subtitle">
          Millions of movies and TV shows to discover. Explore now.
        </p>
        <div className="hero-tabs">
          <button
            className={`hero-tab ${activeTab === 'movie' ? 'active' : ''}`}
            onClick={() => setActiveTab('movie')}
          >
            Movies
          </button>
          <button
            className={`hero-tab ${activeTab === 'tv' ? 'active' : ''}`}
            onClick={() => setActiveTab('tv')}
          >
            TV Shows
          </button>
        </div>
        <form className="hero-search-form" onSubmit={handleSearch}>
          <input
            type="text"
            placeholder={activeTab === 'movie' ? 'Search for a movie...' : 'Search for a TV show...'}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="hero-search-input"
          />
          <button type="submit" className="hero-search-btn">
            <FaSearch />
            <span>Search</span>
          </button>
        </form>
      </div>
    </section>
  );
}

export default HeroSearch;
