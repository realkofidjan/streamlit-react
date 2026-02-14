import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FaStar, FaArrowLeft } from 'react-icons/fa';
import { getTvSeasonDetails, getImageUrl } from '../services/tmdb';
import './TvSeasonDetail.css';

function TvSeasonDetail() {
  const { id, seasonNumber } = useParams();
  const [season, setSeason] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSeason = async () => {
      try {
        const res = await getTvSeasonDetails(id, seasonNumber);
        setSeason(res.data);
      } catch (err) {
        console.error('Failed to fetch season:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSeason();
  }, [id, seasonNumber]);

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
      </div>
    );
  }

  if (!season) {
    return <div className="container section"><p>Season not found.</p></div>;
  }

  return (
    <div className="season-detail-page">
      <div className="container">
        <div className="season-header">
          <Link to={`/tv/${id}`} className="back-link">
            <FaArrowLeft /> Back to Show
          </Link>
          <div className="season-header-content">
            {season.poster_path && (
              <img
                src={getImageUrl(season.poster_path, 'w342')}
                alt={season.name}
                className="season-detail-poster"
              />
            )}
            <div>
              <h1>{season.name}</h1>
              {season.air_date && <p className="season-air-date">Air date: {season.air_date}</p>}
              {season.overview && <p className="season-overview">{season.overview}</p>}
            </div>
          </div>
        </div>

        <div className="episodes-section section">
          <h2 className="section-title">Episodes ({season.episodes?.length || 0})</h2>
          <div className="episodes-list">
            {season.episodes?.map((ep) => (
              <Link
                key={ep.id}
                to={`/tv/${id}/season/${seasonNumber}/episode/${ep.episode_number}`}
                className="episode-card"
              >
                <div className="episode-still">
                  {ep.still_path ? (
                    <img
                      src={getImageUrl(ep.still_path, 'w300')}
                      alt={ep.name}
                      loading="lazy"
                    />
                  ) : (
                    <div className="episode-no-still">Ep {ep.episode_number}</div>
                  )}
                </div>
                <div className="episode-info">
                  <h4>
                    <span className="episode-number">E{ep.episode_number}</span>
                    {ep.name}
                  </h4>
                  {ep.vote_average > 0 && (
                    <span className="episode-rating">
                      <FaStar /> {ep.vote_average.toFixed(1)}
                    </span>
                  )}
                  {ep.overview && <p className="episode-overview">{ep.overview}</p>}
                  {ep.air_date && <span className="episode-date">{ep.air_date}</span>}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TvSeasonDetail;
