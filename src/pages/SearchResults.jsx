import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import MediaCard from '../components/MediaCard';
import { searchMovies, searchTvShows } from '../services/tmdb';
import { searchLocalMovies, searchLocalTvShows } from '../services/media';
import './SearchResults.css';

function SearchResults() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('query') || '';
  const type = searchParams.get('type') || 'movie';
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [localIds, setLocalIds] = useState(new Set());

  useEffect(() => {
    setPage(1);
  }, [query, type]);

  useEffect(() => {
    const fetchResults = async () => {
      if (!query) {
        setResults([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const fetcher = type === 'tv' ? searchTvShows : searchMovies;
        const res = await fetcher(query, page);
        setResults(res.data.results);
        setTotalPages(res.data.total_pages);
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, [query, type, page]);

  // Check which results are on local drive
  useEffect(() => {
    if (results.length === 0) return;
    const checkLocal = async () => {
      const ids = new Set();
      try {
        for (const item of results.slice(0, 20)) {
          const title = type === 'movie' ? item.title : item.name;
          if (!title) continue;
          try {
            const searcher = type === 'movie' ? searchLocalMovies : searchLocalTvShows;
            const res = await searcher(title);
            if (res.data.length > 0) ids.add(item.id);
          } catch { /* skip */ }
        }
      } catch { /* skip */ }
      setLocalIds(ids);
    };
    checkLocal();
  }, [results, type]);

  const getBadge = (item) => {
    if (localIds.has(item.id)) return 'local';
    return 'download';
  };

  return (
    <div className="search-results-page">
      <div className="container">
        <div className="search-results-header">
          <h1>
            Search Results for &ldquo;{query}&rdquo;
          </h1>
          <span className="search-type-badge">
            {type === 'tv' ? 'TV Shows' : 'Movies'}
          </span>
        </div>

        {loading ? (
          <div className="loading-spinner">
            <div className="spinner" />
          </div>
        ) : results.length === 0 ? (
          <p className="no-results">No results found. Try a different search term.</p>
        ) : (
          <>
            <div className="card-grid">
              {results.map((item) => (
                <MediaCard key={item.id} item={item} type={type} badge={getBadge(item)} />
              ))}
            </div>
            {totalPages > 1 && (
              <div className="pagination">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="pagination-btn"
                >
                  Previous
                </button>
                <span className="pagination-info">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="pagination-btn"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default SearchResults;
