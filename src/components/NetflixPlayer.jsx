import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Pause, Maximize, Minimize, Volume2, Volume1, VolumeX,
  List, ChevronDown, ChevronLeft, Forward as NextIcon,
  Flag, MonitorSpeaker, ArrowLeft, RotateCcw, RotateCw, PictureInPicture,
  Share, Check, Languages as SubIcon, Settings,
  ThumbsDown, ThumbsUp, Heart, Lock, Unlock, X, Sun,
  Scissors, Gauge, MessageSquareText, StepForward
} from 'lucide-react';
import { saveIntroOverride } from '../services/media';
import './NetflixPlayer.css';

function NetflixPlayer({
  src, title, onClose, onProgress, startTime, episodes,
  onNextEpisode, nextEpisodeInfo, mediaInfo, introData,
  subtitles, currentSubtitle, onSelectSubtitle
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
  const [isPip, setIsPip] = useState(false);
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

  // Skip intro state
  const [showSkipIntro, setShowSkipIntro] = useState(false);
  const [learningIntro, setLearningIntro] = useState(false);
  const [canLearnIntro, setCanLearnIntro] = useState(false);
  const [introLearningStep, setIntroLearningStep] = useState(0); // 0: none, 1: marking start, 2: marking end
  const [tempIntroStart, setTempIntroStart] = useState(0);
  const [localIntro, setLocalIntro] = useState(introData);

  // Subtitle state
  const [showSubMenu, setShowSubMenu] = useState(false);
  const [subtitleOffset, setSubtitleOffset] = useState(0); // in ms

  // New UI states

  // Update src when prop changes
  useEffect(() => {
    setVideoSrc(src);
    setShowNextOverlay(false);
    setCountdown(10);
    setNextCancelled(false);
    setShowPausedOverlay(false);
    setShowSkipIntro(false);
  }, [src]);

  // Aggressive autoplay enforce
  useEffect(() => {
    if (videoSrc && videoRef.current) {
      // Many browsers block autoplay unless muted, but if the user has already interacted
      // with the domain, it works. We aggressively attempt `.play()`.
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.warn('Autoplay blocked by browser policy:', err);
          setShowControls(true);
        });
      }
    }
  }, [videoSrc]);

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
        case 'p':
          togglePiP();
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

  useEffect(() => {
    setLocalIntro(introData);
  }, [introData]);

  // Skip intro trigger
  useEffect(() => {
    if (!localIntro?.end_sec) {
      setShowSkipIntro(false);
      return;
    }
    const { start_sec, end_sec } = localIntro;
    if (currentTime >= start_sec && currentTime <= end_sec) {
      setShowSkipIntro(true);
    } else {
      setShowSkipIntro(false);
    }
  }, [currentTime, localIntro]);

  // Intro learning trigger
  useEffect(() => {
    // Show 'Learn' if it's a TV show, no intro data, and we're early
    if (mediaInfo?.type === 'episode' && !localIntro?.end_sec && introLearningStep === 0 && currentTime < 600) {
      setCanLearnIntro(true);
    } else {
      setCanLearnIntro(false);
    }
  }, [currentTime, localIntro, mediaInfo, introLearningStep]);

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

  const handleSkipIntro = () => {
    const vid = videoRef.current;
    if (vid && localIntro) {
      vid.currentTime = localIntro.end_sec + 0.5; // add a tiny buffer
      setShowSkipIntro(false);
    }
  };

  const handleSetIntroStep = async () => {
    if (!mediaInfo?.showId) return;

    if (introLearningStep === 0) {
      setIntroLearningStep(1);
    } else if (introLearningStep === 1) {
      setTempIntroStart(currentTime);
      setIntroLearningStep(2);
    } else if (introLearningStep === 2) {
      try {
        setLearningIntro(true);
        const endSec = currentTime;
        const startSec = tempIntroStart;
        await saveIntroOverride(mediaInfo.showId, mediaInfo.season, mediaInfo.episodeNumber, endSec, startSec);
        setLocalIntro({ start_sec: startSec, end_sec: endSec });
        setIntroLearningStep(0);
        setCanLearnIntro(false);
        const vid = videoRef.current;
        if (vid) vid.currentTime = endSec + 0.5;
      } catch (err) {
        console.error('Failed to save intro override:', err);
      } finally {
        setLearningIntro(false);
      }
    }
  };

  const resetIntroLearning = () => {
    setIntroLearningStep(0);
    setTempIntroStart(0);
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

  const handleSubtitleOffset = (ms) => {
    setSubtitleOffset(prev => prev + ms);
    // Since we are using standard <track>, real-time offset is tricky. 
    // Usually requires manual track rendering or re-downloading.
    // For now, let's just make picking the *right* one easy.
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

  const togglePiP = async () => {
    const vid = videoRef.current;
    if (!vid) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPip(false);
      } else {
        await vid.requestPictureInPicture();
        setIsPip(true);
      }
    } catch (error) {
      console.error('Failed to enter Picture-in-Picture mode:', error);
    }
  };

  const handleTimeUpdate = () => {
    const vid = videoRef.current;
    if (!vid) return;
    setCurrentTime(vid.currentTime);
    if (vid.buffered.length > 0) {
      setBuffered(vid.buffered.end(vid.buffered.length - 1));
    }
  };

  const handleBuffer = () => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.buffered.length > 0) {
      setBuffered(vid.buffered.end(vid.buffered.length - 1));
    }
  };

  const handleLoadedMetadata = () => {
    const vid = videoRef.current;
    if (!vid) return;
    setDuration(vid.duration || 0);
    if (startTime && startTime > 0 && startTime < vid.duration * 0.95) {
      vid.currentTime = startTime;
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
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')} `;
    return `${m}:${sec.toString().padStart(2, '0')} `;
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;

  const currentSeasonData = episodes?.seasons?.find((s) => s.season_number === selectedSeason);

  // Build the middle title for controls bar
  const controlsTitle = mediaInfo?.type === 'episode'
    ? `S${mediaInfo.season}:E${mediaInfo.episodeNumber} "${mediaInfo.episodeName || ''}"`
    : title;

  return (
    <div
      ref={playerRef}
      className={`nfp-player ${showControls ? 'show-controls' : ''}`}
      onMouseMove={() => {
        showControlsTemporarily();
      }}
      onClick={(e) => {
        if (showEpisodes || showNextOverlay || showSubMenu) return;
        if (showPausedOverlay) {
          setShowPausedOverlay(false);
          setShowControls(true);
          return;
        }
        if (e.target.closest('.nfp-click-capture')) {
          togglePlay();
          showControlsTemporarily();
        }
      }}
    >
      <video
        ref={videoRef}
        key={videoSrc}
        className="nfp-video"
        src={videoSrc}
        onTimeUpdate={handleTimeUpdate}
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        onProgress={handleBuffer}
        onLoadedMetadata={handleLoadedMetadata}
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
        {currentSubtitle && (
          <track
            key={currentSubtitle.url}
            src={currentSubtitle.url}
            kind="subtitles"
            srcLang="en"
            label={currentSubtitle.name}
            default
          />
        )}
      </video>

      <div className="nfp-click-capture" />

      {buffering && (
        <div className="nfp-buffering">
          <div className="nfp-buffering-spinner" />
        </div>
      )}

      {/* ===== CONTROLS LAYER ===== */}
      <AnimatePresence>
        {showControls && !showPausedOverlay && (
          <motion.div
            className="nfp-controls-root"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Top Bar */}
            <div className="nfp-top-bar">
              <div className="nfp-top-left">
                <span className="nfp-top-title">{controlsTitle}</span>
              </div>

              <div className="nfp-top-right">
                <button className="nfp-system-btn" onClick={onClose}><X size={32} /></button>
              </div>
            </div>

            {true && (
              <>
                {/* Middle Controls */}
                <div className="nfp-middle-controls">
                  <div className="nfp-center-cluster">
                    <button className="nfp-center-skip-btn" onClick={() => skip(-10)}>
                      <RotateCcw className="nfp-center-skip-icon" />
                      <span className="nfp-skip-text" style={{ fontSize: '1.2rem', marginTop: '-48px' }}>10</span>
                    </button>

                    <button className="nfp-center-play-btn" onClick={togglePlay}>
                      {playing ? <Pause className="nfp-center-play-icon" /> : <Play className="nfp-center-play-icon" fill="currentColor" />}
                    </button>

                    <button className="nfp-center-skip-btn" onClick={() => skip(10)}>
                      <RotateCw className="nfp-center-skip-icon" />
                      <span className="nfp-skip-text" style={{ fontSize: '1.2rem', marginTop: '-48px' }}>10</span>
                    </button>
                  </div>
                </div>

                {/* Bottom UI */}
                <div className="nfp-bottom-ui">
                  <div className="nfp-timeline-area">
                    <div className="nfp-progress-container" onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const pct = ((e.clientX - rect.left) / rect.width) * 100;
                      handleSeek(pct);
                    }}>
                      <div className="nfp-progress-rail">
                        <div className="nfp-progress-fill" style={{ width: `${progressPct}%` }} />
                        <div className="nfp-progress-thumb" style={{ left: `${progressPct}%` }} />
                      </div>
                    </div>
                    <div className="nfp-time-display">{formatTime(duration - currentTime)}</div>
                  </div>

                  <div className="nfp-action-bar">
                    <button className="nfp-action-item">
                      <Gauge size={24} />
                      <span>Speed (1x)</span>
                    </button>
                    <button className="nfp-action-item" onClick={() => setShowEpisodes(true)}>
                      <List size={24} />
                      <span>Episodes</span>
                    </button>
                    <button className="nfp-action-item" onClick={() => setShowSubMenu(true)}>
                      <MessageSquareText size={24} />
                      <span>Audio & Subtitles</span>
                    </button>
                    <button className="nfp-action-item" onClick={toggleFullscreen}>
                      {fullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
                      <span>Fullscreen</span>
                    </button>
                    <button className="nfp-action-item" onClick={triggerNextEpisode}>
                      <StepForward size={24} />
                      <span>Next Episode</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== OVERLAYS (Subtitle, Episodes, Wizard, etc) ===== */}
      <AnimatePresence>
        {/* Paused Overlay */}
        {showPausedOverlay && !playing && mediaInfo && (
          <motion.div
            className="nfp-paused-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
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
                </>
              )}
              <p className="nfp-paused-desc">{mediaInfo.overview}</p>
            </div>
            <span className="nfp-paused-tag">Paused</span>
          </motion.div>
        )}

        {/* Next Episode Countdown */}
        {showNextOverlay && nextEpisodeInfo && (
          <motion.div
            className="nfp-next-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="nfp-next-content">
              <div className="nfp-next-label">Next Episode in {countdown}</div>
              <div className="nfp-next-title">{nextEpisodeInfo.showName} S{nextEpisodeInfo.season}E{nextEpisodeInfo.episode}</div>
              <div className="nfp-next-actions">
                <button className="nfp-next-play-btn" onClick={triggerNextEpisode}>Play Now</button>
                <button className="nfp-next-cancel-btn" onClick={cancelNextEpisode}>Cancel</button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Skip Intro */}
        {showSkipIntro && (
          <motion.button
            className="nfp-skip-intro-btn"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            onClick={handleSkipIntro}
          >
            Skip Intro
          </motion.button>
        )}

        {/* Intro Learning Wizard */}
        {introLearningStep > 0 && (
          <motion.div
            className="nfp-intro-learning-wizard"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
          >
            <div className="nfp-wizard-text">
              <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#e50914' }}>
                Teaching Episode S{mediaInfo?.season} E{mediaInfo?.episodeNumber}
              </div>
              {introLearningStep === 1 ? 'Go to start of intro' : 'Go to end of intro'}
            </div>
            <div className="nfp-wizard-actions">
              <button className="nfp-wizard-btn main" onClick={handleSetIntroStep}>
                {introLearningStep === 1 ? 'Mark Start' : 'Mark End'}
              </button>
              <button className="nfp-wizard-btn cancel" onClick={resetIntroLearning}>Cancel</button>
            </div>
          </motion.div>
        )}

        {/* Subtitles Overlay */}
        {showSubMenu && (
          <motion.div
            className="nfp-subtitles-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setShowSubMenu(false);
              videoRef.current?.play();
              setPlaying(true);
            }}
          >
            <div className="nfp-netflix-sub-panel" onClick={e => e.stopPropagation()}>
              <div className="nfp-netflix-sub-header" style={{ justifyContent: 'flex-end', display: 'flex', padding: '20px' }}>
                <button className="nfp-netflix-sub-close" onClick={() => {
                  setShowSubMenu(false);
                  videoRef.current?.play();
                  setPlaying(true);
                }} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
                  <X size={40} />
                </button>
              </div>

              <div className="nfp-netflix-sub-columns">
                <div className="nfp-netflix-sub-column">
                  <h3>Audio</h3>
                  <div className="nfp-netflix-sub-list">
                    <div className="nfp-netflix-sub-item active">
                      <Check size={20} className="nfp-netflix-sub-check" />
                      Original Audio (English)
                    </div>
                  </div>
                </div>
                <div className="nfp-netflix-sub-column">
                  <h3>Subtitles</h3>
                  <div className="nfp-netflix-sub-list">
                    <div className={`nfp-netflix-sub-item ${!currentSubtitle ? 'active' : ''}`} onClick={() => { onSelectSubtitle(null); setShowSubMenu(false); videoRef.current?.play(); setPlaying(true); }}>
                      <Check size={20} className="nfp-netflix-sub-check" />
                      Off
                    </div>
                    {subtitles?.map(sub => (
                      <div key={sub.id} className={`nfp-netflix-sub-item ${currentSubtitle?.id === sub.id ? 'active' : ''}`} onClick={() => { onSelectSubtitle(sub); setShowSubMenu(false); videoRef.current?.play(); setPlaying(true); }}>
                        <Check size={20} className="nfp-netflix-sub-check" />
                        {sub.attributes.release || sub.attributes.language}
                      </div>
                    ))}
                  </div>

                  {currentSubtitle && (
                    <div className="nfp-netflix-sync-area">
                      <div className="nfp-netflix-sync-title">SYNC CORRECTION</div>
                      <div className="nfp-sync-controls">
                        <button className="nfp-sync-btn" onClick={() => handleSubtitleOffset(-500)}>-500ms</button>
                        <button className="nfp-sync-btn" onClick={() => handleSubtitleOffset(-100)}>-100ms</button>
                        <span className="nfp-sync-val">{subtitleOffset > 0 ? '+' : ''}{subtitleOffset}ms</span>
                        <button className="nfp-sync-btn" onClick={() => handleSubtitleOffset(100)}>+100ms</button>
                        <button className="nfp-sync-btn" onClick={() => handleSubtitleOffset(500)}>+500ms</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Episodes Horizontal Panel */}
        {showEpisodes && episodes && (
          <motion.div
            className="nfp-episodes-panel"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
          >
            <div className="nfp-episodes-header">
              <select
                className="nfp-season-selector"
                value={selectedSeason || episodes.currentSeason}
                onChange={(e) => setSelectedSeason(parseInt(e.target.value))}
              >
                {episodes.seasons?.map(s => (
                  <option key={s.season_number} value={s.season_number}>
                    Season {s.season_number}
                  </option>
                ))}
              </select>

              <button className="nfp-episodes-close-btn" onClick={() => setShowEpisodes(false)}>
                <X size={40} />
              </button>
            </div>

            <div className="nfp-episodes-list">
              {episodes.seasons?.find(s => s.season_number === (selectedSeason || episodes.currentSeason))?.episodes?.map(ep => {
                const isCurrent = ep.episode_number === episodes.currentEpisode &&
                  (selectedSeason || episodes.currentSeason) === episodes.currentSeason;

                return (
                  <div
                    key={ep.id}
                    className={`nfp-episode-card ${isCurrent ? 'active' : ''}`}
                    onClick={() => {
                      if (!isCurrent && ep.onPlay) ep.onPlay();
                      setShowEpisodes(false);
                      videoRef.current?.play();
                      setPlaying(true);
                    }}
                  >
                    <div className="nfp-ep-thumb-container">
                      <img
                        src={ep.still_path || ep.thumbnail || "https://via.placeholder.com/320x180?text=No+Thumbnail"}
                        className="nfp-ep-thumbnail"
                        alt={ep.name}
                      />
                      <div className="nfp-ep-thumb-overlay">
                        <div className="nfp-ep-play-circle">
                          <Play size={24} fill="white" />
                        </div>
                      </div>
                      <div
                        className="nfp-ep-progress-bar"
                        style={{ width: `${(ep.progress || 0) * 100}%` }}
                      />
                    </div>

                    <div className="nfp-ep-info-row">
                      <div className="nfp-ep-title">{ep.episode_number}. {ep.name}</div>
                    </div>

                    <div className="nfp-ep-meta">{ep.runtime || '45m'}</div>
                    <div className="nfp-ep-summary">{ep.overview}</div>
                  </div>
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
