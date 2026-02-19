import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FaPlay, FaPlus, FaCheck, FaThumbsUp, FaRegThumbsUp, FaArrowLeft, FaChevronDown, FaHdd, FaCalendar } from 'react-icons/fa';
import { getTvShowDetails, getTvSeasonDetails, getSimilarTvShows, getImageUrl } from '../services/tmdb';
import { searchLocalTvShows, getLocalTvSeasons, getLocalTvEpisodes } from '../services/media';
import { useUser } from '../contexts/UserContext';
import MediaCard from '../components/MediaCard';
import './TvShowDetail.css';

function TvShowDetail() {
  const { id } = useParams();
  const { currentUser, addToWatchlist, removeFromWatchlist } = useUser();
  const [show, setShow] = useState(null);
  const [selectedSeasonNumber, setSelectedSeasonNumber] = useState(1);
  const [seasonEpisodes, setSeasonEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Local Media State
  const [localEpKeys, setLocalEpKeys] = useState(new Set()); // "s1-e1"
  const [localEpisodeCount, setLocalEpisodeCount] = useState(0);
  const [isLocalShow, setIsLocalShow] = useState(false);
  const [recommendations, setRecommendations] = useState([]);

  // Fetch Recommendations independently
  useEffect(() => {
    if (id) {
      getSimilarTvShows(id)
        .then(res => setRecommendations(res.data.results || []))
        .catch(() => { });
    }
  }, [id]);

  // Initial Fetch
  useEffect(() => {
    const fetchShow = async () => {
      setLoading(true);
      try {
        const res = await getTvShowDetails(id);
        setShow(res.data);
        // Default to first season (usually 1, but could be 0 for specials or strict numbering)
        if (res.data.seasons && res.data.seasons.length > 0) {
          // Find first real season (season > 0 usually preferred)
          const firstSeason = res.data.seasons.find(s => s.season_number > 0) || res.data.seasons[0];
          setSelectedSeasonNumber(firstSeason.season_number);
        }
      } catch (err) {
        console.error('Failed to fetch show:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchShow();
  }, [id]);

  // Fetch Season Episodes when selection changes
  useEffect(() => {
    if (!show) return;
    const fetchSeason = async () => {
      try {
        const res = await getTvSeasonDetails(id, selectedSeasonNumber);
        setSeasonEpisodes(res.data.episodes || []);
      } catch (err) {
        console.error('Failed to fetch season:', err);
      }
    };
    fetchSeason();
  }, [id, selectedSeasonNumber, show]);

  // Check Local Files (preserving logic to scan all folders)
  useEffect(() => {
    if (!show) return;
    const findLocal = async () => {
      try {
        const res = await searchLocalTvShows(show.name);
        if (res.data.length === 0) return;

        setIsLocalShow(true);
        const keys = new Set();
        let count = 0;

        for (const match of res.data) {
          const seasonsRes = await getLocalTvSeasons(match.name);
          for (const season of seasonsRes.data) {
            const epsRes = await getLocalTvEpisodes(match.name, season.name);
            count += epsRes.data.length;
            for (const ep of epsRes.data) {
              const sm = ep.filename.match(/[Ss](\d+)/);
              const em = ep.filename.match(/[Ee](\d+)/);
              if (sm && em) {
                const s = parseInt(sm[1]);
                const e = parseInt(em[1]);
                keys.add(`${s}-${e}`);
              }
            }
          }
        }
        setLocalEpKeys(keys);
        setLocalEpisodeCount(count);
      } catch {
        // Media server down or not found
      }
    };
    findLocal();
  }, [show]);

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
  if (!show) return <div className="no-results">Show not found.</div>;

  const backdropUrl = getImageUrl(show.backdrop_path, 'original');
  const releaseYear = show.first_air_date ? new Date(show.first_air_date).getFullYear() : '';
  const inWatchlist = currentUser?.watchlist?.shows?.[id];
  const genres = show.genres?.map(g => g.name).join(', ');
  const cast = show.credits?.cast?.slice(0, 5).map(c => c.name).join(', ');

  // Filter seasons (exclude specials if desired, but Netflix usually shows them)
  const seasons = show.seasons || [];

  return (
    <div className="detail-page">
      {/* Hero */}
      <div className="detail-hero" style={{ backgroundImage: `url(${backdropUrl})` }}>
        <div className="detail-overlay" />
        <div className="detail-overlay-left" />

        <div className="detail-content-wrapper">
          <div className="detail-header">
            <h1 className="detail-title">{show.name}</h1>

            <div className="detail-meta-row">
              <span className="match-score">96% Match</span>
              <span className="year-tag">{releaseYear}</span>
              <span className="maturity-rating">TV-14</span>
              <span className="season-count">{show.number_of_seasons} Season{show.number_of_seasons !== 1 ? 's' : ''}</span>
              <span className="hd-badge">HD</span>
            </div>

            <div className="detail-overview">
              {show.overview}
            </div>

            <div className="detail-actions">
              {/* Play button logic: If local content exists, link to first available? Or just stream S1E1? 
                   For now, let's link to the first episode of the selected season.
               */}
              <Link
                to={`/tv/${id}/season/${selectedSeasonNumber}/episode/1`}
                className="btn-play"
              >
                <FaPlay /> Play
              </Link>

              <button
                className="btn-secondary-action"
                onClick={() => inWatchlist
                  ? removeFromWatchlist('show', id)
                  : addToWatchlist('show', id, show.name, show.poster_path)
                }
              >
                {inWatchlist ? <FaCheck /> : <FaPlus />}
                {inWatchlist ? 'My List' : 'My List'}
              </button>

              <button className="btn-secondary-action icon-only" title="Rate">
                <FaRegThumbsUp />
              </button>
            </div>

            <div className="detail-info-grid">
              <div className="detail-right-col">
                {/* Reuse meta layout if needed, but overview is already above */}
                <div className="detail-item-row">
                  <span className="detail-item-label">Genres:</span>
                  <span className="detail-item-value">{genres}</span>
                </div>
                <div className="detail-item-row">
                  <span className="detail-item-label">Cast:</span>
                  <span className="detail-item-value">{cast}</span>
                </div>
              </div>
            </div>

            {isLocalShow && (
              <div className="local-badge" style={{ marginTop: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: '#46d369' }}>
                <FaHdd /> {localEpisodeCount} Episodes on Drive
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Episodes List */}
      <div className="episodes-section">
        <div className="episodes-header">
          <h2 className="episodes-title">Episodes</h2>
          <div className="season-select-wrapper">
            <select
              className="season-select"
              value={selectedSeasonNumber}
              onChange={(e) => setSelectedSeasonNumber(parseInt(e.target.value))}
            >
              {seasons.map(s => (
                <option key={s.id} value={s.season_number}>
                  {s.name} ({s.episode_count} Episodes)
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="episodes-list">
          {seasonEpisodes.map((ep, idx) => {
            const key = `${selectedSeasonNumber}-${ep.episode_number}`;
            const isLocal = localEpKeys.has(key);
            const isAvailable = isLocal || (ep.air_date && new Date(ep.air_date) <= new Date());

            return (
              <Link
                to={`/tv/${id}/season/${selectedSeasonNumber}/episode/${ep.episode_number}`}
                key={ep.id}
                className="episode-item"
              >
                <div className="episode-index">{idx + 1}</div>
                <div className="episode-thumbnail">
                  {ep.still_path ? (
                    <img src={getImageUrl(ep.still_path, 'w300')} alt={ep.name} />
                  ) : (
                    <div className="episode-no-still">No Image</div>
                  )}
                  <div className="episode-play-icon">
                    <FaPlay />
                  </div>
                </div>
                <div className="episode-meta">
                  <div className="episode-header-row">
                    <h3 className="episode-title">{ep.name}</h3>
                    <span className="episode-duration">{ep.runtime ? `${ep.runtime}m` : ''}</span>
                  </div>
                  <p className="episode-overview">{ep.overview}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recommendations */}
      {
        recommendations.length > 0 && (
          <div className="episodes-section" style={{ marginBottom: '2rem' }}>
            <h2 className="episodes-title" style={{ marginBottom: '1rem' }}>More Like This</h2>
            <div className="nf-grid-library">
              {recommendations.slice(0, 12).map(s => (
                <MediaCard key={s.id} item={s} type="tv" />
              ))}
            </div>
          </div>
        )
      }
    </div >
  );
}

export default TvShowDetail;
