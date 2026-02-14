import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FaStar, FaCalendar, FaArrowLeft } from 'react-icons/fa';
import { getTvEpisodeDetails, getImageUrl } from '../services/tmdb';
import './TvEpisodeDetail.css';

function TvEpisodeDetail() {
  const { id, seasonNumber, episodeNumber } = useParams();
  const [episode, setEpisode] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEpisode = async () => {
      try {
        const res = await getTvEpisodeDetails(id, seasonNumber, episodeNumber);
        setEpisode(res.data);
      } catch (err) {
        console.error('Failed to fetch episode:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchEpisode();
  }, [id, seasonNumber, episodeNumber]);

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
      </div>
    );
  }

  if (!episode) {
    return <div className="container section"><p>Episode not found.</p></div>;
  }

  const stillUrl = getImageUrl(episode.still_path, 'original');

  return (
    <div className="episode-detail-page">
      <div className="container">
        <Link to={`/tv/${id}/season/${seasonNumber}`} className="back-link">
          <FaArrowLeft /> Back to Season {seasonNumber}
        </Link>

        {stillUrl && (
          <div className="episode-detail-banner">
            <img src={stillUrl} alt={episode.name} />
          </div>
        )}

        <div className="episode-detail-content">
          <div className="episode-detail-header">
            <span className="episode-detail-badge">
              Season {seasonNumber} &middot; Episode {episodeNumber}
            </span>
            <h1>{episode.name}</h1>
            <div className="episode-detail-meta">
              {episode.vote_average > 0 && (
                <span className="detail-rating">
                  <FaStar /> {episode.vote_average.toFixed(1)}
                </span>
              )}
              {episode.air_date && (
                <span>
                  <FaCalendar /> {episode.air_date}
                </span>
              )}
              {episode.runtime > 0 && (
                <span>{episode.runtime} min</span>
              )}
            </div>
          </div>

          {episode.overview && (
            <div className="episode-detail-overview">
              <h3>Overview</h3>
              <p>{episode.overview}</p>
            </div>
          )}

          {episode.guest_stars?.length > 0 && (
            <div className="section">
              <h2 className="section-title">Guest Stars</h2>
              <div className="cast-grid">
                {episode.guest_stars.slice(0, 12).map((person) => (
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

export default TvEpisodeDetail;
