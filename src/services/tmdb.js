import axios from 'axios';
import { getMediaUrl } from './media';

const IMAGE_URL = import.meta.env.VITE_TMDB_IMAGE_URL;

// Dynamically create axios instance to always construct the current proxy URL
const getApi = () => {
  const baseUrl = getMediaUrl();
  return axios.create({
    baseURL: `${baseUrl}/api/tmdb`,
  });
};

export const getImageUrl = (path, size = 'w500') => {
  if (!path) return null;
  return `${IMAGE_URL}/${size}${path}`;
};

export const searchMovies = (query, page = 1) =>
  getApi().get('/search/movie', { params: { query, page } });

export const searchTvShows = (query, page = 1) =>
  getApi().get('/search/tv', { params: { query, page } });

export const getNowPlayingMovies = (page = 1) =>
  getApi().get('/movie/now_playing', { params: { page } });

export const getAiringTodayTvShows = (page = 1) =>
  getApi().get('/tv/airing_today', { params: { page } });

export const getMovieDetails = (movieId) =>
  getApi().get(`/movie/${movieId}`, { params: { append_to_response: 'credits,videos' } });

export const getTvShowDetails = (tvId) =>
  getApi().get(`/tv/${tvId}`, { params: { append_to_response: 'credits,videos' } });

export const getTvSeasonDetails = (tvId, seasonNumber) =>
  getApi().get(`/tv/${tvId}/season/${seasonNumber}`);

export const getTvEpisodeDetails = (tvId, seasonNumber, episodeNumber) =>
  getApi().get(`/tv/${tvId}/season/${seasonNumber}/episode/${episodeNumber}`);

export const getSimilarMovies = (movieId) =>
  getApi().get(`/movie/${movieId}/recommendations`);

export const getSimilarTvShows = (tvId) =>
  getApi().get(`/tv/${tvId}/recommendations`);

export const getRecommendedMovies = (page = 1) =>
  getApi().get('/discover/movie', {
    params: {
      page,
      sort_by: 'popularity.desc',
      'vote_average.gte': 6.0,
      'vote_count.gte': 100,
      'primary_release_date.lte': new Date().toISOString().split('T')[0],
      with_original_language: 'en',
    },
  });

export const getRecommendedTvShows = (page = 1) =>
  getApi().get('/discover/tv', {
    params: {
      page,
      sort_by: 'popularity.desc',
      'vote_average.gte': 6.0,
      'vote_count.gte': 100,
      'first_air_date.lte': new Date().toISOString().split('T')[0],
      with_original_language: 'en',
    },
  });

export const getTrendingAll = () =>
  getApi().get('/trending/all/week');

export const getTrendingDay = () =>
  getApi().get('/trending/all/day');

export const getMovieGenres = () =>
  getApi().get('/genre/movie/list');

export const getTvGenres = () =>
  getApi().get('/genre/tv/list');
