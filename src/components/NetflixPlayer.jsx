import { useState, useRef, useEffect, useCallback } from 'react';
import {
  FaPlay, FaPause, FaTimes, FaExpand, FaCompress,
  FaVolumeUp, FaVolumeMute, FaUndo, FaRedo
} from 'react-icons/fa';
import './NetflixPlayer.css';

function NetflixPlayer({ src, title, onClose }) {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const progressRef = useRef(null);
  const hideTimer = useRef(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [buffering, setBuffering] = useState(true);
  const [showCenterIcon, setShowCenterIcon] = useState(null);
  const [dragging, setDragging] = useState(false);

  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    if (playing) {
      hideTimer.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [playing]);

  // Auto-hide controls
  useEffect(() => {
    if (playing) {
      hideTimer.current = setTimeout(() => setShowControls(false), 3000);
    } else {
      setShowControls(true);
      clearTimeout(hideTimer.current);
    }
    return () => clearTimeout(hideTimer.current);
  }, [playing]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e) => {
      const vid = videoRef.current;
      if (!vid) return;
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skip(-10);
          break;
        case 'ArrowRight':
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
          e.preventDefault();
          if (fullscreen) toggleFullscreen();
          else onClose();
          break;
      }
      showControlsTemporarily();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [playing, muted, fullscreen, showControlsTemporarily, onClose]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      setFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const togglePlay = () => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) {
      vid.play();
    } else {
      vid.pause();
    }
  };

  const skip = (seconds) => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.currentTime = Math.min(Math.max(vid.currentTime + seconds, 0), vid.duration);
    flashCenter(seconds > 0 ? 'forward' : 'backward');
  };

  const toggleMute = () => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = !vid.muted;
    setMuted(vid.muted);
  };

  const toggleFullscreen = () => {
    const el = playerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const flashCenter = (type) => {
    setShowCenterIcon(type);
    setTimeout(() => setShowCenterIcon(null), 600);
  };

  const handleTimeUpdate = () => {
    const vid = videoRef.current;
    if (!vid || dragging) return;
    setCurrentTime(vid.currentTime);
    if (vid.buffered.length > 0) {
      setBuffered(vid.buffered.end(vid.buffered.length - 1));
    }
  };

  const handleProgressClick = (e) => {
    const vid = videoRef.current;
    const bar = progressRef.current;
    if (!vid || !bar) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    vid.currentTime = pct * vid.duration;
    setCurrentTime(vid.currentTime);
  };

  const handleProgressDrag = (e) => {
    if (!dragging) return;
    const vid = videoRef.current;
    const bar = progressRef.current;
    if (!vid || !bar) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    setCurrentTime(pct * vid.duration);
  };

  const handleDragEnd = (e) => {
    if (!dragging) return;
    setDragging(false);
    const vid = videoRef.current;
    const bar = progressRef.current;
    if (!vid || !bar) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    vid.currentTime = pct * vid.duration;
  };

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleProgressDrag);
      window.addEventListener('mouseup', handleDragEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleProgressDrag);
      window.removeEventListener('mouseup', handleDragEnd);
    };
  }, [dragging]);

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    const vid = videoRef.current;
    if (!vid) return;
    vid.volume = val;
    setVolume(val);
    if (val === 0) {
      vid.muted = true;
      setMuted(true);
    } else if (muted) {
      vid.muted = false;
      setMuted(false);
    }
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

  return (
    <div
      ref={playerRef}
      className={`nfx-player ${showControls ? 'show-controls' : ''}`}
      onMouseMove={showControlsTemporarily}
      onClick={(e) => {
        if (e.target === e.currentTarget || e.target.closest('.nfx-video-area')) {
          togglePlay();
          showControlsTemporarily();
        }
      }}
    >
      <video
        ref={videoRef}
        src={src}
        className="nfx-video"
        autoPlay
        preload="auto"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
      />

      <div className="nfx-video-area" />

      {/* Buffering spinner */}
      {buffering && (
        <div className="nfx-buffering">
          <div className="nfx-buffering-spinner" />
        </div>
      )}

      {/* Center flash icon */}
      {showCenterIcon && (
        <div className="nfx-center-flash">
          {showCenterIcon === 'forward' ? <FaRedo /> : <FaUndo />}
          <span>{showCenterIcon === 'forward' ? '+10s' : '-10s'}</span>
        </div>
      )}

      {/* Large center play button when paused */}
      {!playing && !buffering && (
        <div className="nfx-center-play" onClick={togglePlay}>
          <FaPlay />
        </div>
      )}

      {/* Top bar */}
      <div className="nfx-top-bar">
        <span className="nfx-title">{title}</span>
        <button className="nfx-btn nfx-close-btn" onClick={onClose}>
          <FaTimes />
        </button>
      </div>

      {/* Bottom controls */}
      <div className="nfx-bottom-bar">
        {/* Progress bar */}
        <div
          ref={progressRef}
          className="nfx-progress-bar"
          onClick={handleProgressClick}
          onMouseDown={(e) => {
            setDragging(true);
            handleProgressClick(e);
          }}
        >
          <div className="nfx-progress-buffered" style={{ width: `${bufferedPct}%` }} />
          <div className="nfx-progress-played" style={{ width: `${progressPct}%` }} />
          <div className="nfx-progress-thumb" style={{ left: `${progressPct}%` }} />
        </div>

        <div className="nfx-controls-row">
          <div className="nfx-controls-left">
            <button className="nfx-btn" onClick={togglePlay}>
              {playing ? <FaPause /> : <FaPlay />}
            </button>
            <button className="nfx-btn" onClick={() => skip(-10)}>
              <FaUndo />
            </button>
            <button className="nfx-btn" onClick={() => skip(10)}>
              <FaRedo />
            </button>

            <div className="nfx-volume-group">
              <button className="nfx-btn" onClick={toggleMute}>
                {muted || volume === 0 ? <FaVolumeMute /> : <FaVolumeUp />}
              </button>
              <input
                type="range"
                className="nfx-volume-slider"
                min="0"
                max="1"
                step="0.05"
                value={muted ? 0 : volume}
                onChange={handleVolumeChange}
              />
            </div>

            <span className="nfx-time">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="nfx-controls-right">
            <button className="nfx-btn" onClick={toggleFullscreen}>
              {fullscreen ? <FaCompress /> : <FaExpand />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NetflixPlayer;
