import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FaStar, FaClock, FaCalendar, FaHdd, FaBell, FaChevronRight, FaBookmark, FaRegBookmark } from 'react-icons/fa';
import { getTvShowDetails, getTvSeasonDetails, getImageUrl } from '../services/tmdb';
import { searchLocalTvShows, getLocalTvSeasons, getLocalTvEpisodes } from '../services/media';
import { useUser } from '../contexts/UserContext';
import './TvShowDetail.css';

function TvShowDetail() {
  const { id } = useParams();
  const { currentUser, addToWatchlist, removeFromWatchlist } = useUser();
  const [show, setShow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [localShow, setLocalShow] = useState(null);
  const [localEpisodeCount, setLocalEpisodeCount] = useState(0);
  const [newEpisodes, setNewEpisodes] = useState(0);
  const [upcomingEpisodes, setUpcomingEpisodes] = useState(0);
  const [nextAirDate, setNextAirDate] = useState(null);

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

  // Search for local copy and count episodes vs aired TMDB episodes
  useEffect(() => {
    if (!show) return;
    const findLocal = async () => {
      try {
        const res = await searchLocalTvShows(show.name);
        if (res.data.length === 0) return;
        setLocalShow(res.data[0]);

        // Gather episodes from ALL matching folders (e.g. "Danny Phantom" + "Danny Phantom (2004)")
        // Use season+episode from FILENAME (not folder) since files can be in mismatched folders
        const localEpKeys = new Set();
        const localSeasonNums = new Set();
        let totalLocal = 0;
        for (const match of res.data) {
          const seasonsRes = await getLocalTvSeasons(match.name);
          for (const season of seasonsRes.data) {
            const epsRes = await getLocalTvEpisodes(match.name, season.name);
            totalLocal += epsRes.data.length;
            for (const ep of epsRes.data) {
              // Extract season and episode from filename like "s01.e03" or "S01E03"
              const sm = ep.filename.match(/[Ss](\d+)/);
              const em = ep.filename.match(/[Ee](\d+)/);
              if (sm && em) {
                const sNum = parseInt(sm[1]);
                const eNum = parseInt(em[1]);
                localSeasonNums.add(sNum);
                localEpKeys.add(`${sNum}-${eNum}`);
              }
            }
          }
        }
        setLocalEpisodeCount(totalLocal);

        // Only check seasons the user actually has on their drive for missing episodes
        // Check all seasons for upcoming episodes
        const today = new Date().toISOString().split('T')[0];
        let airedNotLocal = 0;
        let upcomingCount = 0;
        let nextUpcomingDate = null;

        const tmdbSeasons = (show.seasons || []).filter((s) => s.season_number > 0);
        for (const s of tmdbSeasons) {
          try {
            const seasonRes = await getTvSeasonDetails(id, s.season_number);
            const episodes = seasonRes.data.episodes || [];
            for (const ep of episodes) {
              const key = `${s.season_number}-${ep.episode_number}`;
              // Only count as "new" if it's from a season the user has locally
              if (localSeasonNums.has(s.season_number) && ep.air_date && ep.air_date <= today && !localEpKeys.has(key)) {
                airedNotLocal++;
              }
              if (ep.air_date && ep.air_date > today) {
                upcomingCount++;
                if (!nextUpcomingDate || ep.air_date < nextUpcomingDate) {
                  nextUpcomingDate = ep.air_date;
                }
              }
            }
          } catch { /* skip season */ }
        }

        if (airedNotLocal > 0) setNewEpisodes(airedNotLocal);
        setUpcomingEpisodes(upcomingCount);
        setNextAirDate(nextUpcomingDate);
      } catch {
        // Media server not running
      }
    };
    findLocal();
  }, [show, id]);

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
        <div className="detail-breadcrumbs container">
          <div className="episode-breadcrumbs">
            <Link to="/">Home</Link>
            <FaChevronRight className="breadcrumb-sep" />
            <Link to="/tv-shows">TV Shows</Link>
            <FaChevronRight className="breadcrumb-sep" />
            <span>{show.name}</span>
          </div>
        </div>
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
              {localShow ? (
                <div className="local-badge">
                  <FaHdd /> On your drive ({localEpisodeCount} episodes)
                </div>
              ) : (
                <div className="download-badge">
                  Not on your drive
                </div>
              )}
              {newEpisodes > 0 && (
                <div className="new-episodes-banner">
                  <FaBell /> {newEpisodes} new episode{newEpisodes !== 1 ? 's' : ''} available to download
                </div>
              )}
              {upcomingEpisodes > 0 && nextAirDate && (
                <div className="upcoming-episodes-banner">
                  <FaCalendar /> {upcomingEpisodes} upcoming episode{upcomingEpisodes !== 1 ? 's' : ''} — next airs {nextAirDate}
                </div>
              )}
              {(() => {
                const inWatchlist = currentUser?.watchlist?.shows?.[id];
                return (
                  <button
                    className={`watchlist-btn${inWatchlist ? ' active' : ''}`}
                    onClick={() => inWatchlist
                      ? removeFromWatchlist('show', id)
                      : addToWatchlist('show', id, show.name, show.poster_path)
                    }
                  >
                    {inWatchlist ? <FaBookmark /> : <FaRegBookmark />}
                    {inWatchlist ? 'In Watchlist' : 'Add to Watchlist'}
                  </button>
                );
              })()}
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
