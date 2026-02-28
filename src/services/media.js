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
  `${getMediaUrl()}/api/movies/stream/${encodeURIComponent(filename)}?_cb=${Date.now()}`;

// TV Shows
export const searchLocalTvShows = (query) =>
  getApi().get('/api/tv/search', { params: { q: query } });

export const getLocalTvSeasons = (showName) =>
  getApi().get(`/api/tv/${encodeURIComponent(showName)}/seasons`);

export const getLocalTvEpisodes = (showName, seasonName) =>
  getApi().get(`/api/tv/${encodeURIComponent(showName)}/${encodeURIComponent(seasonName)}/episodes`);

export const getLocalTvStreamUrl = (showName, seasonName, filename) =>
  `${getMediaUrl()}/api/tv/${encodeURIComponent(showName)}/${encodeURIComponent(seasonName)}/stream/${encodeURIComponent(filename)}?_cb=${Date.now()}`;

export const getLibrary = () => getApi().get('/api/library');

export const getLibraryMetadata = () => getApi().get('/api/library/metadata');
export const getEpisodeIntro = (imdbId, season, episode, tmdbId) =>
  getApi().get('/api/intro', { params: { imdb_id: imdbId, season, episode, tmdb_id: tmdbId } });

export const saveIntroOverride = (tmdbId, season, episode, endSec, startSec = 0) =>
  getApi().post('/api/intro/overrides', { tmdb_id: tmdbId, season, episode, start_sec: startSec, end_sec: endSec });
