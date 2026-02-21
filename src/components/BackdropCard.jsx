import React from 'react';
import { FaCheckCircle } from 'react-icons/fa';
import { getImageUrl } from '../services/tmdb';
import '../pages/AllMedia.css'; // Reuse the styles

function BackdropCard({ item, type, badge, onClick }) {
    const backdropPath = item.backdrop_path || item.poster_path;
    const backdropUrl = backdropPath ? getImageUrl(backdropPath, 'w780') : null;
    const title = item.title || item.name;

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' || e.code === 'Space') {
            e.preventDefault();
            if (onClick) onClick(item);
        }
    };

    return (
        <div
            className="nf-backdrop-card"
            onClick={() => onClick && onClick(item)}
            onKeyDown={handleKeyDown}
            role="button"
            tabIndex={0}
            style={{ width: '100%', height: '100%' }}
        >
            <div className="nf-backdrop-img">
                {backdropUrl ? (
                    <img src={backdropUrl} alt={title} loading="lazy" />
                ) : (
                    <div className="nf-backdrop-placeholder">{title}</div>
                )}
                <div className="nf-backdrop-gradient" />
                <div className="nf-backdrop-title">{title}</div>

                {/* Badges */}
                <div className="nf-backdrop-badges">
                    {badge === 'new-season' && (
                        <span className="nf-badge nf-badge-new">New Season</span>
                    )}
                    {badge === 'coming-soon' && (
                        <span className="nf-badge nf-badge-soon">Coming Soon</span>
                    )}
                    {badge === 'watched' && (
                        <span className="nf-badge nf-badge-watched"><FaCheckCircle /> Watched</span>
                    )}
                    {badge === 'local' && (
                        // Optional: visual indicator for local content if needed, 
                        // but usually we rely on the row title "Your Movies"
                        null
                    )}
                </div>
            </div>
        </div>
    );
}

export default BackdropCard;
