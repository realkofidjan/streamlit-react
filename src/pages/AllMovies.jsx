import { useState, useEffect } from 'react';
import MediaCard from '../components/MediaCard';
import { getLibrary } from '../services/media';
import { searchMovies } from '../services/tmdb';
import { cleanName, extractYear, pickBestResult } from '../utils/matchTmdb';
import './AllMedia.css';

function AllMovies() {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const libRes = await getLibrary();
        const localMovies = libRes.data.movies || [];
        const results = [];
        for (let i = 0; i < localMovies.length; i += 5) {
          const batch = localMovies.slice(i, i + 5);
          const promises = batch.map(async (m) => {
            try {
              const year = extractYear(m.name);
              const res = await searchMovies(cleanName(m.name));
              const best = pickBestResult(res.data.results, year, 'release_date');
              if (best) return { ...best, localFilename: m.filename };
            } catch { /* skip */ }
            return null;
          });
          const batchResults = await Promise.all(promises);
          results.push(...batchResults.filter(Boolean));
        }
        const seen = new Set();
        setMovies(results.filter((m) => {
          if (seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        }));
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="all-media-page">
      <div className="container">
        <h1 className="all-media-title">All Movies <span className="all-media-count">{movies.length}</span></h1>
        <div className="all-media-grid">
          {movies.map((m) => (
            <MediaCard key={m.id} item={m} type="movie" badge="local" />
          ))}
        </div>
        {movies.length === 0 && (
          <p className="all-media-empty">No movies found on your drive.</p>
        )}
      </div>
    </div>
  );
}

export default AllMovies;
