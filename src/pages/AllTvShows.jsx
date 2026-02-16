import { useState, useEffect } from 'react';
import MediaCard from '../components/MediaCard';
import { getLibrary } from '../services/media';
import { searchTvShows } from '../services/tmdb';
import { cleanName, extractYear, pickBestResult } from '../utils/matchTmdb';
import './AllMedia.css';

function AllTvShows() {
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const libRes = await getLibrary();
        const localShows = libRes.data.tvShows || [];
        const results = [];
        for (let i = 0; i < localShows.length; i += 5) {
          const batch = localShows.slice(i, i + 5);
          const promises = batch.map(async (s) => {
            try {
              const year = extractYear(s.name);
              const res = await searchTvShows(cleanName(s.name));
              const best = pickBestResult(res.data.results, year, 'first_air_date');
              if (best) return { ...best, localName: s.name };
            } catch { /* skip */ }
            return null;
          });
          const batchResults = await Promise.all(promises);
          results.push(...batchResults.filter(Boolean));
        }
        const seen = new Set();
        setShows(results.filter((s) => {
          if (seen.has(s.id)) return false;
          seen.add(s.id);
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
        <h1 className="all-media-title">All TV Shows <span className="all-media-count">{shows.length}</span></h1>
        <div className="all-media-grid">
          {shows.map((s) => (
            <MediaCard key={s.id} item={s} type="tv" badge="local" />
          ))}
        </div>
        {shows.length === 0 && (
          <p className="all-media-empty">No TV shows found on your drive.</p>
        )}
      </div>
    </div>
  );
}

export default AllTvShows;
