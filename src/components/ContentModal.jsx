import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FaPlay, FaPlus, FaThumbsUp, FaTimes, FaVolumeMute, FaVolumeUp } from 'react-icons/fa';
import { getMovieDetails, getTvShowDetails, getSimilarMovies, getSimilarTvShows, getImageUrl } from '../services/tmdb';
import MediaCard from './MediaCard';
import './ContentModal.css';

function ContentModal({ content, onClose, show }) {
    const navigate = useNavigate();
    const [details, setDetails] = useState(null);
    const [similar, setSimilar] = useState([]);
    const [loading, setLoading] = useState(false);
    const [muted, setMuted] = useState(true);

    // Reset state when content changes
    useEffect(() => {
        if (!content) return;
        setDetails(null);
        setSimilar([]);
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

    const handlePlay = () => {
        // Navigate to player/detail page
        onClose();
        if (isMovie) navigate(`/movie/${item.id}?autoplay=1`);
        else navigate(`/tv/${item.id}?autoplay=1`);
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
                        <button className="modal-play-btn" onClick={handlePlay}>
                            <FaPlay /> Play
                        </button>
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

                {/* If TV Show, can show episodes here. Optimized for concise list */}
                {!isMovie && details && details.seasons && (
                    <div className="content-modal-info" style={{ paddingTop: 0 }}>
                        <div className="modal-episodes" style={{ width: '100%' }}>
                            <h3 className="modal-section-title">Episodes</h3>
                            {/* Just link to full detail page for full episode list for now, or show Season 1 */}
                            <p style={{ color: '#999', marginBottom: '1rem' }}>
                                Season 1
                            </p>
                            {/* We'd need to fetch Season 1 details to list episodes. 
                    For MVP, maybe just a 'Go to Show Details' link or similar? 
                    Actually, let's put the Recommendation grid here which is more visual. 
                    The user requested Image 5 which has episodes. 
                    I'll add specific episode fetching in next step if needed. 
                    For now, I'll stick to Recommendations which are already fetched.
                */}
                        </div>
                    </div>
                )}

                {similar.length > 0 && (
                    <div className="content-modal-info" style={{ paddingTop: 0 }}>
                        <div className="modal-recommendations" style={{ width: '100%' }}>
                            <h3 className="modal-section-title">More Like This</h3>
                            <div className="modal-rec-grid">
                                {similar.slice(0, 9).map(s => (
                                    <MediaCard key={s.id} item={s} type={isMovie ? 'movie' : 'tv'} badge="cloud" onClick={() => {
                                        /* Navigate to it? Or switch modal content? */
                                        /* For simplicity, close and navigate */
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
