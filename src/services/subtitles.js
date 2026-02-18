import axios from 'axios';

function getMediaUrl() {
    return localStorage.getItem('mediaServerUrl') || import.meta.env.VITE_MEDIA_SERVER || 'http://localhost:4000';
}

/**
 * Search for subtitles by TMDB ID via our server proxy.
 * @param {string|number} tmdbId - TMDB movie or TV show ID
 * @param {'movie'|'episode'} type - Type of media
 * @param {number} [season] - Season number (for episodes)
 * @param {number} [episode] - Episode number (for episodes)
 * @param {string} [languages='en'] - Language code(s)
 * @returns {Promise<Array>} Array of subtitle results
 */
export async function searchSubtitles(tmdbId, type = 'movie', season, episode, languages = 'en') {
    try {
        const params = { tmdb_id: tmdbId, type, languages };
        if (type === 'episode' && season && episode) {
            params.season = season;
            params.episode = episode;
        }
        const res = await axios.get(`${getMediaUrl()}/api/subtitles/search`, { params });
        return res.data?.data || [];
    } catch {
        return [];
    }
}

/**
 * Fetch VTT subtitle content for a given file ID and return a blob URL.
 * Returns null if the download fails.
 * @param {string|number} fileId - The subtitle file ID from search results
 * @returns {Promise<string|null>} Blob URL for the VTT content, or null on failure
 */
export async function fetchSubtitleUrl(fileId) {
    try {
        const res = await fetch(`${getMediaUrl()}/api/subtitles/download?file_id=${fileId}`);
        if (!res.ok) return null;
        const vttText = await res.text();
        if (!vttText.startsWith('WEBVTT')) return null;
        const blob = new Blob([vttText], { type: 'text/vtt' });
        return URL.createObjectURL(blob);
    } catch {
        return null;
    }
}
