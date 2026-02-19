import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Pause, X, Maximize, Minimize, Volume2, Volume1, VolumeX,
  List, ChevronDown, ChevronLeft, SkipForward as NextIcon,
  Flag, MonitorSpeaker, ArrowLeft, RotateCcw, RotateCw
} from 'lucide-react';
import './NetflixPlayer.css';

function NetflixPlayer({
  src, title, onClose, onProgress, startTime, episodes,
  onNextEpisode, nextEpisodeInfo, mediaInfo
}) {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const hideTimer = useRef(null);
  const progressReportTimer = useRef(null);
  const countdownTimer = useRef(null);
  const pausedOverlayTimer = useRef(null);

  const [videoSrc, setVideoSrc] = useState(src);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [buffering, setBuffering] = useState(true);
  const [showEpisodes, setShowEpisodes] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(null);

  // Next episode countdown
  const [showNextOverlay, setShowNextOverlay] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [nextCancelled, setNextCancelled] = useState(false);

  // Paused info overlay
  const [showPausedOverlay, setShowPausedOverlay] = useState(false);

  // Update src when prop changes
  useEffect(() => {
    setVideoSrc(src);
    setShowNextOverlay(false);
    setCountdown(10);
    setNextCancelled(false);
    setShowPausedOverlay(false);
  }, [src]);

  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    setShowPausedOverlay(false);
    clearTimeout(hideTimer.current);
    clearTimeout(pausedOverlayTimer.current);
    if (playing) {
      hideTimer.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [playing]);

  // Auto-hide controls
  useEffect(() => {
    clearTimeout(hideTimer.current);
    clearTimeout(pausedOverlayTimer.current);

    if (playing && !showEpisodes && !showNextOverlay) {
      hideTimer.current = setTimeout(() => setShowControls(false), 3000);
      setShowPausedOverlay(false);
    } else if (!playing && !showEpisodes && !showNextOverlay && !buffering) {
      // When paused, show controls forever, and start 5s timer for paused overlay
      setShowControls(true);
      pausedOverlayTimer.current = setTimeout(() => {
        setShowPausedOverlay(true);
        setShowControls(false);
      }, 5000);
    } else {
      setShowControls(true);
    }

    return () => {
      clearTimeout(hideTimer.current);
      clearTimeout(pausedOverlayTimer.current);
    };
  }, [playing, showEpisodes, showNextOverlay, buffering]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          showControlsTemporarily();
          break;
        case 'ArrowRight':
          e.preventDefault();
          skip(10);
          showControlsTemporarily();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skip(-10);
          showControlsTemporarily();
          break;
        case 'ArrowUp':
          e.preventDefault();
          handleVolumeChange(Math.min((volume + 0.1) * 100, 100));
          showControlsTemporarily();
          break;
        case 'ArrowDown':
          e.preventDefault();
          handleVolumeChange(Math.max((volume - 0.1) * 100, 0));
          showControlsTemporarily();
          break;
        case 'm':
          toggleMute();
          showControlsTemporarily();
          break;
        case 'f':
          toggleFullscreen();
          break;
        case 'Escape':
          if (showPausedOverlay) {
            setShowPausedOverlay(false);
            setShowControls(true);
          } else if (showEpisodes) {
            setShowEpisodes(false);
          } else if (fullscreen) {
            document.exitFullscreen();
          } else if (showNextOverlay) {
            setShowNextOverlay(false);
            setNextCancelled(true);
          } else if (onClose) {
            onClose();
          }
          break;
        case 'n':
          if (onNextEpisode && nextEpisodeInfo) {
            triggerNextEpisode();
          }
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [playing, muted, fullscreen, showControlsTemporarily, onClose, showEpisodes, showNextOverlay, showPausedOverlay, volume]);

  // Report progress every 10s and on pause
  useEffect(() => {
    if (!onProgress) return;
    const vid = videoRef.current;
    if (!vid) return;
    const report = () => {
      const actual = vid.currentTime;
      const dur = duration || vid.duration;
      if (actual > 0 && dur > 0) {
        onProgress({ currentTime: actual, duration: dur });
      }
    };
    const handlePause = () => report();
    if (playing) {
      progressReportTimer.current = setInterval(report, 10000);
    }
    vid.addEventListener('pause', handlePause);
    return () => {
      clearInterval(progressReportTimer.current);
      vid.removeEventListener('pause', handlePause);
    };
  }, [playing, onProgress]);

  // Mark player as active
  useEffect(() => {
    document.body.setAttribute('data-player-active', '');
    return () => document.body.removeAttribute('data-player-active');
  }, []);

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Set initial season
  useEffect(() => {
    if (episodes?.seasons?.length > 0 && !selectedSeason) {
      setSelectedSeason(episodes.currentSeason || episodes.seasons[0].season_number);
    }
  }, [episodes]);

  // 96% completion trigger
  useEffect(() => {
    if (!onNextEpisode || !nextEpisodeInfo || nextCancelled) return;
    if (duration <= 0) return;
    const progress = currentTime / duration;
    if (progress >= 0.99 && !showNextOverlay) {
      setShowNextOverlay(true);
      setCountdown(10);
    }
  }, [currentTime, duration, onNextEpisode, nextEpisodeInfo, nextCancelled, showNextOverlay]);

  // Countdown timer
  useEffect(() => {
    if (!showNextOverlay) {
      clearInterval(countdownTimer.current);
      return;
    }
    countdownTimer.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownTimer.current);
          triggerNextEpisode();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(countdownTimer.current);
  }, [showNextOverlay]);

  const triggerNextEpisode = () => {
    setShowNextOverlay(false);
    clearInterval(countdownTimer.current);
    if (onNextEpisode) onNextEpisode();
  };

  const cancelNextEpisode = () => {
    setShowNextOverlay(false);
    setNextCancelled(true);
    clearInterval(countdownTimer.current);
  };

  const togglePlay = () => {
    const vid = videoRef.current;
    if (!vid) return;
    if (showPausedOverlay) {
      setShowPausedOverlay(false);
      setShowControls(true);
    }
    if (vid.paused) vid.play();
    else vid.pause();
  };

  const skip = (seconds) => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.currentTime = Math.min(Math.max(vid.currentTime + seconds, 0), duration);
  };

  const toggleMute = () => {
    const vid = videoRef.current;
    if (!vid) return;
    const next = !muted;
    vid.muted = next;
    setMuted(next);
    if (!next && volume === 0) {
      vid.volume = 0.5;
      setVolume(0.5);
    }
  };

  const toggleFullscreen = () => {
    const el = playerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen();
    else document.exitFullscreen();
  };

  const handleTimeUpdate = () => {
    const vid = videoRef.current;
    if (!vid) return;
    setCurrentTime(vid.currentTime);
    if (vid.buffered.length > 0) {
      setBuffered(vid.buffered.end(vid.buffered.length - 1));
    }
  };

  const handleSeek = (pct) => {
    const vid = videoRef.current;
    if (!vid || !duration) return;
    const time = (pct / 100) * duration;
    if (!isFinite(time)) return;
    vid.currentTime = time;
    setCurrentTime(time);
  };

  const handleVolumeChange = (pct) => {
    const vid = videoRef.current;
    if (!vid) return;
    const val = pct / 100;
    vid.volume = val;
    setVolume(val);
    vid.muted = val === 0;
    setMuted(val === 0);
  };

  const formatTime = (s) => {
    if (!s || isNaN(s)) return '0:00';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;

  const currentSeasonData = episodes?.seasons?.find((s) => s.season_number === selectedSeason);

  // Build the middle title for controls bar
  const controlsTitle = mediaInfo?.type === 'episode'
    ? `${mediaInfo.showName}  E${mediaInfo.episodeNumber}  ${mediaInfo.episodeName || ''}`
    : title;

  return (
    <div
      ref={playerRef}
      className="nfp-player"
      onMouseMove={() => {
        if (showPausedOverlay) return; // Don't interrupt paused overlay on mouse move
        showControlsTemporarily();
      }}
      onClick={(e) => {
        if (showEpisodes || showNextOverlay || showSubtitleMenu) return;
        if (showPausedOverlay) {
          setShowPausedOverlay(false);
          setShowControls(true);
          return;
        }
        if (e.target === e.currentTarget || e.target.closest('.nfp-video-area')) {
          togglePlay();
          showControlsTemporarily();
        }
      }}
    >
      <video
        ref={videoRef}
        src={videoSrc}
        className="nfp-video"
        autoPlay
        preload="auto"
        crossOrigin="anonymous"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onProgress={handleTimeUpdate}
        onLoadedMetadata={() => {
          const vid = videoRef.current;
          if (!vid) return;
          setDuration(vid.duration || 0);
          if (startTime && startTime > 0 && startTime < vid.duration * 0.95) {
            vid.currentTime = startTime;
          }
        }}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
        onEnded={() => {
          if (onNextEpisode && nextEpisodeInfo && !nextCancelled) {
            triggerNextEpisode();
          } else if (onClose) {
            onClose();
          }
        }}
      >

      </video>

      <div className="nfp-video-area" />

      {/* Buffering spinner */}
      {
        buffering && (
          <div className="nfp-buffering">
            <div className="nfp-buffering-spinner" />
          </div>
        )
      }

      {/* ===== PAUSED INFO OVERLAY ===== */}
      <AnimatePresence>
        {showPausedOverlay && !playing && mediaInfo && (
          <motion.div
            className="nfp-paused-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            onClick={() => {
              setShowPausedOverlay(false);
              setShowControls(true);
            }}
          >
            <div className="nfp-paused-info">
              <span className="nfp-paused-label">You're watching</span>
              <h1 className="nfp-paused-show">{mediaInfo.showName || mediaInfo.movieTitle}</h1>
              {mediaInfo.type === 'episode' && (
                <>
                  <span className="nfp-paused-season">Season {mediaInfo.season}</span>
                  <h2 className="nfp-paused-ep">
                    {mediaInfo.episodeName}: Ep. {mediaInfo.episodeNumber}
                  </h2>
                  {mediaInfo.overview && (
                    <p className="nfp-paused-desc">{mediaInfo.overview}</p>
                  )}
                </>
              )}
              {mediaInfo.type === 'movie' && mediaInfo.overview && (
                <p className="nfp-paused-desc">{mediaInfo.overview}</p>
              )}
            </div>
            <span className="nfp-paused-tag">Paused</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== NEXT EPISODE OVERLAY ===== */}
      <AnimatePresence>
        {showNextOverlay && nextEpisodeInfo && (
          <motion.div
            className="nfp-next-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="nfp-next-content">
              <div className="nfp-next-label">Next Episode</div>
              <div className="nfp-next-title">
                {nextEpisodeInfo.showName} — S{nextEpisodeInfo.season}E{nextEpisodeInfo.episode}
              </div>
              {nextEpisodeInfo.episodeTitle && (
                <div className="nfp-next-ep-title">{nextEpisodeInfo.episodeTitle}</div>
              )}
              <div className="nfp-next-actions">
                <button className="nfp-next-play-btn" onClick={triggerNextEpisode}>
                  <Play size={18} fill="white" /> Play Now
                </button>
                <button className="nfp-next-cancel-btn" onClick={cancelNextEpisode}>
                  Cancel
                </button>
              </div>
              <div className="nfp-next-countdown">
                <div className="nfp-countdown-ring">
                  <svg viewBox="0 0 40 40">
                    <circle cx="20" cy="20" r="18" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
                    <circle cx="20" cy="20" r="18" fill="none" stroke="#e50914" strokeWidth="2"
                      strokeDasharray={`${(countdown / 10) * 113} 113`}
                      strokeLinecap="round" transform="rotate(-90 20 20)"
                      style={{ transition: 'stroke-dasharray 1s linear' }} />
                  </svg>
                  <span className="nfp-countdown-num">{countdown}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== TOP BAR — back arrow left, flag right ===== */}
      <AnimatePresence>
        {showControls && !showPausedOverlay && (
          <motion.div
            className="nfp-top-bar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <button className="nfp-back-btn" onClick={onClose}>
              <ChevronLeft size={28} strokeWidth={2.5} />
            </button>
            <button className="nfp-flag-btn">
              <Flag size={20} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== BOTTOM CONTROLS ===== */}
      <AnimatePresence>
        {showControls && !showPausedOverlay && (
          <motion.div
            className="nfp-bottom"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Progress bar — full width, red */}
            <div className="nfp-progress-wrap">
              <div
                className="nfp-progress-bar"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = ((e.clientX - rect.left) / rect.width) * 100;
                  handleSeek(Math.min(Math.max(pct, 0), 100));
                }}
              >
                <div className="nfp-progress-buffered" style={{ width: `${bufferedPct}%` }} />
                <div className="nfp-progress-played" style={{ width: `${progressPct}%` }} />
                <div className="nfp-progress-thumb" style={{ left: `${progressPct}%` }} />
              </div>
              <span className="nfp-time-remaining">{formatTime(duration - currentTime)}</span>
            </div>

            {/* Controls row */}
            <div className="nfp-controls-row">
              {/* Left controls */}
              <div className="nfp-controls-left">
                <button className="nfp-ctrl-btn" onClick={togglePlay}>
                  {playing ? <Pause size={24} /> : <Play size={24} fill="white" />}
                </button>
                <button className="nfp-ctrl-btn nfp-skip-btn" onClick={() => skip(-10)} title="-10s">
                  <RotateCcw size={22} />
                  <span className="nfp-skip-text">10</span>
                </button>
                <button className="nfp-ctrl-btn nfp-skip-btn" onClick={() => skip(10)} title="+10s">
                  <RotateCw size={22} />
                  <span className="nfp-skip-text">10</span>
                </button>

                <div className="nfp-volume-group">
                  <button className="nfp-ctrl-btn" onClick={toggleMute}>
                    {muted || volume === 0 ? <VolumeX size={22} /> :
                      volume > 0.5 ? <Volume2 size={22} /> : <Volume1 size={22} />}
                  </button>
                  <div className="nfp-volume-slider"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const pct = ((e.clientX - rect.left) / rect.width) * 100;
                      handleVolumeChange(Math.min(Math.max(pct, 0), 100));
                    }}
                  >
                    <div className="nfp-volume-fill" style={{ width: `${(muted ? 0 : volume) * 100}%` }} />
                  </div>
                </div>
              </div>

              {/* Center title */}
              <div className="nfp-controls-center">
                <span className="nfp-controls-title">{controlsTitle}</span>
              </div>

              {/* Right controls */}
              <div className="nfp-controls-right">
                {/* Next episode */}
                {onNextEpisode && nextEpisodeInfo && (
                  <button className="nfp-ctrl-btn" onClick={triggerNextEpisode} title="Next Episode">
                    <NextIcon size={22} />
                    <span className="nfp-ctrl-pipe">|</span>
                  </button>
                )}

                {/* Cast (placeholder) */}
                <button className="nfp-ctrl-btn" title="Cast">
                  <MonitorSpeaker size={22} />
                </button>



                {/* Episode list */}
                {episodes && (
                  <button
                    className={`nfp-ctrl-btn ${showEpisodes ? 'active' : ''}`}
                    onClick={() => setShowEpisodes(!showEpisodes)}
                    title="Episodes"
                  >
                    <List size={22} />
                  </button>
                )}

                {/* Fullscreen */}
                <button className="nfp-ctrl-btn" onClick={toggleFullscreen}>
                  {fullscreen ? <Minimize size={22} /> : <Maximize size={22} />}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>



      {/* Episode list sidebar */}
      <AnimatePresence>
        {showEpisodes && episodes && (
          <motion.div
            className="nfp-episodes-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="nfp-episodes-header">
              <button className="nfp-episodes-back-btn" onClick={() => setShowEpisodes(false)}>
                <ArrowLeft size={24} />
              </button>
              {episodes.seasons?.length > 1 ? (
                <div className="nfp-season-select-wrapper">
                  <select
                    value={selectedSeason || ''}
                    onChange={(e) => setSelectedSeason(Number(e.target.value))}
                    className="nfp-season-select-input"
                  >
                    {episodes.seasons.map((s) => (
                      <option key={s.season_number} value={s.season_number}>
                        Season {s.season_number}
                      </option>
                    ))}
                  </select>
                  <span className="nfp-season-select-label">Season {selectedSeason}</span>
                  <ChevronDown size={14} className="nfp-season-chevron" />
                </div>
              ) : (
                <span className="nfp-season-title">Season {selectedSeason}</span>
              )}
            </div>

            <div className="nfp-episodes-list">
              {currentSeasonData?.episodes?.map((ep) => {
                const isCurrent =
                  ep.season_number === episodes.currentSeason &&
                  ep.episode_number === episodes.currentEpisode;

                return (
                  <div
                    key={ep.id}
                    className={`nfp-episode-row ${isCurrent ? 'active' : ''}`}
                    onClick={() => {
                      if (!isCurrent && ep.onPlay) ep.onPlay();
                    }}
                  >
                    <div className="nfp-ep-top">
                      <span className="nfp-ep-num">{ep.episode_number}</span>
                      <div className="nfp-ep-title-group">
                        <span className="nfp-ep-title">{ep.name}</span>
                      </div>
                      <div className="nfp-ep-progress-track">
                        <div className="nfp-ep-progress-fill" style={{ width: `${(ep.progress || 0) * 100}%` }} />
                      </div>
                    </div>

                    {isCurrent && (
                      <div className="nfp-ep-details">
                        <div className="nfp-ep-thumb">
                          {ep.still_path ? (
                            <img src={ep.still_path} alt={ep.name} />
                          ) : (
                            <div className="nfp-ep-no-thumb">{ep.episode_number}</div>
                          )}
                        </div>
                        <p className="nfp-ep-overview">{ep.overview}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div >
  );
}

export default NetflixPlayer;
