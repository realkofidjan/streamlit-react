import axios from 'axios';

const DEFAULT_URL = import.meta.env.VITE_MEDIA_SERVER_URL || 'http://localhost:4000';

export function getMediaUrl() {
  return localStorage.getItem('mediaServerUrl') || DEFAULT_URL;
}

export function setMediaUrl(url) {
  localStorage.setItem('mediaServerUrl', url);
}

function getApi() {
  return axios.create({ baseURL: getMediaUrl() });
}

// Movies
export const searchLocalMovies = (query) =>
  getApi().get('/api/movies/search', { params: { q: query } });

export const getLocalMovieStreamUrl = (filename) =>
  `${getMediaUrl()}/api/movies/stream/${encodeURIComponent(filename)}`;

// TV Shows
export const searchLocalTvShows = (query) =>
  getApi().get('/api/tv/search', { params: { q: query } });

export const getLocalTvSeasons = (showName) =>
  getApi().get(`/api/tv/${encodeURIComponent(showName)}/seasons`);

export const getLocalTvEpisodes = (showName, seasonName) =>
  getApi().get(`/api/tv/${encodeURIComponent(showName)}/${encodeURIComponent(seasonName)}/episodes`);

export const getLocalTvStreamUrl = (showName, seasonName, filename) =>
  `${getMediaUrl()}/api/tv/${encodeURIComponent(showName)}/${encodeURIComponent(seasonName)}/stream/${encodeURIComponent(filename)}`;
