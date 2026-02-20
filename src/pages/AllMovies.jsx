import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import ContentModal from '../components/ContentModal';
import MediaCard from '../components/MediaCard';
import { getLibraryMetadata } from '../services/media';
import { getMovieGenres } from '../services/tmdb';
import { FaFilter, FaSortAmountDown } from 'react-icons/fa';
import './AllMedia.css';

function AllMovies() {
  const { data: metaData, isLoading: metaLoading } = useQuery({
    queryKey: ['libraryMetadata'],
    queryFn: () => getLibraryMetadata().then(res => res.data).catch(() => ({ movies: [], tvShows: [], tvBadges: {} })),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const { data: genresObj = {}, isLoading: genresLoading } = useQuery({
    queryKey: ['movieGenres'],
    queryFn: async () => {
      const genreRes = await getMovieGenres();
      const genreMap = {};
      genreRes.data.genres.forEach(g => genreMap[g.id] = g.name);
      return genreMap;
    },
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
  });

  const loading = metaLoading || genresLoading;
  const movies = metaData?.movies || [];
  const genres = genresObj;


  const [modalContent, setModalContent] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Filters
  const [sortBy, setSortBy] = useState('title_asc');
  const [selectedGenre, setSelectedGenre] = useState('all');

  const openModal = (item) => {
    setModalContent({ ...item, type: 'movie' });
    setShowModal(true);
  };

  const processedMovies = useMemo(() => {
    let result = [...movies];

    // Filter
    if (selectedGenre !== 'all') {
      const genreId = parseInt(selectedGenre);
      result = result.filter(m => m.genre_ids && m.genre_ids.includes(genreId));
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'title_asc':
          return a.title.localeCompare(b.title);
        case 'title_desc':
          return b.title.localeCompare(a.title);
        case 'date_new':
          return new Date(b.release_date || 0) - new Date(a.release_date || 0);
        case 'date_old':
          return new Date(a.release_date || 0) - new Date(b.release_date || 0);
        case 'rating_high':
          return b.vote_average - a.vote_average;
        default:
          return 0;
      }
    });

    return result;
  }, [movies, sortBy, selectedGenre]);

  // Extract available genres from current movies
  const availableGenres = useMemo(() => {
    const ids = new Set();
    movies.forEach(m => {
      if (m.genre_ids) m.genre_ids.forEach(id => ids.add(id));
    });
    return Array.from(ids).map(id => ({ id, name: genres[id] })).filter(g => g.name).sort((a, b) => a.name.localeCompare(b.name));
  }, [movies, genres]);

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
          <h1 className="all-media-title">Movies <span className="all-media-count">{processedMovies.length}</span></h1>

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
          {processedMovies.map((m) => (
            <MediaCard
              key={m.id}
              item={m}
              type="movie"
              badge="local" // Or just pass 'local' string
              onClick={() => openModal(m)}
            />
          ))}
        </div>

        {processedMovies.length === 0 && (
          <p className="all-media-empty">No movies found matching your filters.</p>
        )}
      </div>

      <ContentModal
        key={modalContent ? modalContent.id : 'movies-modal'}
        content={modalContent}
        show={showModal}
        onClose={() => setShowModal(false)}
      />
    </div>
  );
}

export default AllMovies;
