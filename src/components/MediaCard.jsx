import { Link } from 'react-router-dom';
import { FaStar, FaHdd, FaCloud, FaCheckCircle } from 'react-icons/fa';
import { getImageUrl } from '../services/tmdb';
import { useUser } from '../contexts/UserContext';
import './MediaCard.css';

function MediaCard({ item, type, badge }) {
  const { currentUser } = useUser();
  const watchHistory = currentUser?.watchHistory || { movies: {}, episodes: {} };

  // Check if this local item has been watched (>= 95% progress)
  const isLocal = badge === 'local' || (badge && typeof badge === 'object');
  let isWatched = false;
  if (isLocal && type === 'movie') {
    const entry = watchHistory.movies?.[String(item.id)];
    if (entry && entry.progress >= 0.95) isWatched = true;
  }
  if (isLocal && type === 'tv') {
    // Check if any episode of this show has been fully watched
    const episodes = watchHistory.episodes || {};
    isWatched = Object.entries(episodes).some(
      ([key, val]) => key.startsWith(`${item.id}-`) && val.progress >= 0.95
    );
  }
  const title = type === 'movie' ? item.title : item.name;
  const date = type === 'movie' ? item.release_date : item.first_air_date;
  const link = type === 'movie' ? `/movie/${item.id}` : `/tv/${item.id}`;
  const posterUrl = getImageUrl(item.poster_path, 'w342');
  const year = date ? new Date(date).getFullYear() : 'N/A';

  return (
    <Link to={link} className="media-card">
      <div className="media-card-poster">
        {posterUrl ? (
          <img src={posterUrl} alt={title} loading="lazy" />
        ) : (
          <div className="media-card-no-image">No Image</div>
        )}
        <div className="media-card-overlay">
          <div className="media-card-rating">
            <FaStar />
            <span>{item.vote_average?.toFixed(1)}</span>
          </div>
        </div>
        {(badge === 'local' || (badge && typeof badge === 'object')) && (
          <div className="media-card-drive-icon"><FaHdd /></div>
        )}
        {badge === 'cloud' && (
          <div className="media-card-drive-icon cloud"><FaCloud /></div>
        )}
        {badge && typeof badge === 'object' && badge.type === 'new-episodes' && (
          <div className="media-card-badge-bottom new-aired">New Aired</div>
        )}
        {badge && typeof badge === 'object' && badge.type === 'coming-soon' && (
          <div className="media-card-badge-bottom airing-soon">Airing Soon</div>
        )}
        {isWatched && (
          <div className="media-card-watched-badge"><FaCheckCircle /> Watched</div>
        )}
      </div>
      <div className="media-card-info">
        <h3 className="media-card-title">{title}</h3>
        <p className="media-card-year">{year}</p>
      </div>
    </Link>
  );
}

export default MediaCard;
