import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { UserProvider, useUser } from './contexts/UserContext';
import Header from './components/Header';
import Footer from './components/Footer';
import ProfileSelect from './pages/ProfileSelect';
import Home from './pages/Home';
import MovieDetail from './pages/MovieDetail';
import TvShowDetail from './pages/TvShowDetail';
import TvSeasonDetail from './pages/TvSeasonDetail';
import TvEpisodeDetail from './pages/TvEpisodeDetail';
import SearchResults from './pages/SearchResults';
import AllMovies from './pages/AllMovies';
import AllTvShows from './pages/AllTvShows';
import Settings from './pages/Settings';
import './App.css';

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const pageTransition = {
  duration: 0.25,
  ease: [0.25, 0.1, 0.25, 1],
};

function PageWrapper({ children }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
    >
      {children}
    </motion.div>
  );
}

function AuthGuard({ children }) {
  const { currentUser, loading } = useUser();
  if (loading) return null;
  if (!currentUser) return <Navigate to="/profiles" replace />;
  return children;
}

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/profiles" element={<PageWrapper><ProfileSelect /></PageWrapper>} />
        <Route path="/" element={<AuthGuard><PageWrapper><Home /></PageWrapper></AuthGuard>} />
        <Route path="/movies" element={<AuthGuard><PageWrapper><AllMovies /></PageWrapper></AuthGuard>} />
        <Route path="/tv-shows" element={<AuthGuard><PageWrapper><AllTvShows /></PageWrapper></AuthGuard>} />
        <Route path="/movie/:id" element={<AuthGuard><PageWrapper><MovieDetail /></PageWrapper></AuthGuard>} />
        <Route path="/tv/:id" element={<AuthGuard><PageWrapper><TvShowDetail /></PageWrapper></AuthGuard>} />
        <Route path="/tv/:id/season/:seasonNumber" element={<AuthGuard><PageWrapper><TvSeasonDetail /></PageWrapper></AuthGuard>} />
        <Route path="/tv/:id/season/:seasonNumber/episode/:episodeNumber" element={<AuthGuard><PageWrapper><TvEpisodeDetail /></PageWrapper></AuthGuard>} />
        <Route path="/search" element={<AuthGuard><PageWrapper><SearchResults /></PageWrapper></AuthGuard>} />
        <Route path="/settings" element={<PageWrapper><Settings /></PageWrapper>} />
      </Routes>
    </AnimatePresence>
  );
}

function AppRoutes() {
  const { currentUser } = useUser();

  return (
    <>
      {currentUser && <Header />}
      <main>
        <AnimatedRoutes />
      </main>
      {currentUser && <Footer />}
    </>
  );
}

function App() {
  return (
    <Router>
      <UserProvider>
        <div className="app">
          <AppRoutes />
        </div>
      </UserProvider>
    </Router>
  );
}

export default App;
