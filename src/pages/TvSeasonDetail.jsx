import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FaStar, FaArrowLeft, FaPlay, FaHdd, FaCalendar, FaChevronRight, FaCheckCircle } from 'react-icons/fa';
import { getTvSeasonDetails, getTvShowDetails, getImageUrl } from '../services/tmdb';
import { searchLocalTvShows, getLocalTvSeasons, getLocalTvEpisodes } from '../services/media';
import { useUser } from '../contexts/UserContext';
import './TvSeasonDetail.css';

function TvSeasonDetail() {
  const { id, seasonNumber } = useParams();
  const { currentUser } = useUser();
  const watchHistory = currentUser?.watchHistory?.episodes || {};
  const [season, setSeason] = useState(null);
  const [show, setShow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [localEpisodes, setLocalEpisodes] = useState(new Set());
  const [localShowName, setLocalShowName] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [seasonRes, showRes] = await Promise.all([
          getTvSeasonDetails(id, seasonNumber),
          getTvShowDetails(id),
        ]);
        setSeason(seasonRes.data);
        setShow(showRes.data);
      } catch (err) {
        console.error('Failed to fetch season:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, seasonNumber]);

  // Check which episodes are on the local drive
  useEffect(() => {
    if (!show) return;
    const checkLocal = async () => {
      try {
        const res = await searchLocalTvShows(show.name);
        if (res.data.length === 0) return;
        setLocalShowName(res.data[0].name);
        // Search ALL matching folders for episodes from this season (by filename)
        const epNums = new Set();
        for (const match of res.data) {
          const seasonsRes = await getLocalTvSeasons(match.name);
          for (const folder of seasonsRes.data) {
            const epsRes = await getLocalTvEpisodes(match.name, folder.name);
            for (const ep of epsRes.data) {
              const sm = ep.filename.match(/[Ss](\d+)/);
              const em = ep.filename.match(/[Ee](\d+)/);
              if (sm && em && parseInt(sm[1]) === parseInt(seasonNumber)) {
                epNums.add(parseInt(em[1]));
              }
            }
          }
        }
        setLocalEpisodes(epNums);
      } catch {
        // Media server not running
      }
    };
    checkLocal();
  }, [show, seasonNumber]);

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

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="season-detail-page">
      <div className="container">
        <div className="season-header">
          <div className="episode-breadcrumbs">
            <Link to={`/tv/${id}`}>{show?.name || 'Show'}</Link>
            <FaChevronRight className="breadcrumb-sep" />
            <span>Season {seasonNumber}</span>
          </div>
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
            {season.episodes?.map((ep) => {
              const isLocal = localEpisodes.has(ep.episode_number);
              const isAired = ep.air_date && ep.air_date <= today;
              const epKey = `${id}-s${seasonNumber}e${ep.episode_number}`;
              const epWatched = isLocal && watchHistory[epKey]?.progress >= 0.95;

              return (
                <div key={ep.id} className="episode-card">
                  <Link
                    to={`/tv/${id}/season/${seasonNumber}/episode/${ep.episode_number}`}
                    className="episode-card-link"
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
                      {epWatched && (
                        <div className="episode-overlay-watched">
                          <FaCheckCircle /> Watched
                        </div>
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
                  <div className="episode-action">
                    {isLocal ? (
                      <Link
                        to={`/tv/${id}/season/${seasonNumber}/episode/${ep.episode_number}`}
                        className="episode-play-btn"
                      >
                        <FaPlay /> Play
                      </Link>
                    ) : isAired ? (
                      <Link
                        to={`/tv/${id}/season/${seasonNumber}/episode/${ep.episode_number}`}
                        className="episode-play-btn stream"
                      >
                        <FaPlay /> Stream
                      </Link>
                    ) : (
                      <span className="episode-upcoming">
                        <FaCalendar /> Airs {ep.air_date}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TvSeasonDetail;
