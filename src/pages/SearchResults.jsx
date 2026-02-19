import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import MediaCard from '../components/MediaCard';
import ContentModal from '../components/ContentModal';
import { searchMovies, searchTvShows } from '../services/tmdb';
import { searchLocalMovies, searchLocalTvShows } from '../services/media';
import './SearchResults.css';

function SearchResults() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('query') || '';
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [localIds, setLocalIds] = useState(new Set());
  const [modalContent, setModalContent] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const openModal = (item) => {
    setModalContent(item);
    setShowModal(true);
  };

  // Fetch both movies and TV shows, sort by date
  useEffect(() => {
    const fetchResults = async () => {
      if (!query.trim()) {
        setResults([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const [moviesRes, showsRes] = await Promise.all([
          searchMovies(query).catch(() => ({ data: { results: [] } })),
          searchTvShows(query).catch(() => ({ data: { results: [] } })),
        ]);

        const movies = (moviesRes.data.results || []).map((m) => ({
          ...m,
          type: 'movie',
          date: m.release_date || '',
        }));

        const shows = (showsRes.data.results || []).map((s) => ({
          ...s,
          type: 'tv',
          date: s.first_air_date || '',
        }));

        // Combine and sort by newest date
        const combined = [...movies, ...shows].sort((a, b) => {
          return new Date(b.date || 0) - new Date(a.date || 0);
        });

        // Unique by ID+Type to avoid duplicates if TMDB returns same item
        const unique = [];
        const seen = new Set();
        for (const item of combined) {
          const key = `${item.type}-${item.id}`;
          if (!seen.has(key)) {
            seen.add(key);
            unique.push(item);
          }
        }

        setResults(unique);
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, [query]);

  // Check local availability for visible results
  useEffect(() => {
    if (results.length === 0) return;
    const checkLocal = async () => {
      const ids = new Set();
      // Check top 20 results for performance
      for (const item of results.slice(0, 20)) {
        const title = item.type === 'movie' ? item.title : item.name;
        if (!title) continue;
        try {
          const searcher = item.type === 'movie' ? searchLocalMovies : searchLocalTvShows;
          const res = await searcher(title);
          if (res.data.length > 0) ids.add(`${item.type}-${item.id}`);
        } catch { /* skip */ }
      }
      setLocalIds(ids);
    };
    checkLocal();
  }, [results]);

  return (
    <div className="search-results-page">
      <div className="search-results-header">
        <h1>
          Search results for <span className="search-results-query">&ldquo;{query}&rdquo;</span>
        </h1>
      </div>

      {loading ? (
        <div className="loading-spinner">
          <div className="spinner" />
        </div>
      ) : results.length === 0 ? (
        <div className="no-results">
          <p>Your search for &ldquo;{query}&rdquo; did not have any matches.</p>
          <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>Suggestions:</p>
          <ul style={{ fontSize: '0.9rem', textAlign: 'left', display: 'inline-block', marginTop: '0.5rem', color: '#666' }}>
            <li>Try different keywords</li>
            <li>Looking for a movie or TV show?</li>
            <li>Try using a movie, TV show title, or actor</li>
          </ul>
        </div>
      ) : (
        <div className="nf-grid">
          {results.map((item) => {
            const isLocal = localIds.has(`${item.type}-${item.id}`);
            return (
              <MediaCard
                key={`${item.type}-${item.id}`}
                item={item}
                type={item.type}
                badge={isLocal ? 'local' : null}
                onClick={() => openModal(item)}
              />
            );
          })}
        </div>
      )}

      <ContentModal content={modalContent} show={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
}

export default SearchResults;
