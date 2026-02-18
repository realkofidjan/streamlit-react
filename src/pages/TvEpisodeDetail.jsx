import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import { FaStar, FaCalendar, FaArrowLeft, FaPlay, FaHdd, FaChevronRight, FaCheckCircle, FaEnvelope } from 'react-icons/fa';
import { getTvEpisodeDetails, getTvShowDetails, getTvSeasonDetails, getImageUrl } from '../services/tmdb';
import { searchLocalTvShows, getLocalTvSeasons, getLocalTvEpisodes, getLocalTvStreamUrl } from '../services/media';
import { useUser } from '../contexts/UserContext';
import NetflixPlayer from '../components/NetflixPlayer';
import SaveOfflineButton from '../components/SaveOfflineButton';
import { isVideoOffline } from '../services/offlineStorage';
import { searchSubtitles, fetchSubtitleUrl } from '../services/subtitles';
import './TvEpisodeDetail.css';

function TvEpisodeDetail() {
  const { id, seasonNumber, episodeNumber } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const autoplay = searchParams.get('autoplay') === '1';
  const resumeTime = parseFloat(searchParams.get('t')) || 0;
  const { currentUser, updateWatchHistory, sendNotification } = useUser();
  const isFiifi = currentUser?.username?.toLowerCase() === 'fiifi';
  const [requestSent, setRequestSent] = useState(false);
  const [episode, setEpisode] = useState(null);
  const [show, setShow] = useState(null);
  const [seasonData, setSeasonData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPlayer, setShowPlayer] = useState(false);
  const [localStreamUrl, setLocalStreamUrl] = useState(null);
  const [localFilename, setLocalFilename] = useState(null);
  const [localShowName, setLocalShowName] = useState(null);
  const [localSeasonFolder, setLocalSeasonFolder] = useState(null);
  const [localEpisodeSet, setLocalEpisodeSet] = useState(new Set());
  const [nextEpLocal, setNextEpLocal] = useState(false);
  const [subtitleUrl, setSubtitleUrl] = useState(null);

  const autoplayTriggered = useRef(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [epRes, showRes, seasonRes] = await Promise.all([
          getTvEpisodeDetails(id, seasonNumber, episodeNumber),
          getTvShowDetails(id),
          getTvSeasonDetails(id, seasonNumber),
        ]);
        setEpisode(epRes.data);
        setShow(showRes.data);
        setSeasonData(seasonRes.data);
      } catch (err) {
        console.error('Failed to fetch episode:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, seasonNumber, episodeNumber]);

  // Check if episode is on local drive + check next episode
  useEffect(() => {
    if (!show) return;
    const checkLocal = async () => {
      try {
        const res = await searchLocalTvShows(show.name);
        if (res.data.length === 0) return;
        setLocalShowName(res.data[0].name);
        // Search ALL matching folders for episodes by filename season/episode numbers
        const localEpNums = new Set();
        let foundEp = null;
        let foundShowName = null;
        let foundFolder = null;
        for (const match of res.data) {
          const seasonsRes = await getLocalTvSeasons(match.name);
          for (const folder of seasonsRes.data) {
            const epsRes = await getLocalTvEpisodes(match.name, folder.name);
            for (const ep of epsRes.data) {
              const sm = ep.filename.match(/[Ss](\d+)/);
              const em = ep.filename.match(/[Ee](\d+)/);
              if (!sm || !em) continue;
              if (parseInt(sm[1]) === parseInt(seasonNumber)) {
                localEpNums.add(parseInt(em[1]));
                if (parseInt(em[1]) === parseInt(episodeNumber) && !foundEp) {
                  foundEp = ep;
                  foundShowName = match.name;
                  foundFolder = folder.name;
                }
              }
            }
          }
        }
        setLocalEpisodeSet(localEpNums);
        if (foundEp) {
          setLocalSeasonFolder(foundFolder);
          setLocalFilename(foundEp.filename);
          setLocalStreamUrl(getLocalTvStreamUrl(foundShowName, foundFolder, foundEp.filename));
        }
        // Check if next episode is also local
        const nextEpNum = parseInt(episodeNumber) + 1;
        setNextEpLocal(localEpNums.has(nextEpNum));
      } catch {
        // Media server not running
      }
    };
    checkLocal();
  }, [show, seasonNumber, episodeNumber]);

  const hasOfflineDownload = isVideoOffline(`episode-${id}-s${seasonNumber}e${episodeNumber}`);
  const epKey = `${id}-s${seasonNumber}e${episodeNumber}`;
  const watchEntry = currentUser?.watchHistory?.episodes?.[epKey];
  const isWatched = watchEntry?.progress >= 0.96;

  // Auto-fetch subtitles
  useEffect(() => {
    if (!localStreamUrl) return;
    searchSubtitles(id, 'episode', seasonNumber, episodeNumber).then(async (results) => {
      if (results.length > 0) {
        const best = results[0];
        const fileId = best.attributes?.files?.[0]?.file_id;
        if (fileId) {
          const url = await fetchSubtitleUrl(fileId);
          if (url) setSubtitleUrl(url);
        }
      }
    });
  }, [id, seasonNumber, episodeNumber, localStreamUrl]);

  // Auto-play from continue watching
  useEffect(() => {
    if (autoplay && localStreamUrl && !autoplayTriggered.current) {
      autoplayTriggered.current = true;
      setShowPlayer(true);
    }
  }, [autoplay, localStreamUrl]);

  useEffect(() => {
    if (showPlayer) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showPlayer]);

  const handleProgress = ({ currentTime, duration }) => {
    if (!show || !episode) return;
    const progress = duration > 0 ? currentTime / duration : 0;
    const status = progress > 0.9 ? 'watched' : 'watching';
    updateWatchHistory('episode', `${id}-s${seasonNumber}e${episodeNumber}`, {
      status, progress, currentTime,
      filename: localFilename,
      title: `${show.name} S${seasonNumber}E${episodeNumber}`,
      posterPath: show.poster_path,
      showId: id,
      season: seasonNumber,
      episode: episodeNumber,
    });
  };

  const today = new Date().toISOString().split('T')[0];
  const nextEpisode = seasonData?.episodes?.find(
    (ep) => ep.episode_number === parseInt(episodeNumber) + 1
  );
  const nextEpisodeAired = nextEpisode?.air_date && nextEpisode.air_date <= today;

  const playNextEpisode = () => {
    const nextNum = parseInt(episodeNumber) + 1;
    navigate(`/tv/${id}/season/${seasonNumber}/episode/${nextNum}?autoplay=1`);
  };

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
  const isAired = episode.air_date && episode.air_date <= today;

  return (
    <div className="episode-detail-page">
      <div className="container">
        {/* Breadcrumb navigation */}
        <div className="episode-breadcrumbs">
          <Link to={`/tv/${id}`}>{show?.name || 'Show'}</Link>
          <FaChevronRight className="breadcrumb-sep" />
          <Link to={`/tv/${id}/season/${seasonNumber}`}>Season {seasonNumber}</Link>
          <FaChevronRight className="breadcrumb-sep" />
          <span>Episode {episodeNumber}</span>
        </div>

        <div className="episode-detail-banner-wrapper">
          {stillUrl && (
            <div className="episode-detail-banner">
              <img src={stillUrl} alt={episode.name} />
            </div>
          )}
          <div className="episode-detail-play-area">
            {isAired && (
              <button className="play-button" onClick={() => setShowPlayer(true)}>
                <FaPlay />
              </button>
            )}
            {hasOfflineDownload ? (
              <div className="local-badge"><FaHdd /> MP4 downloaded</div>
            ) : localStreamUrl ? (
              <div className="local-badge"><FaHdd /> On your drive</div>
            ) : null}
          </div>
        </div>

        {showPlayer && (
          localStreamUrl ? (
            <NetflixPlayer
              src={localStreamUrl}
              title={`${show?.name || ''} - S${seasonNumber}E${episodeNumber} - ${episode.name}`}
              onClose={() => setShowPlayer(false)}
              onProgress={handleProgress}
              startTime={resumeTime || undefined}
              episodes={show && seasonData ? {
                currentSeason: parseInt(seasonNumber),
                currentEpisode: parseInt(episodeNumber),
                localEpisodes: localEpisodeSet,
                seasons: show.seasons
                  ?.filter((s) => s.season_number > 0)
                  .map((s) => ({
                    season_number: s.season_number,
                    episodes: s.season_number === parseInt(seasonNumber)
                      ? seasonData.episodes?.map((ep) => ({
                        ...ep,
                        season_number: parseInt(seasonNumber),
                        still_path: ep.still_path ? getImageUrl(ep.still_path, 'w300') : null,
                        onPlay: localEpisodeSet.has(ep.episode_number)
                          ? () => navigate(`/tv/${id}/season/${seasonNumber}/episode/${ep.episode_number}?autoplay=1`)
                          : null,
                      }))
                      : [],
                  })) || [],
              } : undefined}
              subtitleUrl={subtitleUrl}
            />
          ) : (
            <div className="stream-overlay">
              <button className="stream-close" onClick={() => setShowPlayer(false)}>&times;</button>
              <iframe
                src={`https://mapple.mov/watch/tv/${id}-${seasonNumber}-${episodeNumber}`}
                className="stream-iframe"
                allowFullScreen
                allow="autoplay; encrypted-media"
              />
            </div>
          )
        )}

        <div className="episode-detail-content">
          <div className="episode-detail-header">
            <span className="episode-detail-badge">
              Season {seasonNumber} &middot; Episode {episodeNumber}
            </span>
            <h1>
              {episode.name}
              {isWatched && <span className="detail-watched-badge"><FaCheckCircle /> Watched</span>}
            </h1>
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
          <div className="episode-actions-row">
            {localStreamUrl && (
              <SaveOfflineButton
                cacheKey={`episode-${id}-s${seasonNumber}e${episodeNumber}`}
                streamUrl={localStreamUrl}
                metadata={{
                  title: `${show?.name || ''} S${seasonNumber}E${episodeNumber} - ${episode.name}`,
                  posterPath: show?.poster_path,
                  type: 'episode',
                  linkTo: `/tv/${id}/season/${seasonNumber}/episode/${episodeNumber}`,
                }}
              />
            )}
            {currentUser && !isFiifi && !localStreamUrl && (
              <button
                className={`request-btn${requestSent ? ' sent' : ''}`}
                disabled={requestSent}
                onClick={async () => {
                  await sendNotification(show?.name || episode.name, id, `S${seasonNumber}E${episodeNumber} request`);
                  setRequestSent(true);
                }}
              >
                {requestSent ? <><FaCheckCircle /> Requested</> : <><FaEnvelope /> Request This</>}
              </button>
            )}
          </div>

          {episode.overview && (
            <div className="episode-detail-overview">
              <h3>Overview</h3>
              <p>{episode.overview}</p>
            </div>
          )}

          {/* Coming Up Next */}
          {nextEpisode && (
            <div className="up-next-section">
              <h3 className="up-next-title">Coming Up Next</h3>
              <div className={`up-next-card${nextEpLocal ? ' clickable' : ''}`} onClick={nextEpLocal ? playNextEpisode : undefined}>
                <div className="up-next-still">
                  {nextEpisode.still_path ? (
                    <img src={getImageUrl(nextEpisode.still_path, 'w300')} alt={nextEpisode.name} />
                  ) : (
                    <div className="episode-no-still">Ep {nextEpisode.episode_number}</div>
                  )}
                  {nextEpLocal && (
                    <div className="up-next-play-overlay">
                      <FaPlay />
                    </div>
                  )}
                  {!nextEpisodeAired && (
                    <div className="up-next-upcoming-overlay">
                      <FaCalendar /> Upcoming
                    </div>
                  )}
                </div>
                <div className="up-next-info">
                  <span className="up-next-ep-num">E{nextEpisode.episode_number}</span>
                  <h4>{nextEpisode.name}</h4>
                  {nextEpisode.overview && (
                    <p className="up-next-overview">{nextEpisode.overview}</p>
                  )}
                  <div className="up-next-actions">
                    {nextEpLocal ? (
                      <button className="up-next-play-btn" onClick={playNextEpisode}>
                        <FaPlay /> Play Next
                      </button>
                    ) : nextEpisode.air_date && !nextEpisodeAired ? (
                      <span className="episode-upcoming"><FaCalendar /> Airs {nextEpisode.air_date}</span>
                    ) : null}
                  </div>
                </div>
              </div>
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
