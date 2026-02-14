import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import MovieDetail from './pages/MovieDetail';
import TvShowDetail from './pages/TvShowDetail';
import TvSeasonDetail from './pages/TvSeasonDetail';
import TvEpisodeDetail from './pages/TvEpisodeDetail';
import SearchResults from './pages/SearchResults';
import Settings from './pages/Settings';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app">
        <Header />
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/movie/:id" element={<MovieDetail />} />
            <Route path="/tv/:id" element={<TvShowDetail />} />
            <Route path="/tv/:id/season/:seasonNumber" element={<TvSeasonDetail />} />
            <Route path="/tv/:id/season/:seasonNumber/episode/:episodeNumber" element={<TvEpisodeDetail />} />
            <Route path="/search" element={<SearchResults />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
