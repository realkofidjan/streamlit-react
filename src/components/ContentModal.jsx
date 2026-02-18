import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlay, FaPlus, FaThumbsUp, FaTimes, FaDownload, FaChevronDown } from 'react-icons/fa';
import { getMovieDetails, getTvShowDetails, getSimilarMovies, getSimilarTvShows, getImageUrl, getTvSeasonDetails } from '../services/tmdb';
import MediaCard from './MediaCard';
import './ContentModal.css';

function ContentModal({ content, onClose, show }) {
    const navigate = useNavigate();
    const [details, setDetails] = useState(null);
    const [similar, setSimilar] = useState([]);
    const [seasonDetails, setSeasonDetails] = useState(null);
    const [selectedSeason, setSelectedSeason] = useState(1);
    const [loading, setLoading] = useState(false);
    const [showSeasonDropdown, setShowSeasonDropdown] = useState(false);

    // Reset state when content changes
    useEffect(() => {
        if (!content) return;
        setDetails(null);
        setSimilar([]);
        setSeasonDetails(null);
        setSelectedSeason(1);
        setLoading(true);

        // Disable body scroll
        document.body.style.overflow = 'hidden';

        const fetchInfo = async () => {
            try {
                const isMovie = content.type === 'movie';
                const id = content.id;

                let detailRes, similarRes;
                if (isMovie) {
                    [detailRes, similarRes] = await Promise.all([
                        getMovieDetails(id),
                        getSimilarMovies(id).catch(() => ({ data: { results: [] } }))
                    ]);
                } else {
                    [detailRes, similarRes] = await Promise.all([
                        getTvShowDetails(id),
                        getSimilarTvShows(id).catch(() => ({ data: { results: [] } }))
                    ]);
                }

                setDetails(detailRes.data);
                setSimilar(similarRes.data.results || []);

                if (!isMovie) {
                    // Fetch Season 1 by default
                    const seasonRes = await getTvSeasonDetails(id, 1).catch(() => null);
                    if (seasonRes) setSeasonDetails(seasonRes.data);
                }

            } catch (err) {
                console.error("Failed to fetch modal details", err);
            } finally {
                setLoading(false);
            }
        };

        fetchInfo();

        return () => {
            document.body.style.overflow = '';
        };
    }, [content]);

    // Handle season change
    const handleSeasonChange = async (seasonNum) => {
        setSelectedSeason(seasonNum);
        setShowSeasonDropdown(false);
        if (details) {
            try {
                const res = await getTvSeasonDetails(details.id, seasonNum);
                setSeasonDetails(res.data);
            } catch (e) {
                console.error("Failed to fetch season", e);
            }
        }
    };

    if (!show || !content) return null;

    const item = details || content;
    const isMovie = content.type === 'movie';
    const backdrop = getImageUrl(item.backdrop_path, 'original');
    const title = isMovie ? item.title : item.name;
    const year = isMovie
        ? (item.release_date?.split('-')[0] || '')
        : (item.first_air_date?.split('-')[0] || '');

    const runtime = isMovie
        ? (item.runtime ? `${Math.floor(item.runtime / 60)}h ${item.runtime % 60}m` : '')
        : (item.number_of_seasons ? `${item.number_of_seasons} Season${item.number_of_seasons > 1 ? 's' : ''}` : '');

    const handlePlay = (episodeId = null) => {
        onClose();
        if (isMovie) navigate(`/movie/${item.id}?autoplay=1`);
        else {
            // If episodeId provided, deep link? Or just go to show?
            navigate(`/tv/${item.id}?autoplay=1`);
        }
    };

    const handleDownload = (e, targetItem) => {
        e.stopPropagation();
        console.log("Downloading...", targetItem);
        // Implementation hook for later
        alert(`Download started for: ${targetItem.name || targetItem.title}`);
    };

    const handleBackdropClick = (e) => {
        if (e.target.className === 'content-modal-overlay') {
            onClose();
        }
    };

    return (
        <div className="content-modal-overlay" onClick={handleBackdropClick}>
            <div className="content-modal">
                <button className="content-modal-close" onClick={onClose} aria-label="Close">
                    <FaTimes />
                </button>

                <div className="content-modal-hero">
                    {backdrop && <img src={backdrop} alt={title} className="content-modal-backdrop" />}

                    <div className="content-modal-gradient" />

                    <div className="content-modal-controls">
                        <button className="modal-play-btn" onClick={() => handlePlay()}>
                            <FaPlay /> Play
                        </button>
                        {/* Movie Download Button aligned on same line */}
                        {isMovie && (
                            <button className="modal-icon-btn" title="Download" onClick={(e) => handleDownload(e, item)}>
                                <FaDownload />
                            </button>
                        )}
                        <button className="modal-icon-btn" title="Add to My List">
                            <FaPlus />
                        </button>
                        <button className="modal-icon-btn" title="I like this">
                            <FaThumbsUp />
                        </button>
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
                {!isMovie && details && (
                    <div className="content-modal-info" style={{ paddingTop: 0 }}>
                        <div className="modal-episodes" style={{ width: '100%' }}>
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
                                    {seasonDetails.episodes.map(ep => (
                                        <div key={ep.id} className="modal-ep-row" onClick={() => {
                                            // Navigate to specific episode?
                                            // For now, simple play
                                            // navigate(`/tv/${item.id}/season/${selectedSeason}/episode/${ep.episode_number}`);
                                            onClose();
                                            navigate(`/tv/${item.id}?season=${selectedSeason}&episode=${ep.episode_number}&autoplay=1`);
                                        }}>
                                            <span className="modal-ep-num">{ep.episode_number}</span>
                                            <img src={getImageUrl(ep.still_path, 'w300')} alt={ep.name} className="modal-ep-thumb" />
                                            <div className="modal-ep-info">
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span className="modal-ep-title">{ep.name}</span>
                                                    <span className="modal-ep-dur">{ep.runtime ? `${ep.runtime}m` : ''}</span>
                                                </div>
                                                <span className="modal-ep-desc">{ep.overview}</span>
                                            </div>
                                            {/* Download Button for Episode */}
                                            <button className="ep-download-btn" onClick={(e) => handleDownload(e, ep)}>
                                                <FaDownload />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* More Like This - Always ensure it's here */}
                {similar.length > 0 && (
                    <div className="content-modal-info" style={{ paddingTop: 0 }}>
                        <div className="modal-recommendations" style={{ width: '100%' }}>
                            <h3 className="modal-section-title">More Like This</h3>
                            <div className="modal-rec-grid">
                                {similar.slice(0, 9).map(s => (
                                    <MediaCard key={s.id} item={s} type={isMovie ? 'movie' : 'tv'} badge="cloud" onClick={() => {
                                        onClose();
                                        navigate(isMovie ? `/movie/${s.id}` : `/tv/${s.id}`);
                                    }} />
                                ))}
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}

export default ContentModal;
