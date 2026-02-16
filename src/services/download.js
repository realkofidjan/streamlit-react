import axios from 'axios';
import { getMediaUrl } from './media';

function getApi() {
  return axios.create({ baseURL: getMediaUrl() });
}

export const downloadMovie = (tmdbId, title, year) =>
  getApi().post('/api/download/movie', { tmdbId, title, year });

export const downloadEpisode = (tmdbId, showName, season, episode, episodeTitle) =>
  getApi().post('/api/download/episode', { tmdbId, showName, season, episode, episodeTitle });

export const getDownloadStatus = () =>
  getApi().get('/api/download/status');

export const getDownloadStatusById = (downloadId) =>
  getApi().get(`/api/download/status/${downloadId}`);
