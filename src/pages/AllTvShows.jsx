import { useState, useEffect, useMemo } from 'react';
import ContentModal from '../components/ContentModal';
import MediaCard from '../components/MediaCard';
import { getLibrary } from '../services/media';
import { searchTvShows, getTvShowDetails, getTvGenres } from '../services/tmdb';
import { cleanName, extractYear, pickBestResult } from '../utils/matchTmdb';
import './AllMedia.css';

function AllTvShows() {
  const [loading, setLoading] = useState(true);
  const [shows, setShows] = useState([]);
  const [genres, setGenres] = useState({});
  const [modalContent, setModalContent] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Filters
  const [sortBy, setSortBy] = useState('title_asc');
  const [selectedGenre, setSelectedGenre] = useState('all');

  const openModal = (item) => {
    setModalContent({ ...item, type: 'tv' });
    setShowModal(true);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch Genres
        const genreRes = await getTvGenres();
        const genreMap = {};
        genreRes.data.genres.forEach(g => genreMap[g.id] = g.name);
        setGenres(genreMap);

        // Fetch Shows
        const libRes = await getLibrary();
        const localShows = libRes.data.tvShows || [];
        const results = [];

        const BATCH_SIZE = 3;
        for (let i = 0; i < localShows.length; i += BATCH_SIZE) {
          const batch = localShows.slice(i, i + BATCH_SIZE);
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

                  if (detail.seasons && detail.seasons.length > 0) {
                    const latestSeason = detail.seasons
                      .filter(sea => sea.season_number > 0 && sea.air_date)
                      .sort((a, b) => new Date(b.air_date) - new Date(a.air_date))[0];

                    if (latestSeason) {
                      const airDate = new Date(latestSeason.air_date);
                      if (airDate >= threeMonthsAgo && airDate <= now && latestSeason.season_number > 1) {
                        badge = { type: 'new-episodes' };
                      }
                    }
                    if (!badge && detail.next_episode_to_air) {
                      const nextAir = new Date(detail.next_episode_to_air.air_date);
                      if (nextAir > now && nextAir <= threeMonthsAhead) {
                        badge = { type: 'coming-soon' };
                      }
                    }
                  }
                } catch { }

                // Check if fully watched
                let isFullyWatched = false;
                try {
                  // Using detail from above
                  if (detail && detail.number_of_episodes > 0) {
                    const totalEp = detail.number_of_episodes;
                    // Count watched episodes in history
                    const watchedCount = Object.keys(currentUser?.watchHistory?.episodes || {})
                      .filter(k => k.startsWith(`${best.id}-`) && currentUser.watchHistory.episodes[k].progress >= 0.97)
                      .length;
                    if (watchedCount >= totalEp) {
                      isFullyWatched = true;
                    }
                  }
                } catch { }

                return { ...best, localName: s.name, badge: badge || 'local', isFullyWatched };
              }
            } catch { /* skip */ }
            return null;
          });
          const batchResults = await Promise.all(promises);
          results.push(...batchResults.filter(Boolean));
          // Rate limit: wait 300ms between batches
          await new Promise(resolve => setTimeout(resolve, 300));
        }

        const seen = new Set();
        const unique = results.filter((s) => {
          if (seen.has(s.id)) return false;
          seen.add(s.id);
          return true;
        });

        setShows(unique);
      } catch (err) {
        console.error("Failed to load TV shows", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const processedShows = useMemo(() => {
    let result = [...shows];

    // Filter
    if (selectedGenre !== 'all') {
      const genreId = parseInt(selectedGenre);
      result = result.filter(s => s.genre_ids && s.genre_ids.includes(genreId));
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'title_asc':
          return (a.name || '').localeCompare(b.name || '');
        case 'title_desc':
          return (b.name || '').localeCompare(a.name || '');
        case 'date_new':
          return new Date(b.first_air_date || 0) - new Date(a.first_air_date || 0);
        case 'date_old':
          return new Date(a.first_air_date || 0) - new Date(b.first_air_date || 0);
        case 'rating_high':
          return b.vote_average - a.vote_average;
        default:
          return 0;
      }
    });

    return result;
  }, [shows, sortBy, selectedGenre]);

  // Extract available genres
  const availableGenres = useMemo(() => {
    const ids = new Set();
    shows.forEach(s => {
      if (s.genre_ids) s.genre_ids.forEach(id => ids.add(id));
    });
    return Array.from(ids).map(id => ({ id, name: genres[id] })).filter(g => g.name).sort((a, b) => a.name.localeCompare(b.name));
  }, [shows, genres]);

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
        <div className="all-media-header">
          <h1 className="all-media-title">TV Shows <span className="all-media-count">{processedShows.length}</span></h1>

          <div className="nf-filter-bar">
            {/* Genre Filter */}
            <div className="nf-filter-group">
              <select
                className="nf-filter-select"
                value={selectedGenre}
                onChange={(e) => setSelectedGenre(e.target.value)}
              >
                <option value="all">All Genres</option>
                {availableGenres.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            {/* Sort */}
            <div className="nf-filter-group">
              <select
                className="nf-filter-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="title_asc">Title (A-Z)</option>
                <option value="title_desc">Title (Z-A)</option>
                <option value="date_new">Newest First</option>
                <option value="date_old">Oldest First</option>
                <option value="rating_high">Top Rated</option>
              </select>
            </div>
          </div>
        </div>

        <div className="nf-media-grid">
          {processedShows.map((s) => (
            <MediaCard
              key={s.id}
              item={s}
              type="tv"
              badge={s.badge}
              onClick={() => openModal(s)}
            />
          ))}
        </div>

        {processedShows.length === 0 && (
          <p className="all-media-empty">No TV shows found matching your filters.</p>
        )}
      </div>

      <ContentModal content={modalContent} show={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
}

export default AllTvShows;
