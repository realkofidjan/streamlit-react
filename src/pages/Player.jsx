import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getMovieDetails, getTvShowDetails, getTvSeasonDetails, getImageUrl } from '../services/tmdb';
import {
    searchLocalMovies, getLocalMovieStreamUrl,
    searchLocalTvShows, getLocalTvSeasons, getLocalTvEpisodes, getLocalTvStreamUrl,
} from '../services/media';
import { searchSubtitles, fetchSubtitleUrl } from '../services/subtitles';
import { useUser } from '../contexts/UserContext';
import NetflixPlayer from '../components/NetflixPlayer';
import './Player.css';

function Player() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const { currentUser, updateWatchHistory } = useUser();

    const type = params.get('type');           // 'movie' or 'episode'
    const tmdbId = params.get('id');           // TMDB movie or show ID
    const season = params.get('season');       // For episodes
    const episode = params.get('episode');     // For episodes
    const startTimeParam = params.get('t');    // Start time in seconds

    const [streamUrl, setStreamUrl] = useState(null);
    const [title, setTitle] = useState('');
    const [posterPath, setPosterPath] = useState('');
    const [localFilename, setLocalFilename] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Episode data for the player
    const [episodesData, setEpisodesData] = useState(null);
    const [nextEpisodeInfo, setNextEpisodeInfo] = useState(null);
    const [showName, setShowName] = useState('');
    const [localShowName, setLocalShowName] = useState('');
    const [localSeasonFolder, setLocalSeasonFolder] = useState('');
    const [localEpisodeSet, setLocalEpisodeSet] = useState(new Set());
    const [mediaInfo, setMediaInfo] = useState(null);

    // Autosave progress every 60 seconds
    useEffect(() => {
        if (loading || error || !streamUrl) return;

        const saveInterval = setInterval(() => {
            const player = document.querySelector('video');
            if (player && !player.paused) {
                handleProgress({
                    currentTime: player.currentTime,
                    duration: player.duration
                });
            }
        }, 60000); // 1 minute

        return () => clearInterval(saveInterval);
    }, [streamUrl, loading, error, type, tmdbId, season, episode]);

    useEffect(() => {
        if (!tmdbId || !type) {
            setError('Missing parameters');
            setLoading(false);
            return;
        }

        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                if (type === 'movie') {
                    await loadMovie();
                } else if (type === 'episode') {
                    await loadEpisode();
                }
            } catch (err) {
                console.error('Player load error:', err);
                setError('Failed to load media');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [tmdbId, type, season, episode]);

    // Subtitles
    const [subtitles, setSubtitles] = useState([]);
    const [currentSubtitle, setCurrentSubtitle] = useState(null);

    // ... (existing load logic)

    const loadMovie = async () => {
        // ... (existing movie loading)
        const res = await getMovieDetails(tmdbId);
        const movie = res.data;
        setTitle(movie.title);
        setPosterPath(movie.poster_path);
        setMediaInfo({
            type: 'movie',
            movieTitle: movie.title,
            overview: movie.overview,
        });

        // Find local file
        const localRes = await searchLocalMovies(movie.title);
        let foundFilename = null;
        if (localRes.data.length > 0) {
            const file = localRes.data[0];
            foundFilename = file.filename;
            setLocalFilename(file.filename);
            setStreamUrl(getLocalMovieStreamUrl(file.filename));
        } else {
            setError('Movie not found on local server');
        }


    };

    const loadEpisode = async () => {
        // ... (existing episode loading)
        const showRes = await getTvShowDetails(tmdbId);
        const show = showRes.data;
        setShowName(show.name);
        setPosterPath(show.poster_path);

        const seasonNum = parseInt(season);
        const episodeNum = parseInt(episode);



        // ... (rest of loadEpisode)
        // Fetch season episodes from TMDB
        const seasonRes = await getTvSeasonDetails(tmdbId, seasonNum);
        const episodes = seasonRes.data.episodes || [];

        const ep = episodes.find(e => e.episode_number === episodeNum);
        setTitle(`${show.name} — S${season}E${episode}${ep ? ` — ${ep.name}` : ''}`);
        setMediaInfo({
            type: 'episode',
            showName: show.name,
            season: seasonNum,
            episodeNumber: episodeNum,
            episodeName: ep?.name || '',
            overview: ep?.overview || show.overview,
        });

        // Find local files and build episode data
        const localRes = await searchLocalTvShows(show.name);
        if (localRes.data.length === 0) {
            setError('Show not found on local server');
            return;
        }

        let foundUrl = null;
        let matchedShowName = '';
        let matchedSeasonFolder = '';
        const localEps = new Set();

        for (const match of localRes.data) {
            const seasonsRes = await getLocalTvSeasons(match.name);
            for (const folder of seasonsRes.data) {
                const epsRes = await getLocalTvEpisodes(match.name, folder.name);
                for (const localEp of epsRes.data) {
                    const sm = localEp.filename.match(/[Ss](\d+)/);
                    const em = localEp.filename.match(/[Ee](\d+)/);
                    if (!sm || !em) continue;

                    if (parseInt(sm[1]) === seasonNum) {
                        localEps.add(parseInt(em[1]));

                        if (parseInt(em[1]) === episodeNum) {
                            foundUrl = getLocalTvStreamUrl(match.name, folder.name, localEp.filename);
                            setLocalFilename(localEp.filename);
                            matchedShowName = match.name;
                            matchedSeasonFolder = folder.name;
                        }
                    }
                }
            }
            if (foundUrl) break;
        }

        setLocalShowName(matchedShowName);
        setLocalSeasonFolder(matchedSeasonFolder);
        setLocalEpisodeSet(localEps);



        // Build episodes data for the player's episode panel
        const seasonsData = [];
        // Get all seasons info from the show
        if (show.seasons && show.seasons.length > 0) {
            for (const s of show.seasons) {
                if (s.season_number === 0) continue; // Skip specials
                try {
                    const sRes = await getTvSeasonDetails(tmdbId, s.season_number);
                    const sEpisodes = (sRes.data.episodes || []).map(e => {
                        const key = `${tmdbId}-s${s.season_number}e${e.episode_number}`;
                        const progress = currentUser?.watchHistory?.episodes?.[key]?.progress || 0;
                        return {
                            ...e,
                            still_path: e.still_path ? getImageUrl(e.still_path) : null,
                            season_number: s.season_number,
                            progress,
                            onPlay: () => {
                                navigate(`/play?type=episode&id=${tmdbId}&season=${s.season_number}&episode=${e.episode_number}`, { replace: true });
                            },
                        };
                    });
                    seasonsData.push({
                        season_number: s.season_number,
                        episodes: sEpisodes,
                    });
                } catch {
                    // Skip seasons that fail to load
                }
            }
        } else {
            // Fallback: use the already loaded season
            const sEpisodes = episodes.map(e => {
                const key = `${tmdbId}-s${seasonNum}e${e.episode_number}`;
                const progress = currentUser?.watchHistory?.episodes?.[key]?.progress || 0;
                return {
                    ...e,
                    still_path: e.still_path ? getImageUrl(e.still_path) : null,
                    season_number: seasonNum,
                    progress,
                    onPlay: () => {
                        navigate(`/play?type=episode&id=${tmdbId}&season=${seasonNum}&episode=${e.episode_number}`, { replace: true });
                    },
                };
            });
            seasonsData.push({
                season_number: seasonNum,
                episodes: sEpisodes,
            });
        }

        setEpisodesData({
            seasons: seasonsData,
            currentSeason: seasonNum,
            currentEpisode: episodeNum,
            localEpisodes: localEps,
        });

        // Determine next episode
        const currentEpIndex = episodes.findIndex(e => e.episode_number === episodeNum);
        if (currentEpIndex >= 0 && currentEpIndex < episodes.length - 1) {
            const nextEp = episodes[currentEpIndex + 1];
            setNextEpisodeInfo({
                showName: show.name,
                season: seasonNum,
                episode: nextEp.episode_number,
                episodeTitle: nextEp.name,
                isLocal: localEps.has(nextEp.episode_number),
            });
        } else {
            setNextEpisodeInfo(null);
        }

        if (foundUrl) {
            setStreamUrl(foundUrl);
        } else {
            setError('Episode not found on local server');
        }
    };

    const handleProgress = ({ currentTime, duration }) => {
        if (!currentUser || !duration) return;
        const progress = currentTime / duration;
        const threshold = type === 'movie' ? 0.9 : 0.97;
        const status = progress > threshold ? 'watched' : 'watching';

        if (type === 'movie') {
            updateWatchHistory('movie', tmdbId, {
                status, progress, filename: localFilename,
                title, posterPath, currentTime,
            });
        } else {
            updateWatchHistory('episode', `${tmdbId}-s${season}e${episode}`, {
                status, progress, filename: localFilename,
                title, posterPath, currentTime,
                showId: tmdbId, season, episode,
            });
        }
    };

    const playNextEpisode = () => {
        if (!nextEpisodeInfo) return;
        navigate(`/play?type=episode&id=${tmdbId}&season=${nextEpisodeInfo.season}&episode=${nextEpisodeInfo.episode}`, { replace: true });
    };

    const handleBack = () => {
        navigate(-1);
    };

    if (loading) {
        return (
            <div className="player-loading">
                <div className="spinner" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="player-error">
                <p>{error}</p>
                <button className="player-back-btn" onClick={handleBack}>Go Back</button>
            </div>
        );
    }



    return (
        <div className="player-page">
            <NetflixPlayer
                src={streamUrl}
                title={title}
                onClose={handleBack}
                onProgress={handleProgress}
                startTime={startTimeParam ? parseFloat(startTimeParam) : 0}
                autoPlay
                episodes={type === 'episode' ? episodesData : null}
                onNextEpisode={type === 'episode' ? playNextEpisode : null}
                nextEpisodeInfo={type === 'episode' ? nextEpisodeInfo : null}
                mediaInfo={mediaInfo}
            />
        </div>
    );
}

export default Player;
