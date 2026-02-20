import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import HeroBillboard from '../components/HeroSearch';
import MediaCard from '../components/MediaCard';
import BackdropCard from '../components/BackdropCard';
import ContentModal from '../components/ContentModal';
import { useUser } from '../contexts/UserContext';
import {
  getLibraryMetadata,
  searchLocalMovies, getLocalMovieStreamUrl,
  searchLocalTvShows, getLocalTvSeasons, getLocalTvEpisodes, getLocalTvStreamUrl,
} from '../services/media';
import { searchMovies, searchTvShows, getTvShowDetails, getRecommendedMovies, getRecommendedTvShows, getTrendingDay, getImageUrl } from '../services/tmdb';
import { cleanName, extractYear, pickBestResult } from '../utils/matchTmdb';
import { isVideoOffline, getOfflineVideos, removeOfflineVideo, formatFileSize } from '../services/offlineStorage';
import { searchSubtitles, fetchSubtitleUrl } from '../services/subtitles';
import { FaChevronLeft, FaChevronRight, FaTimes } from 'react-icons/fa';
import './Home.css';

/* ===== Scrollable Netflix Row ===== */
function NetflixRow({ title, children, count, className }) {
  const rowRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    const el = rowRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 20);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 20);
  };

  useEffect(() => {
    checkScroll();
    const el = rowRef.current;
    if (el) el.addEventListener('scroll', checkScroll, { passive: true });
    return () => el?.removeEventListener('scroll', checkScroll);
  }, [children]);

  const scroll = (dir) => {
    const el = rowRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.8;
    el.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  return (
    <section className="nf-section">
      <h2 className="nf-section-title">
        {title}
        {count != null && <span className="nf-section-count">{count}</span>}
      </h2>
      <div className={`nf-row-wrapper ${className || ''}`}>
        {canScrollLeft && (
          <button className="nf-row-arrow nf-row-arrow-left" onClick={() => scroll('left')}>
            <FaChevronLeft />
          </button>
        )}
        <div className="nf-row" ref={rowRef}>
          {children}
        </div>
        {canScrollRight && (
          <button className="nf-row-arrow nf-row-arrow-right" onClick={() => scroll('right')}>
            <FaChevronRight />
          </button>
        )}
      </div>
    </section>
  );
}

import { useQuery } from '@tanstack/react-query';

// ... imports remain the same

