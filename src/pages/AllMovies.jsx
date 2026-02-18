import { useState, useEffect } from 'react';
import MediaCard from '../components/MediaCard';
import { getLibrary } from '../services/media';
import { searchMovies } from '../services/tmdb';
import { cleanName, extractYear, pickBestResult } from '../utils/matchTmdb';
import { useUser } from '../contexts/UserContext';
import './AllMedia.css';

function AllMovies() {
  const { currentUser } = useUser();
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);

  // Get watched status
  const watchHistory = currentUser?.watchHistory?.movies || {};

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

        {/* Use the shared Netflix grid class from SearchResults/Global CSS if possible, 
            but for now I'll use a local class that matches the grid styles 
            or reuse the layout from SearchResults if I move it to global. 
            Actually, let's just use the style directly or add it to AllMedia.css 
        */}
        <div className="nf-grid-library">
          {movies.map((m) => {
            // Check watched status using the history directly or rely on MediaCard's internal check
            // MediaCard already checks watchHistory if we pass 'local' badge, 
            // but let's be explicit because MediaCard logic is:
            // if (isLocal && type === 'movie') checks history.
            // We are passing badge="local" so it should work automatically!
            return <MediaCard key={m.id} item={m} type="movie" badge="local" />;
          })}
        </div>

        {movies.length === 0 && (
          <p className="all-media-empty">No movies found on your drive.</p>
        )}
      </div>
    </div>
  );
}

export default AllMovies;
