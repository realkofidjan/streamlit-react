import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Pause, X, Maximize, Minimize, Volume2, Volume1, VolumeX,
  SkipBack, SkipForward, List, ChevronDown, Captions
} from 'lucide-react';
import './NetflixPlayer.css';

function NetflixPlayer({ src, title, onClose, onProgress, startTime, episodes, subtitleUrl }) {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const hideTimer = useRef(null);
  const progressReportTimer = useRef(null);
  // Check if this is a transcoded (non-seekable) stream — MKV/AVI served via ffmpeg
  const isTranscoded = src && (src.includes('.mkv') || src.includes('.avi'));
  const seekOffsetRef = useRef(isTranscoded && startTime ? startTime : 0);

  const [videoSrc, setVideoSrc] = useState(() => {
    if (isTranscoded && startTime && startTime > 0) {
      const base = src.split('?')[0];
      return `${base}?t=${startTime}`;
    }
    return src;
  });

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [buffering, setBuffering] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showEpisodes, setShowEpisodes] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [subtitlesOn, setSubtitlesOn] = useState(!!subtitleUrl);

  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    if (playing) {
      hideTimer.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [playing]);

  // Auto-hide controls
  useEffect(() => {
    if (playing && !showEpisodes) {
      hideTimer.current = setTimeout(() => setShowControls(false), 3000);
    } else {
      setShowControls(true);
      clearTimeout(hideTimer.current);
    }
    return () => clearTimeout(hideTimer.current);
  }, [playing, showEpisodes]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e) => {
      const vid = videoRef.current;
      if (!vid) return;
      switch (e.key) {
        case ' ':
        case 'k':
        case 'Enter':
        case 'MediaPlayPause':
          e.preventDefault();
          e.stopPropagation();
          togglePlay();
          break;
        case 'MediaPlay':
          e.preventDefault();
          if (vid.paused) vid.play();
          break;
        case 'MediaPause':
          e.preventDefault();
          if (!vid.paused) vid.pause();
          break;
        case 'ArrowLeft':
        case 'MediaRewind':
          e.preventDefault();
          skip(-10);
          break;
        case 'ArrowRight':
        case 'MediaFastForward':
          e.preventDefault();
          skip(10);
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'Escape':
        case 'GoBack':
          e.preventDefault();
          if (showEpisodes) setShowEpisodes(false);
          else if (fullscreen) toggleFullscreen();
          else onClose();
          break;
      }
      showControlsTemporarily();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [playing, muted, fullscreen, showControlsTemporarily, onClose, showEpisodes]);

  // Report progress every 10s and on pause
  useEffect(() => {
    if (!onProgress) return;
    const vid = videoRef.current;
    if (!vid) return;
    const report = () => {
      const actual = isTranscoded ? seekOffsetRef.current + vid.currentTime : vid.currentTime;
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

  // Mark player as active for D-pad hook
  useEffect(() => {
    document.body.setAttribute('data-player-active', '');
    return () => document.body.removeAttribute('data-player-active');
  }, []);

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      setFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Set initial season
  useEffect(() => {
    if (episodes?.seasons?.length > 0 && !selectedSeason) {
      setSelectedSeason(episodes.currentSeason || episodes.seasons[0].season_number);
    }
  }, [episodes, selectedSeason]);

  const togglePlay = () => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) vid.play();
    else vid.pause();
  };

  const skip = (seconds) => {
    const vid = videoRef.current;
    if (!vid) return;
    if (isTranscoded) {
      const actualTime = seekOffsetRef.current + vid.currentTime;
      const newTime = Math.min(Math.max(actualTime + seconds, 0), duration || Infinity);
      seekOffsetRef.current = newTime;
      const base = src.split('?')[0];
      setVideoSrc(`${base}?t=${newTime}&_=${Date.now()}`);
      setCurrentTime(newTime);
      setBuffering(true);
    } else {
      vid.currentTime = Math.min(Math.max(vid.currentTime + seconds, 0), vid.duration);
    }
  };

  const toggleMute = () => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = !vid.muted;
    setMuted(vid.muted);
    if (!vid.muted) {
      setVolume(vid.volume || 1);
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
    const actual = isTranscoded ? seekOffsetRef.current + vid.currentTime : vid.currentTime;
    setCurrentTime(actual);
    if (vid.buffered.length > 0) {
      setBuffered(vid.buffered.end(vid.buffered.length - 1));
    }
  };

  const handleSeek = (pct) => {
    const vid = videoRef.current;
    if (!vid) return;
    const totalDuration = duration;
    if (!totalDuration) return;
    const time = (pct / 100) * totalDuration;
    if (!isFinite(time)) return;

    if (isTranscoded) {
      // Reload the stream with ffmpeg seeking to the new position
      seekOffsetRef.current = time;
      const base = src.split('?')[0];
      setVideoSrc(`${base}?t=${time}&_=${Date.now()}`);
      setCurrentTime(time);
      setBuffering(true);
    } else {
      vid.currentTime = time;
      setCurrentTime(time);
    }
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

  const setSpeed = (speed) => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.playbackRate = speed;
    setPlaybackSpeed(speed);
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

  return (
    <div
      ref={playerRef}
      className="vp-player"
      onMouseMove={showControlsTemporarily}
      onClick={(e) => {
        if (showEpisodes) return;
        if (e.target === e.currentTarget || e.target.closest('.vp-video-area')) {
          togglePlay();
          showControlsTemporarily();
        }
      }}
    >
      <video
        ref={videoRef}
        src={videoSrc}
        className="vp-video"
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
          if (isTranscoded) {
            // For transcoded streams, vid.duration may be Infinity or unknown
            // Keep existing duration if we already have one (from a seek reload)
            if (vid.duration && isFinite(vid.duration) && vid.duration > 0) {
              const total = seekOffsetRef.current + vid.duration;
              setDuration(total);
              // If resume position is > 95% of total, restart from beginning
              if (seekOffsetRef.current > total * 0.95) {
                seekOffsetRef.current = 0;
                const base = src.split('?')[0];
                setVideoSrc(base);
                setCurrentTime(0);
              }
            }
          } else {
            setDuration(vid.duration || 0);
            if (startTime && startTime > 0 && startTime < vid.duration * 0.95) {
              vid.currentTime = startTime;
            }
          }
          // Set subtitle track mode
          if (vid.textTracks && vid.textTracks.length > 0) {
            vid.textTracks[0].mode = subtitlesOn ? 'showing' : 'hidden';
          }
        }}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
      >
        {subtitleUrl && (
          <track
            kind="subtitles"
            src={subtitleUrl}
            srcLang="en"
            label="English"
            default={subtitlesOn}
          />
        )}
      </video>

      <div className="vp-video-area" />

      {/* Buffering spinner */}
      {buffering && (
        <div className="vp-buffering">
          <div className="vp-buffering-spinner" />
        </div>
      )}

      {/* Large center play button when paused */}
      <AnimatePresence>
        {!playing && !buffering && (
          <motion.div
            className="vp-center-play"
            onClick={togglePlay}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Play size={48} fill="white" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top bar */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            className="vp-top-bar"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <span className="vp-title">{title}</span>
            <button className="vp-icon-btn" tabIndex={-1} onClick={onClose}>
              <X size={22} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom controls — frosted glass panel */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            className="vp-bottom-panel"
            initial={{ y: 20, opacity: 0, filter: 'blur(10px)' }}
            animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
            exit={{ y: 20, opacity: 0, filter: 'blur(10px)' }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            {/* Progress bar */}
            <div className="vp-progress-row">
              <span className="vp-time">{formatTime(currentTime)}</span>
              <div
                className="vp-progress-bar"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = ((e.clientX - rect.left) / rect.width) * 100;
                  handleSeek(Math.min(Math.max(pct, 0), 100));
                }}
              >
                <div className="vp-progress-buffered" style={{ width: `${bufferedPct}%` }} />
                <motion.div
                  className="vp-progress-played"
                  style={{ width: `${progressPct}%` }}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                />
                <div className="vp-progress-thumb" style={{ left: `${progressPct}%` }} />
              </div>
              <span className="vp-time">{formatTime(duration)}</span>
            </div>

            {/* Controls row — tabIndex={-1} prevents TV remote from focusing individual buttons */}
            <div className="vp-controls-row">
              <div className="vp-controls-left">
                <button className="vp-icon-btn" tabIndex={-1} onClick={togglePlay}>
                  {playing ? <Pause size={20} /> : <Play size={20} fill="white" />}
                </button>
                <button className="vp-icon-btn" tabIndex={-1} onClick={() => skip(-10)}>
                  <SkipBack size={18} />
                </button>
                <button className="vp-icon-btn" tabIndex={-1} onClick={() => skip(10)}>
                  <SkipForward size={18} />
                </button>

                <div className="vp-volume-group">
                  <button className="vp-icon-btn" tabIndex={-1} onClick={toggleMute}>
                    {muted || volume === 0 ? <VolumeX size={18} /> :
                      volume > 0.5 ? <Volume2 size={18} /> : <Volume1 size={18} />}
                  </button>
                  <div
                    className="vp-volume-slider"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const pct = ((e.clientX - rect.left) / rect.width) * 100;
                      handleVolumeChange(Math.min(Math.max(pct, 0), 100));
                    }}
                  >
                    <motion.div
                      className="vp-volume-fill"
                      style={{ width: `${(muted ? 0 : volume) * 100}%` }}
                      animate={{ width: `${(muted ? 0 : volume) * 100}%` }}
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  </div>
                </div>
              </div>

              <div className="vp-controls-right">
                {/* Speed buttons */}
                <div className="vp-speed-group">
                  {[0.5, 1, 1.5, 2].map((speed) => (
                    <button
                      key={speed}
                      className={`vp-speed-btn ${playbackSpeed === speed ? 'active' : ''}`}
                      tabIndex={-1}
                      onClick={() => setSpeed(speed)}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>

                {/* CC / Subtitle toggle */}
                {subtitleUrl && (
                  <button
                    className={`vp-icon-btn ${subtitlesOn ? 'active' : ''}`}
                    tabIndex={-1}
                    onClick={() => {
                      const next = !subtitlesOn;
                      setSubtitlesOn(next);
                      const vid = videoRef.current;
                      if (vid?.textTracks?.[0]) {
                        vid.textTracks[0].mode = next ? 'showing' : 'hidden';
                      }
                    }}
                    title={subtitlesOn ? 'Hide Subtitles' : 'Show Subtitles'}
                  >
                    <Captions size={20} />
                  </button>
                )}

                {/* Episode list button (TV shows only) */}
                {episodes && (
                  <button
                    className={`vp-icon-btn ${showEpisodes ? 'active' : ''}`}
                    tabIndex={-1}
                    onClick={() => setShowEpisodes(!showEpisodes)}
                    title="Episodes"
                  >
                    <List size={20} />
                  </button>
                )}

                <button className="vp-icon-btn" tabIndex={-1} onClick={toggleFullscreen}>
                  {fullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
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
            className="vp-episodes-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="vp-episodes-header">
              <h3>Episodes</h3>
              <button className="vp-icon-btn" onClick={() => setShowEpisodes(false)}>
                <X size={20} />
              </button>
            </div>

            {/* Season selector */}
            {episodes.seasons?.length > 1 && (
              <div className="vp-season-select">
                <select
                  value={selectedSeason || ''}
                  onChange={(e) => setSelectedSeason(Number(e.target.value))}
                >
                  {episodes.seasons.map((s) => (
                    <option key={s.season_number} value={s.season_number}>
                      Season {s.season_number}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className="vp-select-icon" />
              </div>
            )}

            {/* Episode list */}
            <div className="vp-episodes-list">
              {currentSeasonData?.episodes?.map((ep) => {
                const isCurrent =
                  ep.season_number === episodes.currentSeason &&
                  ep.episode_number === episodes.currentEpisode;
                const isOnDrive = episodes.localEpisodes?.has(ep.episode_number);

                return (
                  <button
                    key={ep.id}
                    className={`vp-episode-item ${isCurrent ? 'current' : ''}`}
                    onClick={() => {
                      if (!isCurrent && ep.onPlay) {
                        ep.onPlay();
                      }
                    }}
                    disabled={isCurrent}
                  >
                    <div className="vp-episode-thumb">
                      {ep.still_path ? (
                        <img src={ep.still_path} alt={ep.name} />
                      ) : (
                        <div className="vp-episode-no-thumb">E{ep.episode_number}</div>
                      )}
                      {isCurrent && (
                        <div className="vp-now-playing-badge">Now Playing</div>
                      )}
                    </div>
                    <div className="vp-episode-info">
                      <span className="vp-episode-num">E{ep.episode_number}</span>
                      <span className="vp-episode-name">{ep.name}</span>
                      {ep.runtime > 0 && (
                        <span className="vp-episode-runtime">{ep.runtime}m</span>
                      )}
                    </div>
                    {isOnDrive && !isCurrent && (
                      <Play size={14} className="vp-episode-play-icon" />
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default NetflixPlayer;
