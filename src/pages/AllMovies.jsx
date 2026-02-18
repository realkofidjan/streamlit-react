import { useState, useEffect } from 'react';
import ContentModal from '../components/ContentModal';
import { getLibrary } from '../services/media';
import { searchMovies, getImageUrl } from '../services/tmdb';
import { cleanName, extractYear, pickBestResult } from '../utils/matchTmdb';
import { useUser } from '../contexts/UserContext';
import { FaCheckCircle } from 'react-icons/fa';
import './AllMedia.css';

function AllMovies() {
  const { currentUser } = useUser();
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalContent, setModalContent] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const openModal = (item) => {
    setModalContent({ ...item, type: 'movie' });
    setShowModal(true);
  };

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
        const unique = results.filter((m) => {
          if (seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        });
        // Shuffle for random order on each reload
        for (let i = unique.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [unique[i], unique[j]] = [unique[j], unique[i]];
        }
        setMovies(unique);
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
        <h1 className="all-media-title">Movies <span className="all-media-count">{movies.length}</span></h1>

        <div className="nf-backdrop-grid">
          {movies.map((m) => {
            const backdropUrl = m.backdrop_path
              ? getImageUrl(m.backdrop_path, 'w780')
              : (m.poster_path ? getImageUrl(m.poster_path, 'w500') : null);

            const entry = watchHistory[String(m.id)];
            const isWatched = entry && entry.progress >= 0.96;

            return (
              <div
                key={m.id}
                className="nf-backdrop-card"
                onClick={() => openModal(m)}
                role="button"
                tabIndex={0}
              >
                <div className="nf-backdrop-img">
                  {backdropUrl ? (
                    <img src={backdropUrl} alt={m.title} loading="lazy" />
                  ) : (
                    <div className="nf-backdrop-placeholder">{m.title}</div>
                  )}
                  <div className="nf-backdrop-gradient" />
                  <div className="nf-backdrop-title">{m.title}</div>

                  {/* Badges */}
                  <div className="nf-backdrop-badges">
                    {isWatched && (
                      <span className="nf-badge nf-badge-watched"><FaCheckCircle /> Watched</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {movies.length === 0 && (
          <p className="all-media-empty">No movies found on your drive.</p>
        )}
      </div>

      <ContentModal content={modalContent} show={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
}

export default AllMovies;
