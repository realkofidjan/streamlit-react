import { FaHdd, FaCloud, FaCheckCircle } from 'react-icons/fa';
import { getImageUrl } from '../services/tmdb';
import { useUser } from '../contexts/UserContext';
import './MediaCard.css';

function MediaCard({ item, type, badge, onClick }) {
  const { currentUser } = useUser();
  const watchHistory = currentUser?.watchHistory || { movies: {}, episodes: {} };

  const isLocal = badge === 'local' || (badge && typeof badge === 'object');
  let isWatched = false;
  if (isLocal && type === 'movie') {
    const entry = watchHistory.movies?.[String(item.id)];
    if (entry && entry.progress >= 0.96) isWatched = true;
  }
  if (isLocal && type === 'tv') {
    // Only show "Watched" if explicitly passed as true (calculated by parent)
    isWatched = item.isFullyWatched === true;
  }

  const title = type === 'movie' ? item.title : item.name;
  const posterUrl = getImageUrl(item.poster_path, 'w342');

  const handleClick = () => {
    if (onClick) onClick(item);
  };

  return (
    <div className="nf-card" onClick={handleClick} role="button" tabIndex={0}>
      <div className="nf-card-img">
        {posterUrl ? (
          <img src={posterUrl} alt={title} loading="lazy" />
        ) : (
          <div className="nf-card-no-img">{title}</div>
        )}

        {/* Source icon */}
        {(badge === 'local' || (badge && typeof badge === 'object')) && (
          <span className="nf-card-icon nf-card-icon-local"><FaHdd /></span>
        )}
        {badge === 'cloud' && (
          <span className="nf-card-icon nf-card-icon-cloud"><FaCloud /></span>
        )}

        {/* Status badges */}
        {badge && typeof badge === 'object' && badge.type === 'new-episodes' && (
          <span className="nf-card-badge nf-card-badge-new">New Episodes</span>
        )}
        {badge && typeof badge === 'object' && badge.type === 'coming-soon' && (
          <span className="nf-card-badge nf-card-badge-soon">Coming Soon</span>
        )}
        {isWatched && (
          <span className="nf-card-badge nf-card-badge-watched"><FaCheckCircle /> Watched</span>
        )}

        {/* Hover overlay with title */}
        <div className="nf-card-hover">
          <span className="nf-card-title">{title}</span>
        </div>
      </div>
    </div>
  );
}

export default MediaCard;
