import axios from 'axios';

const BASE_URL = import.meta.env.VITE_TMDB_BASE_URL;
const API_KEY = import.meta.env.VITE_TMDB_API_KEY;
const IMAGE_URL = import.meta.env.VITE_TMDB_IMAGE_URL;

const api = axios.create({
  baseURL: BASE_URL,
  params: {
    api_key: API_KEY,
    language: 'en-US',
  },
});

export const getImageUrl = (path, size = 'w500') => {
  if (!path) return null;
  return `${IMAGE_URL}/${size}${path}`;
};

export const searchMovies = (query, page = 1) =>
  api.get('/search/movie', { params: { query, page } });

export const searchTvShows = (query, page = 1) =>
  api.get('/search/tv', { params: { query, page } });

export const getNowPlayingMovies = (page = 1) =>
  api.get('/movie/now_playing', { params: { page } });

export const getAiringTodayTvShows = (page = 1) =>
  api.get('/tv/airing_today', { params: { page } });

export const getMovieDetails = (movieId) =>
  api.get(`/movie/${movieId}`, { params: { append_to_response: 'credits,videos' } });

export const getTvShowDetails = (tvId) =>
  api.get(`/tv/${tvId}`, { params: { append_to_response: 'credits,videos' } });

export const getTvSeasonDetails = (tvId, seasonNumber) =>
  api.get(`/tv/${tvId}/season/${seasonNumber}`);

export const getTvEpisodeDetails = (tvId, seasonNumber, episodeNumber) =>
  api.get(`/tv/${tvId}/season/${seasonNumber}/episode/${episodeNumber}`);

export const getRecommendedMovies = (page = 1) =>
  api.get('/discover/movie', {
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
  api.get('/discover/tv', {
    params: {
      page,
      sort_by: 'popularity.desc',
      'vote_average.gte': 6.0,
      'vote_count.gte': 100,
      'first_air_date.lte': new Date().toISOString().split('T')[0],
      with_original_language: 'en',
    },
  });
