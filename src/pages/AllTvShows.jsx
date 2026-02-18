import { useState, useEffect } from 'react';
import ContentModal from '../components/ContentModal';
import { getLibrary } from '../services/media';
import { searchTvShows, getTvShowDetails, getImageUrl } from '../services/tmdb';
import { cleanName, extractYear, pickBestResult } from '../utils/matchTmdb';
import { useUser } from '../contexts/UserContext';
import './AllMedia.css';

function AllTvShows() {
  const { currentUser } = useUser();
  const [shows, setShows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalContent, setModalContent] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const openModal = (item) => {
    setModalContent({ ...item, type: 'tv' });
    setShowModal(true);
  };

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
              if (best) {
                // Get detailed info for badge logic
                let badge = null;
                try {
                  const detailRes = await getTvShowDetails(best.id);
                  const detail = detailRes.data;
                  const now = new Date();
                  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
                  const threeMonthsAhead = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate());

                  // Check if show has a season that aired recently
                  if (detail.seasons && detail.seasons.length > 0) {
                    const latestSeason = detail.seasons
                      .filter(sea => sea.season_number > 0 && sea.air_date)
                      .sort((a, b) => new Date(b.air_date) - new Date(a.air_date))[0];

                    if (latestSeason) {
                      const airDate = new Date(latestSeason.air_date);
                      if (airDate >= threeMonthsAgo && airDate <= now && latestSeason.season_number > 1) {
                        badge = 'new-season';
                      }
                    }

                    // Check for upcoming season (next_episode_to_air or future season air_date)
                    if (!badge && detail.next_episode_to_air) {
                      const nextAir = new Date(detail.next_episode_to_air.air_date);
                      if (nextAir > now && nextAir <= threeMonthsAhead) {
                        badge = 'coming-soon';
                      }
                    }

                    // Check for future scheduled seasons
                    if (!badge) {
                      const futureSeason = detail.seasons.find(sea => {
                        if (!sea.air_date || sea.season_number === 0) return false;
                        const d = new Date(sea.air_date);
                        return d > now && d <= threeMonthsAhead;
                      });
                      if (futureSeason) {
                        badge = 'coming-soon';
                      }
                    }
                  }
                } catch {
                  // badge stays null
                }

                return { ...best, localName: s.name, badge };
              }
            } catch { /* skip */ }
            return null;
          });
          const batchResults = await Promise.all(promises);
          results.push(...batchResults.filter(Boolean));
        }

        const seen = new Set();
        const unique = results.filter((s) => {
          if (seen.has(s.id)) return false;
          seen.add(s.id);
          return true;
        });
        // Shuffle for random order on each reload
        for (let i = unique.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [unique[i], unique[j]] = [unique[j], unique[i]];
        }
        setShows(unique);
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
        <h1 className="all-media-title">TV Shows <span className="all-media-count">{shows.length}</span></h1>

        <div className="nf-backdrop-grid">
          {shows.map((s) => {
            const backdropUrl = s.backdrop_path
              ? getImageUrl(s.backdrop_path, 'w780')
              : (s.poster_path ? getImageUrl(s.poster_path, 'w500') : null);

            return (
              <div
                key={s.id}
                className="nf-backdrop-card"
                onClick={() => openModal(s)}
                role="button"
                tabIndex={0}
              >
                <div className="nf-backdrop-img">
                  {backdropUrl ? (
                    <img src={backdropUrl} alt={s.name} loading="lazy" />
                  ) : (
                    <div className="nf-backdrop-placeholder">{s.name}</div>
                  )}
                  <div className="nf-backdrop-gradient" />
                  <div className="nf-backdrop-title">{s.name}</div>

                  {/* Badges */}
                  <div className="nf-backdrop-badges">
                    {s.badge === 'new-season' && (
                      <span className="nf-badge nf-badge-new">New Season</span>
                    )}
                    {s.badge === 'coming-soon' && (
                      <span className="nf-badge nf-badge-soon">Coming Soon</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {shows.length === 0 && (
          <p className="all-media-empty">No TV shows found on your drive.</p>
        )}
      </div>

      <ContentModal content={modalContent} show={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
}

export default AllTvShows;
