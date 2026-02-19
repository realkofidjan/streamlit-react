
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlay, FaPlus, FaCheck, FaThumbsUp, FaTimes, FaDownload, FaChevronDown } from 'react-icons/fa';
import { getMovieDetails, getTvShowDetails, getSimilarMovies, getSimilarTvShows, getImageUrl, getTvSeasonDetails } from '../services/tmdb';
import { searchLocalMovies, searchLocalTvShows, getLocalTvSeasons, getLocalTvEpisodes, getMediaUrl } from '../services/media';
import { useUser } from '../contexts/UserContext';
import { isVideoOffline, saveVideoOffline, removeOfflineVideo } from '../services/offlineStorage';
import { Capacitor } from '@capacitor/core';
import axios from 'axios';
import './ContentModal.css';

function ContentModal({ content, onClose, show }) {
    const navigate = useNavigate();
    const { currentUser, addToWatchlist, removeFromWatchlist } = useUser();
    const overlayRef = useRef(null);

    const [details, setDetails] = useState(null);
    const [similar, setSimilar] = useState([]);
    const [seasonDetails, setSeasonDetails] = useState(null);
    const [selectedSeason, setSelectedSeason] = useState(1);
    const [loading, setLoading] = useState(false);
    const [showSeasonDropdown, setShowSeasonDropdown] = useState(false);

    // Track local availability
    const [localEpisodeSet, setLocalEpisodeSet] = useState(new Set());
    const [isLocalMovie, setIsLocalMovie] = useState(false);

    // Download state
    const [isDownloading, setIsDownloading] = useState({}); // { key: true/false }
    const [downloadProgress, setDownloadProgress] = useState({}); // { key: 0.5 }
    const isNative = Capacitor.isNativePlatform();

    // Content history stack for modal-to-modal navigation
    const [contentStack, setContentStack] = useState([]);

    // Current content being displayed (could be from stack)
    const [currentContent, setCurrentContent] = useState(content);

    // Streaming overlay for non-local content
    const [streamUrl, setStreamUrl] = useState(null);
    const [showAdWarning, setShowAdWarning] = useState(true);

    // Reset warning when stream opens
    useEffect(() => {
        if (streamUrl) setShowAdWarning(true);
    }, [streamUrl]);

    // Reset when root content changes
    useEffect(() => {
        if (!content) return;
        setContentStack([]);
        setCurrentContent(content);
        setStreamUrl(null);
    }, [content]);

    // Body scroll lock — only when modal is showing
    useEffect(() => {
        if (show) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [show]);

    // Fetch data when currentContent changes
    useEffect(() => {
        if (!currentContent) return;
        let cancelled = false;

        setDetails(null);
        setSimilar([]);
        setSeasonDetails(null);
        setSelectedSeason(1);
        setLocalEpisodeSet(new Set());
        setIsLocalMovie(false);
        setLoading(true);
        setStreamUrl(null);

        const fetchInfo = async () => {
            try {
                const isMovie = currentContent.type === 'movie';
                const id = currentContent.id;

                let detailRes, similarRes;
                if (isMovie) {
                    [detailRes, similarRes] = await Promise.all([
                        getMovieDetails(id),
                        getSimilarMovies(id).catch(() => ({ data: { results: [] } }))
                    ]);

                    // Check local availability for movies
                    try {
                        const localRes = await searchLocalMovies(detailRes.data.title);
                        if (!cancelled) setIsLocalMovie(localRes.data.length > 0);
                    } catch {
                        if (!cancelled) setIsLocalMovie(false);
                    }
                } else {
                    [detailRes, similarRes] = await Promise.all([
                        getTvShowDetails(id),
                        getSimilarTvShows(id).catch(() => ({ data: { results: [] } }))
                    ]);
                }

                if (cancelled) return;

                setDetails(detailRes.data);
                setSimilar(similarRes.data.results || []);

                if (!isMovie) {
                    // Fetch Season 1 by default
                    const seasonRes = await getTvSeasonDetails(id, 1).catch(() => null);
                    if (!cancelled && seasonRes) setSeasonDetails(seasonRes.data);

                    // Check local episode availability
                    checkLocalEpisodes(detailRes.data, 1, cancelled);
                }

            } catch (err) {
                console.error("Failed to fetch modal details", err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        if (show) {
            fetchInfo();
        }

        return () => { cancelled = true; };
    }, [currentContent, show]);

    const checkLocalEpisodes = async (showData, seasonNum, cancelled) => {
        try {
            const res = await searchLocalTvShows(showData.name);
            if (res.data.length === 0) return;
            const localEpNums = new Set();
            for (const match of res.data) {
                const seasonsRes = await getLocalTvSeasons(match.name);
                for (const folder of seasonsRes.data) {
                    const epsRes = await getLocalTvEpisodes(match.name, folder.name);
                    for (const ep of epsRes.data) {
                        const sm = ep.filename.match(/[Ss](\d+)/);
                        const em = ep.filename.match(/[Ee](\d+)/);
                        if (!sm || !em) continue;
                        if (parseInt(sm[1]) === seasonNum) {
                            localEpNums.add(parseInt(em[1]));
                        }
                    }
                }
            }
            if (!cancelled) setLocalEpisodeSet(localEpNums);
        } catch { /* server not running */ }
    };

    // Handle season change
    const handleSeasonChange = async (seasonNum) => {
        setSelectedSeason(seasonNum);
        setShowSeasonDropdown(false);
        if (details) {
            try {
                const res = await getTvSeasonDetails(details.id, seasonNum);
                setSeasonDetails(res.data);
                checkLocalEpisodes(details, seasonNum, false);
            } catch (e) {
                console.error("Failed to fetch season", e);
            }
        }
    };

    // Navigate to a similar item (open it in this same modal)
    const openSimilarItem = useCallback((item, type) => {
        setContentStack(prev => [...prev, currentContent]);
        setCurrentContent({ ...item, type });
        const modalEl = document.querySelector('.content-modal');
        if (modalEl) modalEl.scrollTop = 0;
    }, [currentContent]);

    // Go back in the modal stack
    const handleModalBack = useCallback(() => {
        if (contentStack.length > 0) {
            const prev = contentStack[contentStack.length - 1];
            setContentStack(stack => stack.slice(0, -1));
            setCurrentContent(prev);
            const modalEl = document.querySelector('.content-modal');
            if (modalEl) modalEl.scrollTop = 0;
        }
    }, [contentStack]);

    // Watchlist logic
    const isInWatchlist = useCallback(() => {
        if (!currentUser || !currentContent) return false;
        const wl = currentUser.watchlist;
        if (!wl) return false;
        const type = currentContent.type === 'movie' ? 'movies' : 'shows';
        return !!wl[type]?.[String(currentContent.id)];
    }, [currentUser, currentContent]);

    const toggleWatchlist = () => {
        if (!currentContent || !details) return;
        const id = String(currentContent.id);
        const type = currentContent.type === 'movie' ? 'movie' : 'show';
        const title = currentContent.type === 'movie' ? details.title : details.name;
        const poster = details.poster_path;

        if (isInWatchlist()) {
            removeFromWatchlist(type, id);
        } else {
            addToWatchlist(type, id, title, poster);
        }
    };

    // Native Download Logic for APK
    const startNativeDownload = async (key, streamUrl, metadata) => {
        console.log('[ContentModal] startNativeDownload called', { key, streamUrl });

        if (isDownloading[key]) {
            console.log('[ContentModal] Already downloading', key);
            return;
        }

        setIsDownloading(prev => {
            console.log('[ContentModal] Setting isDownloading true for', key);
            return { ...prev, [key]: true };
        });

        try {
            console.log('[ContentModal] Calling saveVideoOffline...');
            await saveVideoOffline(key, streamUrl, metadata, (progress) => {
                console.log(`[ContentModal] Progress for ${key}:`, progress);
                setDownloadProgress(prev => ({ ...prev, [key]: progress }));
            });
            console.log('[ContentModal] Download completed successfully', key);
        } catch (err) {
            console.error('[ContentModal] Download failed exception', err);
            alert('Download failed: ' + err.message);
        } finally {
            console.log('[ContentModal] Finally block - resetting isDownloading to false', key);
            setIsDownloading(prev => ({ ...prev, [key]: false }));
        }
    };

    const handleDownload = (e, targetItem, type) => {
        e.stopPropagation();
        alert('Download Clicked!'); // Immediate feedback proof
        console.log('[ContentModal] handleDownload clicked', { type, targetItem });

        // Get the correct filename from state
        let filename;
        if (type === 'movie') {
            filename = localFilename;
        } else {
            filename = localEpisodeFilenames[targetItem.episode_number];
        }

        console.log('[ContentModal] Resolved filename:', filename);

        if (!filename) {
            alert('Cannot download: Source file not found locally on server.');
            console.error('Missing filename for download', type, targetItem);
            return;
        }

        const key = type === 'movie' ? String(targetItem.id) : `${item.id}-s${selectedSeason}e${targetItem.episode_number}`;
        console.log('[ContentModal] Generated key:', key);

        const title = type === 'movie' ? targetItem.title : targetItem.name;
        const poster = type === 'movie' ? targetItem.poster_path : targetItem.still_path || details.poster_path;

        const baseUrl = getMediaUrl();
        console.log('[ContentModal] Base URL:', baseUrl);

        if (!baseUrl || baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
            alert('Cannot download from localhost. Please set your public Server URL in Settings.');
            console.error('Invalid download URL base:', baseUrl);
            return;
        }

        const streamUrl = type === 'movie'
            ? `${baseUrl}/api/movies/${encodeURIComponent(filename)}`
            : `${baseUrl}/api/tv/${encodeURIComponent(item.name || item.title)}/s${selectedSeason}/${encodeURIComponent(filename)}`;

        console.log('[ContentModal] Stream URL:', streamUrl);

        startNativeDownload(key, streamUrl, {
            id: targetItem.id,
            title,
            posterPath: poster,
            type,
            showId: item.id,
            season: selectedSeason,
            episode: targetItem.episode_number
        });
    };

    // Request download for non-local content
    const requestMovieDownload = async (e) => {
        e.stopPropagation();
        try {
            const year = item.release_date ? new Date(item.release_date).getFullYear() : null;
            const res = await axios.post(`${getMediaUrl()}/api/download/movie`, {
                tmdbId: item.id,
                title: item.title,
                year,
            });
            alert(res.data.message || 'Download request queued!');
        } catch (err) {
            alert('Failed to request download: ' + (err.response?.data?.error || err.message));
        }
    };

    const requestEpisodeDownload = async (e, seasonNum, episodeNum, epTitle) => {
        e.stopPropagation();
        try {
            const showName = item.name || item.title;
            const res = await axios.post(`${getMediaUrl()}/api/download/episode`, {
                tmdbId: item.id,
                showName,
                season: seasonNum,
                episode: episodeNum,
                episodeTitle: epTitle || '',
            });
            alert(res.data.message || 'Download request queued!');
        } catch (err) {
            alert('Failed to request download: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleOverlayClick = (e) => {
        if (e.target === overlayRef.current) {
            onClose();
        }
    };

    const inWatchlist = isInWatchlist();

    const getResumeInfo = () => {
        if (!currentUser || !item) return null;
        if (isMovie) {
            const progress = currentUser.watchHistory?.movies?.[String(item.id)];
            if (progress && progress.currentTime > 0 && progress.progress < 0.9) {
                return { time: progress.currentTime, pct: progress.progress, isResume: true };
            }
        } else if (item.seasons || seasonDetails) {
            // TV Show Resume Logic
            const showId = String(item.id);
            const episodesHistory = currentUser.watchHistory?.episodes || {};

            // Find all episodes for this show in history
            const watchedEpisodes = Object.keys(episodesHistory)
                .filter(key => key.startsWith(`${showId}-`))
                .map(key => {
                    const parts = key.match(/-s(\d+)e(\d+)/);
                    if (!parts) return null;
                    return {
                        key,
                        season: parseInt(parts[1]),
                        episode: parseInt(parts[2]),
                        ...episodesHistory[key]
                    };
                })
                .filter(ep => ep !== null)
                .sort((a, b) => {
                    // Sort by timestamp if available (newest first)
                    if (b.timestamp && a.timestamp) return b.timestamp - a.timestamp;
                    // Fallback to highest season/episode
                    if (b.season !== a.season) return b.season - a.season;
                    return b.episode - a.episode;
                });

            if (watchedEpisodes.length > 0) {
                const lastWatched = watchedEpisodes[0];

                // If the last watched episode is not finished (progress < 95%), resume it
                if (lastWatched.progress < 0.97) {
                    return {
                        type: 'episode',
                        season: lastWatched.season,
                        episode: lastWatched.episode,
                        time: lastWatched.currentTime,
                        pct: lastWatched.progress,
                        isResume: true
                    };
                }
                // If finished, suggest the next episode (this is a simple incremental logic)
                else {
                    return {
                        type: 'episode',
                        season: lastWatched.season,
                        episode: lastWatched.episode + 1,
                        time: 0,
                        pct: 0,
                        isResume: false // It's a "Play Next", not exactly "Resume" mid-stream
                    };
                }
            }
        }
        return null;
    };


    const shouldRender = show && currentContent;

    // Check if we have a stream URL first. If so, show stream overlay.
    // The previous code had `if (streamUrl)` AFTER `if (!shouldRender)`.
    // But `streamUrl` might be set? 
    // Actually, `streamUrl` is reset when `content` changes.
    // If unwrapping stream, we need to make sure we don't crash returning null details.

    // Safety check BEFORE accessing `currentContent` properties if we might be null.
    // But hooks MUST run.

    if (!shouldRender) return null;

    const item = details || currentContent;
    const isMovie = currentContent.type === 'movie';
    const backdrop = getImageUrl(item.backdrop_path, 'original');
    const title = isMovie ? item.title : item.name;
    const year = isMovie
        ? (item.release_date?.split('-')[0] || '')
        : (item.first_air_date?.split('-')[0] || '');

    const runtime = isMovie
        ? (item.runtime ? `${Math.floor(item.runtime / 60)}h ${item.runtime % 60}m` : '')
        : (item.number_of_seasons ? `${item.number_of_seasons} Season${item.number_of_seasons > 1 ? 's' : ''}` : '');

    const resumeInfo = getResumeInfo();

    // Play movie — local goes to /play, non-local opens stream
    const handlePlayMovie = (startTime = 0) => {
        if (isLocalMovie) {
            onClose();
            navigate(`/play?type=movie&id=${item.id}${startTime > 0 ? `&t=${startTime}` : ''}`);
        } else {
            // Updated to vidlink.pro - verified 200 OK response
            setStreamUrl(`https://vidlink.pro/movie/${item.id}`);
        }
    };

    // Play episode — local goes to /play, non-local opens stream
    const handleEpisodePlay = (seasonNum, episodeNum, startTime = 0) => {
        const hasLocal = localEpisodeSet.has(episodeNum);
        if (hasLocal) {
            onClose();
            navigate(`/play?type=episode&id=${item.id}&season=${seasonNum}&episode=${episodeNum}${startTime > 0 ? `&t=${startTime}` : ''}`);
        } else {
            // Updated to vidlink.pro
            setStreamUrl(`https://vidlink.pro/tv/${item.id}/${seasonNum}/${episodeNum}`);
        }
    };

    // Close stream overlay
    if (streamUrl) {
        return (
            <div className="content-modal-overlay" ref={overlayRef}>
                <div className="stream-overlay-container">
                    <button className="stream-close-btn" onClick={() => setStreamUrl(null)}>
                        <FaTimes /> Back to Details
                    </button>

                    {showAdWarning && (
                        <div style={{
                            position: 'absolute',
                            top: '60px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            background: 'rgba(229, 9, 20, 0.9)',
                            color: '#fff',
                            padding: '10px 20px',
                            borderRadius: '4px',
                            zIndex: 100,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                            maxWidth: '90%'
                        }}>
                            <span>⚠️ <strong>Note:</strong> Ads are from the provider, not us. Please close them to play.</span>
                            <button
                                onClick={() => setShowAdWarning(false)}
                                style={{
                                    background: 'rgba(0,0,0,0.3)',
                                    border: 'none',
                                    color: '#fff',
                                    borderRadius: '50%',
                                    width: '24px',
                                    height: '24px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                <FaTimes size={12} />
                            </button>
                        </div>
                    )}

                    <iframe
                        src={streamUrl}
                        className="stream-iframe"
                        allowFullScreen
                        title="Stream"
                        allow="autoplay; fullscreen; picture-in-picture; encrypted-media; presentation"
                        referrerPolicy="no-referrer"
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="content-modal-overlay" ref={overlayRef} onClick={handleOverlayClick}>
            <div className="content-modal">
                <button className="content-modal-close" onClick={onClose} aria-label="Close">
                    <FaTimes />
                </button>

                {/* Back button when navigating in stack */}
                {contentStack.length > 0 && (
                    <button className="content-modal-back" onClick={handleModalBack} aria-label="Back">
                        ←
                    </button>
                )}

                {loading ? (
                    <div className="modal-loading">
                        <div className="spinner" />
                    </div>
                ) : (
                    <>
                        <div className="content-modal-hero">
                            {backdrop && <img src={backdrop} alt={title} className="content-modal-backdrop" />}

                            <div className="content-modal-gradient" />

                            <div className="content-modal-controls">
                                {/* Play button — always visible */}
                                {isMovie && (
                                    <button className="modal-play-btn" onClick={() => handlePlayMovie(resumeInfo?.time || 0)}>
                                        {/* Simplified Play button text logic to avoid 'undefined' bugs */}
                                        <FaPlay /> {resumeInfo ? 'Resume' : (isLocalMovie ? 'Play' : 'Stream')}
                                    </button>
                                )}

                                {!isMovie && (
                                    <button
                                        className="modal-play-btn"
                                        onClick={() => {
                                            if (resumeInfo && !isMovie) {
                                                handleEpisodePlay(resumeInfo.season, resumeInfo.episode, resumeInfo.time);
                                            } else if (seasonDetails?.episodes?.[0]) {
                                                handleEpisodePlay(selectedSeason, seasonDetails.episodes[0].episode_number);
                                            }
                                        }}
                                        disabled={!resumeInfo && !seasonDetails?.episodes?.[0]}
                                    >
                                        <FaPlay />
                                        {resumeInfo && !isMovie
                                            ? (resumeInfo.isResume ? `Resume S${resumeInfo.season}:E${resumeInfo.episode}` : `Play S${resumeInfo.season}:E${resumeInfo.episode}`)
                                            : (seasonDetails?.episodes?.[0]
                                                ? `${localEpisodeSet.has(seasonDetails.episodes[0].episode_number) ? 'Play' : 'Stream'} S${selectedSeason}E${seasonDetails.episodes[0].episode_number}`
                                                : 'Play')
                                        }
                                    </button>
                                )}

                                {/* Request Download — for non-local movies */}
                                {isMovie && !isLocalMovie && details && (
                                    <button className="modal-icon-btn modal-icon-btn-download" title="Request Download" onClick={requestMovieDownload}>
                                        <FaDownload />
                                    </button>
                                )}

                                {/* Watchlist */}
                                <button className="modal-icon-btn" title={inWatchlist ? 'Remove from My List' : 'Add to My List'} onClick={toggleWatchlist}>
                                    {inWatchlist ? <FaCheck /> : <FaPlus />}
                                </button>

                                <button className="modal-icon-btn" title="I like this">
                                    <FaThumbsUp />
                                </button>

                                {isNative && isLocalMovie && (
                                    <button
                                        className={`modal-icon-btn ${isDownloading[String(item.id)] ? 'downloading' : ''}`}
                                        title={isDownloading[String(item.id)] ? "Downloading..." : "Save Offline"}
                                        onClick={(e) => handleDownload(e, details, 'movie')}
                                        disabled={isDownloading[String(item.id)]}
                                        style={{ position: 'relative' }}
                                    >
                                        {isDownloading[String(item.id)] ? (
                                            <div style={{ position: 'relative', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <svg width="24" height="24" viewBox="0 0 24 24" style={{ transform: 'rotate(-90deg)' }}>
                                                    <circle
                                                        cx="12"
                                                        cy="12"
                                                        r="10"
                                                        fill="none"
                                                        stroke="#333"
                                                        strokeWidth="2"
                                                    />
                                                    <circle
                                                        cx="12"
                                                        cy="12"
                                                        r="10"
                                                        fill="none"
                                                        stroke="#fff"
                                                        strokeWidth="2"
                                                        strokeDasharray="63" // 2 * pi * 10 ≈ 63
                                                        strokeDashoffset={63 - ((downloadProgress[String(item.id)] || 0) / 100) * 63}
                                                        strokeLinecap="round"
                                                        style={{ transition: 'stroke-dashoffset 0.3s ease' }}
                                                    />
                                                </svg>
                                                <div style={{ position: 'absolute', fontSize: '8px', color: '#fff', fontWeight: 'bold' }}>
                                                    {Math.round(downloadProgress[String(item.id)] || 0)}%
                                                </div>
                                            </div>
                                        ) : (
                                            <FaDownload />
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="content-modal-info">
                            <div className="modal-left-col">
                                <div className="modal-metadata">
                                    <span className="modal-match">98% Match</span>
                                    <span className="modal-year">{year}</span>
                                    <span className="modal-age">18+</span>
                                    <span className="modal-runtime">{runtime}</span>
                                    <span className="modal-hd">HD</span>
                                </div>

                                <p className="modal-overview">{item.overview}</p>
                            </div>

                            <div className="modal-right-col modal-sidebar">
                                {item.genres && (
                                    <div className="modal-sidebar-item">
                                        <span className="modal-sidebar-label">Genres: </span>
                                        <span className="modal-sidebar-value">{item.genres.map(g => g.name).join(', ')}</span>
                                    </div>
                                )}
                                {item.credits?.cast && (
                                    <div className="modal-sidebar-item">
                                        <span className="modal-sidebar-label">Cast: </span>
                                        <span className="modal-sidebar-value">
                                            {item.credits.cast.slice(0, 3).map(c => c.name).join(', ')}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* TV Episodes Section */}
                        {
                            !isMovie && details && (
                                <div className="content-modal-section">
                                    <div className="modal-episodes">
                                        <div className="modal-episodes-header">
                                            <h3 className="modal-section-title">Episodes</h3>
                                            {details.seasons && (
                                                <div className="season-selector-container">
                                                    <button className="season-select-btn" onClick={() => setShowSeasonDropdown(!showSeasonDropdown)}>
                                                        Season {selectedSeason} <FaChevronDown />
                                                    </button>
                                                    {showSeasonDropdown && (
                                                        <div className="season-dropdown">
                                                            {details.seasons.filter(s => s.season_number > 0).map(s => (
                                                                <button
                                                                    key={s.id}
                                                                    className={`season-option ${s.season_number === selectedSeason ? 'active' : ''}`}
                                                                    onClick={() => handleSeasonChange(s.season_number)}
                                                                >
                                                                    {s.name} ({s.episode_count} Episodes)
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {seasonDetails && seasonDetails.episodes && (
                                            <div className="modal-ep-grid">
                                                {seasonDetails.episodes.map(ep => {
                                                    const hasLocal = localEpisodeSet.has(ep.episode_number);
                                                    const epKey = `${item.id}-s${selectedSeason}e${ep.episode_number}`;
                                                    const epProgress = currentUser?.watchHistory?.episodes?.[epKey];
                                                    const resumeTime = (epProgress && epProgress.currentTime > 0 && epProgress.progress < 0.97) ? epProgress.currentTime : 0;

                                                    return (
                                                        <div
                                                            key={ep.id}
                                                            className="modal-ep-row"
                                                            onClick={() => handleEpisodePlay(selectedSeason, ep.episode_number, resumeTime)}
                                                        >
                                                            <span className="modal-ep-num">{ep.episode_number}</span>
                                                            <div className="modal-ep-thumb-wrapper">
                                                                <img src={getImageUrl(ep.still_path, 'w300')} alt={ep.name} className="modal-ep-thumb" />
                                                                {epProgress?.progress > 0 && (
                                                                    <div className="modal-ep-progress">
                                                                        <div
                                                                            className="modal-ep-progress-fill"
                                                                            style={{ width: `${Math.min(epProgress.progress * 100, 100)}%` }}
                                                                        />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="modal-ep-info">
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                    <span className="modal-ep-title">{ep.name}</span>
                                                                    <span className="modal-ep-dur">{ep.runtime ? `${ep.runtime}m` : ''}</span>
                                                                </div>
                                                                <span className="modal-ep-desc">{ep.overview}</span>
                                                            </div>

                                                            {hasLocal ? (
                                                                <div className="ep-action-btns">
                                                                    {isNative && (
                                                                        <button
                                                                            className={`ep-download-btn ${isDownloading[epKey] ? 'downloading' : ''}`}
                                                                            onClick={(e) => handleDownload(e, ep, 'episode')}
                                                                            title="Download Episode"
                                                                            disabled={isDownloading[epKey]}
                                                                            style={{ position: 'relative', width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                                                        >
                                                                            {isDownloading[epKey] ? (
                                                                                <div style={{ position: 'relative', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                                    <svg width="24" height="24" viewBox="0 0 24 24" style={{ transform: 'rotate(-90deg)' }}>
                                                                                        <circle
                                                                                            cx="12"
                                                                                            cy="12"
                                                                                            r="10"
                                                                                            fill="none"
                                                                                            stroke="#333"
                                                                                            strokeWidth="2"
                                                                                        />
                                                                                        <circle
                                                                                            cx="12"
                                                                                            cy="12"
                                                                                            r="10"
                                                                                            fill="none"
                                                                                            stroke="#fff"
                                                                                            strokeWidth="2"
                                                                                            strokeDasharray="63"
                                                                                            strokeDashoffset={63 - ((downloadProgress[epKey] || 0) / 100) * 63}
                                                                                            strokeLinecap="round"
                                                                                            style={{ transition: 'stroke-dashoffset 0.3s ease' }}
                                                                                        />
                                                                                    </svg>
                                                                                    {/* Optional: Tiny text for percentage, might be too small for list items */}
                                                                                </div>
                                                                            ) : (
                                                                                <FaDownload />
                                                                            )}
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        className="ep-play-btn"
                                                                        onClick={(e) => { e.stopPropagation(); handleEpisodePlay(selectedSeason, ep.episode_number, resumeTime); }}
                                                                        title={resumeTime > 0 ? "Resume" : "Play"}
                                                                    >
                                                                        {resumeTime > 0 ? <FaPlay style={{ fontSize: '0.8rem' }} /> : <FaPlay />}
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <div className="ep-action-btns">
                                                                    <button
                                                                        className="ep-download-btn"
                                                                        onClick={(e) => requestEpisodeDownload(e, selectedSeason, ep.episode_number, ep.name)}
                                                                        title="Request Download"
                                                                    >
                                                                        <FaDownload />
                                                                    </button>
                                                                    <button
                                                                        className="ep-stream-btn"
                                                                        onClick={(e) => { e.stopPropagation(); handleEpisodePlay(selectedSeason, ep.episode_number, resumeTime); }}
                                                                        title="Stream"
                                                                    >
                                                                        <FaPlay />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        }

                        {/* More Like This */}
                        {
                            similar.length > 0 && (
                                <div className="content-modal-section">
                                    <div className="modal-recommendations">
                                        <h3 className="modal-section-title">More Like This</h3>
                                        <div className="modal-rec-grid">
                                            {similar.slice(0, 12).map(s => (
                                                <div key={s.id} className="modal-rec-card" onClick={() => openSimilarItem(s, isMovie ? 'movie' : 'tv')}>
                                                    <div className="modal-rec-poster">
                                                        <img src={getImageUrl(s.poster_path, 'w342')} alt={s.title || s.name} />
                                                    </div>
                                                    <div className="modal-rec-info">
                                                        <span className="modal-rec-match">98% Match</span>
                                                        <span className="modal-rec-year">
                                                            {(s.release_date || s.first_air_date || '').split('-')[0]}
                                                        </span>
                                                    </div>
                                                    <p className="modal-rec-title">{s.title || s.name}</p>
                                                    <p className="modal-rec-desc">
                                                        {s.overview?.slice(0, 100)}{s.overview?.length > 100 ? '…' : ''}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                    </>
                )}


                <button className="content-modal-close" onClick={onClose}>
                    <FaTimes />
                </button>
            </div>
        </div>
    );
}

export default ContentModal;
