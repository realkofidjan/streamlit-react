import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import ContentModal from '../components/ContentModal';
import MediaCard from '../components/MediaCard';
import { useUser } from '../contexts/UserContext';
import { getLibraryMetadata } from '../services/media';
import { getTvGenres } from '../services/tmdb';
import './AllMedia.css';

function AllTvShows() {
  const { currentUser } = useUser();

  const { data: metaData, isLoading: metaLoading } = useQuery({
    queryKey: ['libraryMetadata'],
    queryFn: () => getLibraryMetadata().then(res => res.data).catch(() => ({ movies: [], tvShows: [], tvBadges: {} })),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const { data: genresObj = {}, isLoading: genresLoading } = useQuery({
    queryKey: ['tvGenres'],
    queryFn: async () => {
      const genreRes = await getTvGenres();
      const genreMap = {};
      genreRes.data.genres.forEach(g => genreMap[g.id] = g.name);
      return genreMap;
    },
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
  });

  const loading = metaLoading || genresLoading;

  // Attach badges and watched status to shows
  const shows = useMemo(() => {
    if (!metaData?.tvShows) return [];
    return metaData.tvShows.map(show => {
      let isFullyWatched = false;
      // Note: Full fully-watched checking requires `number_of_episodes` from details, 
      // but without details here we might skip this badge or approximate it. 
      // The old logic fetched details. For now, we omit the fully-watched check 
      // to rely purely on the fast metadata endpoint, or attach the badge from backend.
      return {
        ...show,
        badge: metaData.tvBadges?.[show.id] || 'local',
        isFullyWatched
      };
    });
  }, [metaData, currentUser]);

  const genres = genresObj;


  const [modalContent, setModalContent] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Filters
  const [sortBy, setSortBy] = useState('title_asc');
  const [selectedGenre, setSelectedGenre] = useState('all');

  const openModal = (item) => {
    setModalContent({ ...item, type: 'tv' });
    setShowModal(true);
  };

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

      <ContentModal
        key={modalContent ? modalContent.id : 'tv-modal'}
        content={modalContent}
        show={showModal}
        onClose={() => setShowModal(false)}
      />
    </div>
  );
}

export default AllTvShows;
