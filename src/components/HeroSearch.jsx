import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FaPlay, FaInfoCircle } from 'react-icons/fa';
import { getImageUrl } from '../services/tmdb';
import './HeroSearch.css';

function HeroBillboard({ item, type, onMoreInfo }) {
  const navigate = useNavigate();

  if (!item) return <div className="billboard-placeholder" />;

  const title = type === 'movie' ? item.title : item.name;
  const overview = item.overview?.length > 200
    ? item.overview.slice(0, 200) + '…'
    : item.overview;
  const backdrop = getImageUrl(item.backdrop_path, 'original');

  const handlePlay = () => {
    if (type === 'movie') {
      navigate(`/play?type=movie&id=${item.id}`);
    } else {
      // For TV shows, play first episode — More Info is better for browsing episodes
      navigate(`/play?type=episode&id=${item.id}&season=1&episode=1`);
    }
  };

  const handleMoreInfo = () => {
    if (onMoreInfo) {
      onMoreInfo(item, type);
    }
  };

  return (
    <section className="billboard">
      <AnimatePresence mode="wait">
        <motion.div
          key={item.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          className="billboard-motion-wrapper"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'flex-end'
          }}
        >
          {backdrop && (
            <img
              className="billboard-bg"
              src={backdrop}
              alt=""
              draggable={false}
            />
          )}
          <div className="billboard-gradient-bottom" />
          <div className="billboard-gradient-left" />

          <div className="billboard-content">
            <h1 className="billboard-title">{title}</h1>
            {overview && <p className="billboard-overview">{overview}</p>}
            <div className="billboard-actions">
              <button
                className="billboard-btn billboard-btn-play"
                autoFocus
                onClick={handlePlay}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.code === 'Space') {
                    handlePlay();
                  } else if (e.key === 'ArrowDown') {
                    // Help TV D-pad find the first row below the huge billboard
                    document.querySelector('.nf-rows-container .nf-card, .nf-rows-container .nf-backdrop-card, .nf-rows-container .continue-card')?.focus();
                  }
                }}
              >
                <FaPlay /> Play
              </button>
              <button
                className="billboard-btn billboard-btn-info"
                onClick={handleMoreInfo}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.code === 'Space') {
                    handleMoreInfo();
                  } else if (e.key === 'ArrowDown') {
                    // Help TV D-pad find the first row below the huge billboard
                    document.querySelector('.nf-rows-container .nf-card, .nf-rows-container .nf-backdrop-card, .nf-rows-container .continue-card')?.focus();
                  }
                }}
              >
                <FaInfoCircle /> More Info
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

export default HeroBillboard;
