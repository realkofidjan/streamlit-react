import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import HeroBillboard from '../components/HeroSearch';
import MediaCard from '../components/MediaCard';
import { useUser } from '../contexts/UserContext';
import { getLibrary } from '../services/media';
import { searchMovies, searchTvShows, getTvShowDetails, getRecommendedMovies, getRecommendedTvShows, getTrendingAll, getImageUrl } from '../services/tmdb';
import { cleanName, extractYear, pickBestResult } from '../utils/matchTmdb';
import { getOfflineVideos, removeOfflineVideo, formatFileSize } from '../services/offlineStorage';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import './Home.css';

/* ===== Scrollable Netflix Row ===== */
function NetflixRow({ title, children, count }) {
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
      <div className="nf-row-wrapper">
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

function Home() {
  const { currentUser, clearContinueWatching } = useUser();
  const [library, setLibrary] = useState({ movies: [], tvShows: [] });
  const [localMovieTmdb, setLocalMovieTmdb] = useState([]);
  const [localTvTmdb, setLocalTvTmdb] = useState([]);
  const [recommendedMovies, setRecommendedMovies] = useState([]);
  const [recommendedTv, setRecommendedTv] = useState([]);
  const [trending, setTrending] = useState([]);
  const [tvBadges, setTvBadges] = useState({});
  const [offlineVideos, setOfflineVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setOfflineVideos(getOfflineVideos());
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const [libRes, recMovies, recTv, trendRes] = await Promise.all([
          getLibrary().catch(() => ({ data: { movies: [], tvShows: [] } })),
          getRecommendedMovies().catch(() => ({ data: { results: [] } })),
          getRecommendedTvShows().catch(() => ({ data: { results: [] } })),
          getTrendingAll().catch(() => ({ data: { results: [] } })),
        ]);
        setLibrary(libRes.data);
        setRecommendedMovies(recMovies.data.results || []);
        setRecommendedTv(recTv.data.results || []);
        setTrending(trendRes.data.results || []);
      } catch {
        // Ignore
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Match local movies to TMDB
  useEffect(() => {
    if (library.movies.length === 0) return;
    const matchMovies = async () => {
      const results = [];
      for (let i = 0; i < library.movies.length; i += 5) {
        const batch = library.movies.slice(i, i + 5);
        const promises = batch.map(async (m) => {
          try {
            const year = extractYear(m.name);
            const res = await searchMovies(cleanName(m.name));
            const best = pickBestResult(res.data.results, year, 'release_date');
            if (best) return { ...best, localFilename: m.filename };
          } catch { /* skip */ }
          return null;
        });
        const batchResults = await Promise.all(promises);
        results.push(...batchResults.filter(Boolean));
      }
      const seen = new Set();
      setLocalMovieTmdb(results.filter((m) => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      }));
    };
    matchMovies();
  }, [library.movies]);

  // Match local TV shows to TMDB
  useEffect(() => {
    if (library.tvShows.length === 0) return;
    const matchTv = async () => {
      const results = [];
      for (let i = 0; i < library.tvShows.length; i += 5) {
        const batch = library.tvShows.slice(i, i + 5);
        const promises = batch.map(async (s) => {
          try {
            const year = extractYear(s.name);
            const res = await searchTvShows(cleanName(s.name));
            const best = pickBestResult(res.data.results, year, 'first_air_date');
            if (best) return { ...best, localName: s.name };
          } catch { /* skip */ }
          return null;
        });
        const batchResults = await Promise.all(promises);
        results.push(...batchResults.filter(Boolean));
      }
      const seen = new Set();
      setLocalTvTmdb(results.filter((s) => {
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      }));
    };
    matchTv();
  }, [library.tvShows]);

  // Compute TV show badges (new episodes / coming soon)
  useEffect(() => {
    if (localTvTmdb.length === 0) return;
    const computeBadges = async () => {
      const badges = {};
      const today = new Date().toISOString().split('T')[0];
      for (const show of localTvTmdb) {
        try {
          const res = await getTvShowDetails(show.id);
          const details = res.data;
          const nextEp = details.next_episode_to_air;
          const lastEp = details.last_episode_to_air;
          if (nextEp && nextEp.air_date > today) {
            badges[show.id] = { type: 'coming-soon', date: nextEp.air_date };
          } else if (details.status === 'Returning Series' && lastEp && lastEp.air_date) {
            const daysSinceLast = (Date.now() - new Date(lastEp.air_date).getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceLast < 14) {
              badges[show.id] = { type: 'new-episodes' };
            }
          }
          if (nextEp && nextEp.air_date <= today) {
            badges[show.id] = { type: 'new-episodes' };
          }
        } catch { /* skip */ }
      }
      setTvBadges(badges);
    };
    computeBadges();
  }, [localTvTmdb]);

  const localMovieIds = new Set(localMovieTmdb.map((m) => m.id));
  const localTvIds = new Set(localTvTmdb.map((s) => s.id));
  const filteredRecMovies = recommendedMovies.filter((m) => !localMovieIds.has(m.id));
  const filteredRecTv = recommendedTv.filter((s) => !localTvIds.has(s.id));

  const watchHistory = currentUser?.watchHistory || { movies: {}, episodes: {} };
  const continueWatchingRaw = [
    ...Object.entries(watchHistory.movies)
      .filter(([, v]) => v.status === 'watching')
      .map(([id, v]) => ({ ...v, mediaId: id, type: 'movie' })),
    ...Object.entries(watchHistory.episodes)
      .filter(([, v]) => v.status === 'watching')
      .map(([id, v]) => ({ ...v, mediaId: id, type: 'episode' })),
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

  // Pick a random featured item for the billboard
  const featured = useMemo(() => {
    // Prefer local movies/TV, then trending, then recommendations
    const candidates = [
      ...localMovieTmdb.filter((m) => m.backdrop_path).map((m) => ({ ...m, _type: 'movie' })),
      ...localTvTmdb.filter((s) => s.backdrop_path).map((s) => ({ ...s, _type: 'tv' })),
      ...trending.filter((t) => t.backdrop_path && (t.media_type === 'movie' || t.media_type === 'tv'))
        .map((t) => ({ ...t, _type: t.media_type })),
    ];
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * Math.min(candidates.length, 10))];
  }, [localMovieTmdb, localTvTmdb, trending]);

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="home-page">
      <HeroBillboard item={featured} type={featured?._type || 'movie'} />

      <div className="nf-rows-container">
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
                    linkTo = `/movie/${item.mediaId}?autoplay=1${t}`;
                  } else if (item.showId && item.season && item.episode) {
                    linkTo = `/tv/${item.showId}/season/${item.season}/episode/${item.episode}?autoplay=1${t}`;
                  } else {
                    const match = item.mediaId.match(/^(\d+)-s(\d+)e(\d+)$/);
                    if (match) {
                      linkTo = `/tv/${match[1]}/season/${match[2]}/episode/${match[3]}?autoplay=1${t}`;
                    } else {
                      linkTo = `/tv/${item.mediaId}`;
                    }
                  }
                  return (
                    <Link key={item.mediaId} to={linkTo} className="continue-card">
                      {item.posterPath ? (
                        <img src={getImageUrl(item.posterPath, 'w300')} alt={item.title} />
                      ) : (
                        <div className="continue-no-img">{item.title}</div>
                      )}
                      <div className="continue-progress">
                        <div className="continue-bar" style={{ width: `${(item.progress || 0) * 100}%` }} />
                      </div>
                      <span className="continue-title">{item.title}</span>
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
              <MediaCard key={`${item._type}-${item.id}`} item={item} type={item._type} />
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

        {localMovieTmdb.length > 0 && (
          <NetflixRow title="Your Movies" count={localMovieTmdb.length}>
            {localMovieTmdb.map((m) => (
              <MediaCard key={m.id} item={m} type="movie" badge="local" />
            ))}
          </NetflixRow>
        )}

        {localTvTmdb.length > 0 && (
          <NetflixRow title="Your TV Shows" count={localTvTmdb.length}>
            {localTvTmdb.map((s) => (
              <MediaCard key={s.id} item={s} type="tv" badge={tvBadges[s.id] || 'local'} />
            ))}
          </NetflixRow>
        )}

        {filteredRecMovies.length > 0 && (
          <NetflixRow title="Popular Movies">
            {filteredRecMovies.slice(0, 20).map((m) => (
              <MediaCard key={m.id} item={m} type="movie" badge="cloud" />
            ))}
          </NetflixRow>
        )}

        {filteredRecTv.length > 0 && (
          <NetflixRow title="Popular TV Shows">
            {filteredRecTv.slice(0, 20).map((s) => (
              <MediaCard key={s.id} item={s} type="tv" badge="cloud" />
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
                badge="cloud"
              />
            ))}
          </NetflixRow>
        )}
      </div>
    </div>
  );
}

export default Home;
