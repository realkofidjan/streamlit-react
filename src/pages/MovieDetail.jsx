import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FaPlay, FaPlus, FaCheck, FaThumbsUp, FaRegThumbsUp, FaVolumeMute, FaVolumeUp, FaArrowLeft, FaDownload, FaCheckCircle } from 'react-icons/fa';
import { getMovieDetails, getSimilarMovies, getImageUrl } from '../services/tmdb';
import { searchLocalMovies } from '../services/media';
import { useUser } from '../contexts/UserContext';
import MediaCard from '../components/MediaCard';
import './MovieDetail.css';

function MovieDetail() {
  const { id } = useParams();
  const { currentUser, addToWatchlist, removeFromWatchlist } = useUser();
  const [movie, setMovie] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [localMovie, setLocalMovie] = useState(null);
  const [streamUrl, setStreamUrl] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      window.scrollTo(0, 0);
      try {
        const [movieRes, recRes] = await Promise.all([
          getMovieDetails(id),
          getSimilarMovies(id).catch(() => ({ data: { results: [] } })),
        ]);
        setMovie(movieRes.data);
        setRecommendations(recRes.data.results || []);
      } catch (err) {
        console.error('Failed to fetch movie data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  // Check for local file
  useEffect(() => {
    if (!movie) return;
    const checkLocal = async () => {
      try {
        const res = await searchLocalMovies(movie.title);
        // Simple match: first result
        if (res.data.length > 0) {
          setLocalMovie(res.data[0]);
        } else {
          setLocalMovie(null);
        }
      } catch {
        setLocalMovie(null);
      }
    };
    checkLocal();
  }, [movie]);

  if (loading) {
    return <div className="loading-spinner"><div className="spinner" /></div>;
  }

  if (!movie) {
    return <div className="no-results">Movie not found.</div>;
  }

  const backdropUrl = getImageUrl(movie.backdrop_path, 'original');
  const releaseYear = movie.release_date ? new Date(movie.release_date).getFullYear() : '';
  const duration = movie.runtime ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m` : '';
  const inWatchlist = currentUser?.watchlist?.movies?.[id];
  const director = movie.credits?.crew?.find(c => c.job === 'Director')?.name;
  const cast = movie.credits?.cast?.slice(0, 5).map(c => c.name).join(', ');
  const genres = movie.genres?.map(g => g.name).join(', ');

  const handlePlay = () => {
    // If local, play local (VideoPlayer route). If not, try stream (iframe).
    // For this demo, let's assume standard playback route for local.
    // Stream URL is just a placeholder example or handled differently.
    if (localMovie) {
      // Navigate to player (handled by Link usually, but here via button)
      // We'll wrap button in Link or use useNavigate
    } else {
      // Open stream overlay
      setStreamUrl(`https://vidsrc.xyz/embed/movie/${id}`);
    }
  };

  return (
    <div className="detail-page">
      {/* Hero Section */}
      <div className="detail-hero" style={{ backgroundImage: `url(${backdropUrl})` }}>
        <div className="detail-overlay" />
        <div className="detail-overlay-left" />

        <div className="detail-content-wrapper">
          <div className="detail-header">
            {/* Logo or Title Text */}
            <h1 className="detail-title">{movie.title}</h1>

            <div className="detail-meta-row">
              <span className="match-score">98% Match</span>
              <span className="year-tag">{releaseYear}</span>
              <span className="maturity-rating">TV-MA</span>
              <span className="duration-tag">{duration}</span>
              <span className="hd-badge">HD</span>
            </div>

            <div className="detail-actions">
              {localMovie ? (
                <Link to={`/movie/${id}?autoplay=1`} className="btn-play">
                  <FaPlay /> Play
                </Link>
              ) : (
                <button onClick={handlePlay} className="btn-play">
                  <FaPlay /> Stream
                </button>
              )}

              <button
                className="btn-secondary-action"
                onClick={() => inWatchlist
                  ? removeFromWatchlist('movie', id)
                  : addToWatchlist('movie', id, movie.title, movie.poster_path)
                }
              >
                {inWatchlist ? <FaCheck /> : <FaPlus />}
                {inWatchlist ? 'My List' : 'My List'}
              </button>

              {/* Like / Rate (Visual only for now) */}
              <button className="btn-secondary-action icon-only" title="Rate">
                <FaRegThumbsUp />
              </button>
            </div>

            <div className="detail-info-grid">
              <div className="detail-left-col">
                <p className="detail-overview">{movie.overview}</p>
              </div>
              <div className="detail-right-col">
                <div className="detail-item-row">
                  <span className="detail-item-label">Cast:</span>
                  <span className="detail-item-value">{cast}</span>
                </div>
                <div className="detail-item-row">
                  <span className="detail-item-label">Genres:</span>
                  <span className="detail-item-value">{genres}</span>
                </div>
                {director && (
                  <div className="detail-item-row">
                    <span className="detail-item-label">This movie is:</span>
                    <span className="detail-item-value">Violent, Dark</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="recommendations-section">
          <h2>More Like This</h2>
          <div className="nf-grid-library">
            {recommendations.slice(0, 12).map(m => (
              <MediaCard key={m.id} item={m} type="movie" badge="cloud" />
            ))}
          </div>
        </div>
      )}

      {/* Stream Overlay */}
      {streamUrl && (
        <div className="stream-overlay">
          <button className="stream-close" onClick={() => setStreamUrl(null)}>×</button>
          <iframe
            src={streamUrl}
            className="stream-iframe"
            allowFullScreen
            title="Stream"
          />
        </div>
      )}
    </div>
  );
}

export default MovieDetail;
