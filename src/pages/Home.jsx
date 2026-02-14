import { useState, useEffect } from 'react';
import HeroSearch from '../components/HeroSearch';
import MediaCard from '../components/MediaCard';
import { getNowPlayingMovies, getAiringTodayTvShows } from '../services/tmdb';
import './Home.css';

function Home() {
  const [nowPlaying, setNowPlaying] = useState([]);
  const [airingToday, setAiringToday] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [moviesRes, tvRes] = await Promise.all([
          getNowPlayingMovies(),
          getAiringTodayTvShows(),
        ]);
        setNowPlaying(moviesRes.data.results);
        setAiringToday(tvRes.data.results);
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <>
        <HeroSearch />
        <div className="loading-spinner">
          <div className="spinner" />
        </div>
      </>
    );
  }

  return (
    <>
      <HeroSearch />

      <section className="section">
        <div className="container">
          <h2 className="section-title">Movies Now Playing</h2>
          <div className="card-grid">
            {nowPlaying.map((movie) => (
              <MediaCard key={movie.id} item={movie} type="movie" />
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="section-title">TV Shows Airing Today</h2>
          <div className="card-grid">
            {airingToday.map((show) => (
              <MediaCard key={show.id} item={show} type="tv" />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

export default Home;
