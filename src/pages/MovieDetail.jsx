import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { FaStar, FaClock, FaCalendar, FaPlay, FaTimes, FaHdd, FaExclamationTriangle } from 'react-icons/fa';
import { getMovieDetails, getImageUrl } from '../services/tmdb';
import { searchLocalMovies, getLocalMovieStreamUrl } from '../services/media';
import './MovieDetail.css';

function MovieDetail() {
  const { id } = useParams();
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPlayer, setShowPlayer] = useState(false);
  const [localFile, setLocalFile] = useState(null);
  const [localSearching, setLocalSearching] = useState(false);
  const [adWarningDismissed, setAdWarningDismissed] = useState(false);

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

  useEffect(() => {
    if (showPlayer) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showPlayer]);

  const handlePlayClick = () => {
    if (localFile) {
      setShowPlayer(true);
    } else {
      setAdWarningDismissed(false);
      setShowPlayer(true);
    }
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
  const vidfastUrl = `https://vidfast.pro/movie/${id}`;

  return (
    <div className="detail-page">
      <div
        className="detail-backdrop"
        style={{ backgroundImage: backdropUrl ? `url(${backdropUrl})` : 'none' }}
      >
        <div className="detail-backdrop-overlay" />
        <div className="detail-play-container">
          <button className="play-button" onClick={handlePlayClick}>
            <FaPlay />
          </button>
          <p className="play-label">Watch Now</p>
        </div>
      </div>

      {showPlayer && (
        <div className="video-player-overlay" onClick={() => setShowPlayer(false)}>
          <div className="video-player-wrapper" onClick={(e) => e.stopPropagation()}>
            <button className="player-close-btn" onClick={() => setShowPlayer(false)}>
              <FaTimes />
            </button>

            {localFile && localStreamUrl ? (
              <video
                key="local"
                src={localStreamUrl}
                className="local-video-player"
                controls
                autoPlay
              />
            ) : !adWarningDismissed ? (
              <div className="ad-warning">
                <FaExclamationTriangle className="ad-warning-icon" />
                <h3>Heads Up</h3>
                <p>
                  This movie is not available on your local drive.
                  The online player may contain <strong>pop-up ads</strong> and redirects.
                </p>
                <p className="ad-warning-tip">
                  Use a browser ad-blocker for the best experience.
                </p>
                <div className="ad-warning-actions">
                  <button
                    className="ad-warning-btn proceed"
                    onClick={() => setAdWarningDismissed(true)}
                  >
                    Continue Anyway
                  </button>
                  <button
                    className="ad-warning-btn cancel"
                    onClick={() => setShowPlayer(false)}
                  >
                    Go Back
                  </button>
                </div>
              </div>
            ) : (
              <iframe
                src={vidfastUrl}
                width="100%"
                height="100%"
                frameBorder="0"
                allowFullScreen
                referrerPolicy="no-referrer"
                allow="autoplay; encrypted-media; picture-in-picture"
                title={movie.title}
                className="vidfast-iframe"
              />
            )}
          </div>
        </div>
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
              <h1 className="detail-title">{movie.title}</h1>
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
                <div className="online-badge">
                  <FaExclamationTriangle /> Online only — may contain ads
                </div>
              )}
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
