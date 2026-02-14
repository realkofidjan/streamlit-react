import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FaStar, FaClock, FaCalendar } from 'react-icons/fa';
import { getTvShowDetails, getImageUrl } from '../services/tmdb';
import './TvShowDetail.css';

function TvShowDetail() {
  const { id } = useParams();
  const [show, setShow] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchShow = async () => {
      try {
        const res = await getTvShowDetails(id);
        setShow(res.data);
      } catch (err) {
        console.error('Failed to fetch TV show:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchShow();
  }, [id]);

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
      </div>
    );
  }

  if (!show) {
    return <div className="container section"><p>TV show not found.</p></div>;
  }

  const backdropUrl = getImageUrl(show.backdrop_path, 'original');
  const posterUrl = getImageUrl(show.poster_path, 'w500');
  const cast = show.credits?.cast?.slice(0, 12) || [];
  const creator = show.created_by?.[0];

  return (
    <div className="detail-page">
      <div
        className="detail-backdrop"
        style={{ backgroundImage: backdropUrl ? `url(${backdropUrl})` : 'none' }}
      >
        <div className="detail-backdrop-overlay" />
      </div>

      <div className="detail-content">
        <div className="container">
          <div className="detail-grid">
            <div className="detail-poster">
              {posterUrl ? (
                <img src={posterUrl} alt={show.name} />
              ) : (
                <div className="detail-no-poster">No Poster</div>
              )}
            </div>
            <div className="detail-info">
              <h1 className="detail-title">{show.name}</h1>
              {show.tagline && <p className="detail-tagline">{show.tagline}</p>}
              <div className="detail-meta">
                <span className="detail-rating">
                  <FaStar /> {show.vote_average?.toFixed(1)}
                </span>
                <span>
                  <FaClock /> {show.number_of_seasons} Season{show.number_of_seasons !== 1 ? 's' : ''}
                </span>
                <span>
                  <FaCalendar /> {show.first_air_date}
                </span>
                <span className={`status-badge ${show.status === 'Returning Series' ? 'active' : ''}`}>
                  {show.status}
                </span>
              </div>
              <div className="detail-genres">
                {show.genres?.map((g) => (
                  <span key={g.id} className="genre-tag">{g.name}</span>
                ))}
              </div>
              {show.overview && (
                <div className="detail-overview">
                  <h3>Overview</h3>
                  <p>{show.overview}</p>
                </div>
              )}
              {creator && (
                <div className="detail-director">
                  <strong>Created by:</strong> {creator.name}
                </div>
              )}
            </div>
          </div>

          {show.seasons?.length > 0 && (
            <div className="seasons-section section">
              <h2 className="section-title">Seasons</h2>
              <div className="seasons-grid">
                {show.seasons.map((season) => (
                  <Link
                    key={season.id}
                    to={`/tv/${id}/season/${season.season_number}`}
                    className="season-card"
                  >
                    <div className="season-poster">
                      {season.poster_path ? (
                        <img
                          src={getImageUrl(season.poster_path, 'w342')}
                          alt={season.name}
                          loading="lazy"
                        />
                      ) : (
                        <div className="season-no-poster">No Image</div>
                      )}
                    </div>
                    <div className="season-info">
                      <h4>{season.name}</h4>
                      <p>{season.episode_count} Episodes</p>
                      {season.air_date && (
                        <p className="season-date">{season.air_date}</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

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

export default TvShowDetail;
