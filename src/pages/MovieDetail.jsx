import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { FaStar, FaClock, FaCalendar, FaPlay, FaHdd, FaChevronRight, FaBookmark, FaRegBookmark } from 'react-icons/fa';
import { getMovieDetails, getImageUrl } from '../services/tmdb';
import { searchLocalMovies, getLocalMovieStreamUrl } from '../services/media';
import { useUser } from '../contexts/UserContext';
import NetflixPlayer from '../components/NetflixPlayer';
import DownloadButton from '../components/DownloadButton';
import './MovieDetail.css';

function MovieDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const autoplay = searchParams.get('autoplay') === '1';
  const resumeTime = parseFloat(searchParams.get('t')) || 0;
  const { currentUser, updateWatchHistory, addToWatchlist, removeFromWatchlist } = useUser();
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPlayer, setShowPlayer] = useState(false);
  const [localFile, setLocalFile] = useState(null);
  const [localSearching, setLocalSearching] = useState(false);
  const autoplayTriggered = useRef(false);

  useEffect(() => {
    const fetchMovie = async () => {
      try {
        const res = await getMovieDetails(id);
        setMovie(res.data);
      } catch (err) {
        console.error('Failed to fetch movie:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMovie();
  }, [id]);

  useEffect(() => {
    if (!movie) return;
    const findLocal = async () => {
      setLocalSearching(true);
      try {
        const title = movie.title;
        const res = await searchLocalMovies(title);
        if (res.data.length > 0) {
          setLocalFile(res.data[0]);
        } else {
          const shortTitle = title.split(/[:\-–]/)[0].trim();
          if (shortTitle !== title) {
            const res2 = await searchLocalMovies(shortTitle);
            if (res2.data.length > 0) {
              setLocalFile(res2.data[0]);
            }
          }
        }
      } catch {
        // Media server not running
      } finally {
        setLocalSearching(false);
      }
    };
    findLocal();
  }, [movie]);

  // Auto-play from continue watching
  useEffect(() => {
    if (autoplay && localFile && !autoplayTriggered.current) {
      autoplayTriggered.current = true;
      setShowPlayer(true);
    }
  }, [autoplay, localFile]);

  useEffect(() => {
    if (showPlayer) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showPlayer]);

  const handleProgress = ({ currentTime, duration }) => {
    if (!movie) return;
    const progress = duration > 0 ? currentTime / duration : 0;
    const status = progress > 0.9 ? 'watched' : 'watching';
    updateWatchHistory('movie', String(id), {
      status, progress, currentTime,
      filename: localFile?.filename,
      title: movie.title,
      posterPath: movie.poster_path,
    });
  };

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
      </div>
    );
  }

  if (!movie) {
    return <div className="container section"><p>Movie not found.</p></div>;
  }

  const backdropUrl = getImageUrl(movie.backdrop_path, 'original');
  const posterUrl = getImageUrl(movie.poster_path, 'w500');
  const cast = movie.credits?.cast?.slice(0, 12) || [];
  const director = movie.credits?.crew?.find((c) => c.job === 'Director');
  const localStreamUrl = localFile ? getLocalMovieStreamUrl(localFile.filename) : null;
  const year = movie.release_date ? new Date(movie.release_date).getFullYear() : '';

  return (
    <div className="detail-page">
      <div
        className="detail-backdrop"
        style={{ backgroundImage: backdropUrl ? `url(${backdropUrl})` : 'none' }}
      >
        <div className="detail-backdrop-overlay" />
        <div className="detail-breadcrumbs container">
          <div className="episode-breadcrumbs">
            <Link to="/">Home</Link>
            <FaChevronRight className="breadcrumb-sep" />
            <Link to="/movies">Movies</Link>
            <FaChevronRight className="breadcrumb-sep" />
            <span>{movie.title}</span>
          </div>
        </div>
        <div className="detail-play-container">
          <button className="play-button" onClick={() => setShowPlayer(true)}>
            <FaPlay />
          </button>
          <p className="play-label">{localFile ? 'Watch Now' : 'Stream Online'}</p>
        </div>
      </div>

      {showPlayer && (
        localFile && localStreamUrl ? (
          <NetflixPlayer
            src={localStreamUrl}
            title={movie.title}
            onClose={() => setShowPlayer(false)}
            onProgress={handleProgress}
            startTime={resumeTime || undefined}
          />
        ) : (
          <div className="stream-overlay">
            <button className="stream-close" onClick={() => setShowPlayer(false)}>&times;</button>
            <iframe
              src={`https://mapple.mov/watch/movie/${id}`}
              className="stream-iframe"
              allowFullScreen
              allow="autoplay; encrypted-media"
            />
          </div>
        )
      )}

      <div className="detail-content">
        <div className="container">
          <div className="detail-grid">
            <div className="detail-poster">
              {posterUrl ? (
                <img src={posterUrl} alt={movie.title} />
              ) : (
                <div className="detail-no-poster">No Poster</div>
              )}
            </div>
            <div className="detail-info">
              <div className="detail-title-row">
                <h1 className="detail-title">{movie.title}</h1>
                {!localFile && !localSearching && (
                  <DownloadButton
                    type="movie"
                    tmdbId={id}
                    title={movie.title}
                    year={year}
                    onComplete={() => {
                      searchLocalMovies(movie.title).then((res) => {
                        if (res.data.length > 0) setLocalFile(res.data[0]);
                      }).catch(() => {});
                    }}
                  />
                )}
              </div>
              {movie.tagline && <p className="detail-tagline">{movie.tagline}</p>}
              <div className="detail-meta">
                <span className="detail-rating">
                  <FaStar /> {movie.vote_average?.toFixed(1)}
                </span>
                {movie.runtime > 0 && (
                  <span className="detail-runtime">
                    <FaClock /> {Math.floor(movie.runtime / 60)}h {movie.runtime % 60}m
                  </span>
                )}
                <span className="detail-date">
                  <FaCalendar /> {movie.release_date}
                </span>
              </div>
              {localFile ? (
                <div className="local-badge">
                  <FaHdd /> Available on your drive
                </div>
              ) : !localSearching && (
                <div className="download-badge">
                  Not on your drive — download to watch
                </div>
              )}
              {(() => {
                const inWatchlist = currentUser?.watchlist?.movies?.[id];
                return (
                  <button
                    className={`watchlist-btn${inWatchlist ? ' active' : ''}`}
                    onClick={() => inWatchlist
                      ? removeFromWatchlist('movie', id)
                      : addToWatchlist('movie', id, movie.title, movie.poster_path)
                    }
                  >
                    {inWatchlist ? <FaBookmark /> : <FaRegBookmark />}
                    {inWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
                  </button>
                );
              })()}
              <div className="detail-genres">
                {movie.genres?.map((g) => (
                  <span key={g.id} className="genre-tag">{g.name}</span>
                ))}
              </div>
              {movie.overview && (
                <div className="detail-overview">
                  <h3>Overview</h3>
                  <p>{movie.overview}</p>
                </div>
              )}
              {director && (
                <div className="detail-director">
                  <strong>Director:</strong> {director.name}
                </div>
              )}
            </div>
          </div>

          {cast.length > 0 && (
            <div className="detail-cast section">
              <h2 className="section-title">Cast</h2>
              <div className="cast-grid">
                {cast.map((person) => (
                  <div key={person.id} className="cast-card">
                    <div className="cast-image">
                      {person.profile_path ? (
                        <img
                          src={getImageUrl(person.profile_path, 'w185')}
                          alt={person.name}
                          loading="lazy"
                        />
                      ) : (
                        <div className="cast-no-image">No Photo</div>
                      )}
                    </div>
                    <div className="cast-info">
                      <p className="cast-name">{person.name}</p>
                      <p className="cast-character">{person.character}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MovieDetail;
