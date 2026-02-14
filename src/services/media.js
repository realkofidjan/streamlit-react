import axios from 'axios';

const MEDIA_URL = import.meta.env.VITE_MEDIA_SERVER_URL || 'http://localhost:4000';

const api = axios.create({ baseURL: MEDIA_URL });

// Movies
export const searchLocalMovies = (query) =>
  api.get('/api/movies/search', { params: { q: query } });

export const getLocalMovieStreamUrl = (filename) =>
  `${MEDIA_URL}/api/movies/stream/${encodeURIComponent(filename)}`;

// TV Shows
export const searchLocalTvShows = (query) =>
  api.get('/api/tv/search', { params: { q: query } });

export const getLocalTvSeasons = (showName) =>
  api.get(`/api/tv/${encodeURIComponent(showName)}/seasons`);

export const getLocalTvEpisodes = (showName, seasonName) =>
  api.get(`/api/tv/${encodeURIComponent(showName)}/${encodeURIComponent(seasonName)}/episodes`);

export const getLocalTvStreamUrl = (showName, seasonName, filename) =>
  `${MEDIA_URL}/api/tv/${encodeURIComponent(showName)}/${encodeURIComponent(seasonName)}/stream/${encodeURIComponent(filename)}`;
