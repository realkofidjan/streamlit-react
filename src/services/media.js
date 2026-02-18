import axios from 'axios';

function getDefaultUrl() {
  if (import.meta.env.VITE_MEDIA_SERVER_URL) return import.meta.env.VITE_MEDIA_SERVER_URL;
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.')) {
    return `http://${host}:4000`;
  }
  return '';
}

export function getMediaUrl() {
  if (import.meta.env.VITE_MEDIA_SERVER_URL) return import.meta.env.VITE_MEDIA_SERVER_URL;
  return localStorage.getItem('mediaServerUrl') || getDefaultUrl();
}

export function isServerConfigured() {
  return !!getMediaUrl();
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

export const getLibrary = () => getApi().get('/api/library');