function Home() {
  const { currentUser, clearContinueWatching } = useUser();
  const [offlineVideos, setOfflineVideos] = useState([]);
  const [selectedContent, setSelectedContent] = useState(null);
  const navigate = useNavigate();

  const openModal = (item, type) => {
    setSelectedContent({ ...item, type: type || item.media_type || 'movie' });
  };
  const closeModal = () => setSelectedContent(null);

  useEffect(() => {
    setOfflineVideos(getOfflineVideos());
  }, []);

  // Fetch unified library metadata from the backend
  const { data: metaData, isLoading: metaLoading } = useQuery({
    queryKey: ['libraryMetadata'],
    queryFn: () => getLibraryMetadata().then(res => res.data).catch(() => ({ movies: [], tvShows: [], tvBadges: {} })),
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
  });

  const { data: recommendedMovies = [], isLoading: recMovLoading } = useQuery({
    queryKey: ['recommendedMovies'],
    queryFn: () => getRecommendedMovies().then(res => res.data.results || []).catch(() => []),
    staleTime: 1000 * 60 * 30, // 30 mins
  });

  const { data: recommendedTv = [], isLoading: recTvLoading } = useQuery({
    queryKey: ['recommendedTv'],
    queryFn: () => getRecommendedTvShows().then(res => res.data.results || []).catch(() => []),
    staleTime: 1000 * 60 * 30,
  });

  const { data: trending = [], isLoading: trendLoading } = useQuery({
    queryKey: ['trending'],
    queryFn: () => getTrendingDay().then(res => res.data.results || []).catch(() => []),
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  const localMovieTmdb = metaData?.movies || [];
  const localTvTmdb = metaData?.tvShows || [];
  const tvBadges = metaData?.tvBadges || {};

  const loading = metaLoading || recMovLoading || recTvLoading || trendLoading;

  const localMovieIds = new Set(localMovieTmdb.map((m) => m.id));
  const localTvIds = new Set(localTvTmdb.map((s) => s.id));
  const filteredRecMovies = recommendedMovies.filter((m) => !localMovieIds.has(m.id));
  const filteredRecTv = recommendedTv.filter((s) => !localTvIds.has(s.id));

  /* ===== Logic for Continue Watching & Next Episode ===== */
  const watchHistory = currentUser?.watchHistory || { movies: {}, episodes: {} };

  // 1. Get currently "watching" items
  const watchingMovies = Object.entries(watchHistory.movies)
    .filter(([, v]) => v.status === 'watching')
    .map(([id, v]) => ({ ...v, mediaId: id, type: 'movie' }));

  const watchingEpisodes = Object.entries(watchHistory.episodes)
    .filter(([, v]) => v.status === 'watching')
    .map(([id, v]) => ({ ...v, mediaId: id, type: 'episode' }));

  // 2. Logic for "Next Episode": specific to TV Shows
  // If a show has NO "watching" episodes, find the latest "watched" episode and suggest the Next one.
  const nextUpEpisodes = [];
  const watchingShowIds = new Set(watchingEpisodes.map(e => e.showId).filter(Boolean));

  // Group watched episodes by Show ID
  const latestWatchedByShow = {};
  Object.values(watchHistory.episodes).forEach(ep => {
    if (ep.status === 'watched' && ep.showId) {
      const current = latestWatchedByShow[ep.showId];
      // Keep the most recently watched one
      if (!current || new Date(ep.updatedAt) > new Date(current.updatedAt)) {
        latestWatchedByShow[ep.showId] = ep;
      }
    }
  });

  // Generate "Next Up" items
  for (const [showId, lastEp] of Object.entries(latestWatchedByShow)) {
    // Skip if we are mid-episode on this show already
    if (watchingShowIds.has(showId)) continue;

    const nextEpNum = parseInt(lastEp.episode) + 1;
    nextUpEpisodes.push({
      mediaId: `${showId}-s${lastEp.season}e${nextEpNum}`,
      showId: showId,
      season: lastEp.season,
      episode: nextEpNum,
      type: 'episode',
      status: 'next-up', // Custom status for UI
      progress: 0,
      // We don't know the real title of the next episode here without querying TMDB/Local
      // But we can just show "Season X Episode Y"
      title: `S${lastEp.season} E${nextEpNum}`,
      posterPath: lastEp.posterPath, // Reuse show poster
      updatedAt: lastEp.updatedAt // Sort by when we finished the last one
    });
  }

  const handleRemoveOffline = (e, key) => {
    e.stopPropagation();
    if (window.confirm('Delete this download?')) {
      removeOfflineVideo(key);
      setOfflineVideos(getOfflineVideos());
    }
  };

  const continueWatchingRaw = [
    ...watchingMovies,
    ...watchingEpisodes,
    ...nextUpEpisodes
  ].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  const seenKeys = new Set();
  const continueWatching = continueWatchingRaw.filter((item) => {
    const key = item.type === 'episode' && item.showId ? `show-${item.showId}` : item.mediaId;
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });

  const userWatchlist = currentUser?.watchlist || { movies: {}, shows: {} };
  const watchlistItems = [
    ...Object.entries(userWatchlist.movies).map(([id, v]) => ({
      id: Number(id), title: v.title, poster_path: v.posterPath, addedAt: v.addedAt, _type: 'movie',
    })),
    ...Object.entries(userWatchlist.shows).map(([id, v]) => ({
      id: Number(id), name: v.title, poster_path: v.posterPath, addedAt: v.addedAt, _type: 'tv',
    })),
  ].sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));

  // Pick random featured items for the billboard and cycle
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const featuredCandidates = useMemo(() => {
    // ONLY use trending items as requested
    return trending
      .filter((t) => t.backdrop_path && (t.media_type === 'movie' || t.media_type === 'tv'))
      .map((t) => ({ ...t, _type: t.media_type }))
      .slice(0, 10);
  }, [trending]);

  useEffect(() => {
    if (featuredCandidates.length <= 1) return;
    const interval = setInterval(() => {
      setFeaturedIndex((prev) => (prev + 1) % featuredCandidates.length);
    }, 8000); // 8 seconds cycle
    return () => clearInterval(interval);
  }, [featuredCandidates]);

  const featured = featuredCandidates[featuredIndex];

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="home-page">
      <HeroBillboard item={featured} type={featured?._type || 'movie'} onMoreInfo={(item, type) => openModal(item, type)} />

      <div className="nf-rows-container">
        {filteredRecMovies.length > 0 && (
          <NetflixRow title="Popular Movies">
            {filteredRecMovies.slice(0, 20).map((m) => (
              <MediaCard key={m.id} item={m} type="movie" onClick={(i) => openModal(i, 'movie')} />
            ))}
          </NetflixRow>
        )}

        {filteredRecTv.length > 0 && (
          <NetflixRow title="Popular TV Shows">
            {filteredRecTv.slice(0, 20).map((s) => (
              <MediaCard key={s.id} item={s} type="tv" onClick={(i) => openModal(i, 'tv')} />
            ))}
          </NetflixRow>
        )}

        {offlineVideos.length > 0 && (
          <NetflixRow title="Downloads" count={offlineVideos.length}>
            {offlineVideos.map((v) => (
              <div key={v.key} className="offline-card-container">
                <MediaCard
                  item={{
                    ...v,
                    id: v.tmdbId || v.id,
                    title: v.title,
                    name: v.title,
                    poster_path: v.posterPath
                  }}
                  type={v.type}
                  onClick={() => {
                    const url = v.type === 'movie'
                      ? `/play?type=movie&id=${v.id || v.tmdbId}`
                      : `/play?type=episode&id=${v.showId}&season=${v.season}&episode=${v.episode}`;
                    navigate(url);
                  }}
                />
                <button className="remove-offline-btn" onClick={(e) => handleRemoveOffline(e, v.key)} title="Delete Download">
                  <FaTimes />
                </button>
              </div>
            ))}
          </NetflixRow>
        )}

        {continueWatching.length > 0 && (
          <section className="nf-section">
            <div className="nf-section-header-row">
              <h2 className="nf-section-title">Continue Watching</h2>
              <button className="clear-watching-btn" onClick={clearContinueWatching}>Clear All</button>
            </div>
            <div className="nf-row-wrapper">
              <div className="nf-row">
                {continueWatching.slice(0, 10).map((item) => {
                  let linkTo;
                  const t = item.currentTime ? `&t=${item.currentTime}` : '';
                  if (item.type === 'movie') {
                    linkTo = `/play?type=movie&id=${item.mediaId}${t}`;
                  } else if (item.showId && item.season && item.episode) {
                    linkTo = `/play?type=episode&id=${item.showId}&season=${item.season}&episode=${item.episode}${t}`;
                  } else {
                    const match = item.mediaId.match(/^(\d+)-s(\d+)e(\d+)$/);
                    if (match) {
                      linkTo = `/play?type=episode&id=${match[1]}&season=${match[2]}&episode=${match[3]}${t}`;
                    } else {
                      linkTo = `/play?type=movie&id=${item.mediaId}`;
                    }
                  }
                  const isNextUp = item.status === 'next-up';
                  return (
                    <Link key={item.mediaId} to={linkTo} className={`continue-card ${isNextUp ? 'next-up-card' : ''}`}>
                      {item.posterPath ? (
                        <img src={getImageUrl(item.posterPath, 'w300')} alt={item.title} />
                      ) : (
                        <div className="continue-no-img">{item.title}</div>
                      )}

                      {/* Only show progress bar if not "Next Up" */}
                      {!isNextUp && (
                        <div className="continue-progress">
                          <div className="continue-bar" style={{ width: `${(item.progress || 0) * 100}%` }} />
                        </div>
                      )}

                      <div className="continue-overlay">
                        {isNextUp && <div className="next-up-badge">Next Episode</div>}
                        <div className="continue-title">{item.title}</div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        )}





        {watchlistItems.length > 0 && (
          <NetflixRow title="My List" count={watchlistItems.length}>
            {watchlistItems.map((item) => (
              <MediaCard key={`${item._type}-${item.id}`} item={item} type={parseInt(item._type) === item._type ? (item._type === 'movie' ? 'movie' : 'tv') : item._type} onClick={(i) => openModal(i, item._type)} />
            ))}
          </NetflixRow>
        )}

        {offlineVideos.length > 0 && (
          <NetflixRow title="Downloaded" count={offlineVideos.length}>
            {offlineVideos.map((v) => (
              <Link key={v.key} to={v.linkTo} className="offline-card">
                {v.posterPath ? (
                  <img src={getImageUrl(v.posterPath, 'w300')} alt={v.title} />
                ) : (
                  <div className="offline-no-img">{v.title}</div>
                )}
                <span className="offline-card-title">{v.title}</span>
                <span className="offline-card-size">{formatFileSize(v.size)}</span>
              </Link>
            ))}
          </NetflixRow>
        )}



        {trending.length > 0 && (
          <NetflixRow title="Trending Now">
            {trending.filter((t) => t.backdrop_path).slice(0, 20).map((t) => (
              <MediaCard
                key={t.id}
                item={t}
                type={t.media_type === 'tv' ? 'tv' : 'movie'}
                onClick={(i) => openModal(i, t.media_type)}
              />
            ))}
          </NetflixRow>
        )}
      </div>

      <ContentModal
        key={selectedContent ? selectedContent.id : 'modal-closed'}
        show={!!selectedContent}
        content={selectedContent}
        onClose={closeModal}
      />
    </div>
  );
}

export default Home;
