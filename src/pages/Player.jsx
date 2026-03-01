import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import {
    searchLocalMovies, getLocalMovieStreamUrl,
    searchLocalTvShows, getLocalTvSeasons, getLocalTvEpisodes, getLocalTvStreamUrl,
    getEpisodeIntro,
} from '../services/media';
import { getMovieDetails, getTvShowDetails, getTvSeasonDetails, getImageUrl, getTvEpisodeExternalIds } from '../services/tmdb';
import { searchSubtitles, fetchSubtitleUrl } from '../services/subtitles';
import { useUser } from '../contexts/UserContext';
import { getOfflineVideos } from '../services/offlineStorage';
import NetflixPlayer from '../components/NetflixPlayer';
import './Player.css';

function Player() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const { currentUser, updateWatchHistory } = useUser();

    const location = useLocation();

    const type = params.get('type');           // 'movie' or 'episode'
    const tmdbId = params.get('id');           // TMDB movie or show ID
    const season = params.get('season');       // For episodes
    const episode = params.get('episode');     // For episodes
    const startTimeParam = params.get('t');    // Start time in seconds
    const passedLocalFilename = location.state?.localFilename;

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
    const [introData, setIntroData] = useState(null);

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
            setError(null);

            // If the route provided the exact chunk mapping, start video instantly!
            if (passedLocalFilename) {
                setLocalFilename(passedLocalFilename);
                if (type === 'movie') {
                    setStreamUrl(getLocalMovieStreamUrl(passedLocalFilename));
                } else {
                    // Reconstructing the folder mapping is tricky without the backend,
                    // but `Player` had an old `getLocalTvStreamUrl` which needs name and folder.
                    // Actually, the new metadata endpoint should ideally pass the full URL,
                    // but since `localFilename` uniquely identifies it on the backend, we can just use the direct fetch.
                    // However, we still need `name` and `folderName`. So for episodes, it's safest to just let the TMDB 
                    // mapper run *or* change `ContentModal` to pass the full local stream URL.
                }
            } else {
                setLoading(true);
            }

            try {
                if (type === 'movie') {
                    await loadMovie(!!passedLocalFilename);
                } else if (type === 'episode') {
                    await loadEpisode(!!passedLocalFilename);
                }
            } catch (err) {
                console.error('Player load error:', err);
                if (!passedLocalFilename) setError('Failed to load media');
            } finally {
                setLoading(false);
            }
        };

        const checkOffline = () => {
            const key = type === 'movie' ? tmdbId : `${tmdbId}-s${season}e${episode}`;
            const offline = getOfflineVideos().find(v => String(v.key) === String(key) || String(v.id) === String(tmdbId));
            if (offline && offline.nativePath) {
                console.log('Playing from offline local path:', offline.nativePath);
                setStreamUrl(offline.nativePath);
                setTitle(offline.title);
                setPosterPath(offline.posterPath);
                return true;
            }
            return false;
        };

        if (!checkOffline()) {
            load();
        } else {
            setLoading(false);
        }
    }, [tmdbId, type, season, episode]);

    // Subtitles
    const [subtitles, setSubtitles] = useState([]);
    const [currentSubtitle, setCurrentSubtitle] = useState(null);

    // ... (existing load logic)

    const loadMovie = async (hasDirectUrl) => {
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

        // Trigger Subtitle search
        if (!hasDirectUrl) {
            loadSubtitles(tmdbId, 'movie', null, null, movie.title);
        }

        if (hasDirectUrl) return; // Skip heavy local mapping

        // Find local file
        const localRes = await searchLocalMovies(movie.title);
        let foundFilename = null;
        if (localRes.data.length > 0) {
            const file = localRes.data[0];
            foundFilename = file.filename;
            setLocalFilename(file.filename);
            setStreamUrl(getLocalMovieStreamUrl(file.filename));
            // Trigger Subtitle search with local filename
            loadSubtitles(tmdbId, 'movie', null, null, movie.title, file.filename);
        } else {
            setError('Movie not found on local server');
        }


    };

    const loadEpisode = async (hasDirectUrl) => {
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
            showId: tmdbId,
        });

        // Trigger Subtitle search (preliminary)
        if (!hasDirectUrl) {
            loadSubtitles(tmdbId, 'episode', seasonNum, episodeNum, show.name);
        }

        // Find local files and build episode data
        const localRes = await searchLocalTvShows(show.name);
        if (localRes.data.length === 0) {
            if (!hasDirectUrl) setError('Show not found on local server');
            return;
        }

        let foundUrl = null;
        let foundFilename = null;
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
                            foundFilename = localEp.filename;
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

        // Re-trigger subtitle search with local information
        loadSubtitles(tmdbId, 'episode', seasonNum, episodeNum, show.name, foundFilename, matchedShowName, matchedSeasonFolder);



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

        // FETCH INTRO TIMESTAMPS
        // Fetch show's IMDb ID from the already loaded 'show' data (now including external_ids)
        const showImdbId = show.external_ids?.imdb_id;
        if (showImdbId || tmdbId) {
            try {
                const introRes = await getEpisodeIntro(showImdbId, seasonNum, episodeNum, tmdbId);
                setIntroData(introRes.data);
                console.log('Intro data loaded for show:', show.name);
            } catch (err) {
                // IntroDB returns 404 if no data, no need to log error as it's common
                if (err.response?.status !== 404) {
                    console.warn('Could not fetch intro timestamps:', err.message);
                }
            }
        }

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
        } else if (!hasDirectUrl) {
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

    const loadSubtitles = async (id, mType, s, e, title, filename, showN, seasonN) => {
        try {
            const results = await searchSubtitles(id, mType, s, e, 'en', filename, title, showN, seasonN);
            setSubtitles(results);
            // Auto-load the first English result if score is decent
            if (results.length > 0) {
                const subUrl = await fetchSubtitleUrl(results[0].attributes.files[0].file_id);
                if (subUrl) {
                    setCurrentSubtitle({
                        id: results[0].id,
                        url: subUrl,
                        name: results[0].attributes.release || 'English'
                    });
                }
            }
        } catch (err) {
            console.warn('Failed to load subtitles:', err);
        }
    };

    const onSelectSubtitle = async (sub) => {
        if (!sub) {
            setCurrentSubtitle(null);
            return;
        }
        try {
            const subUrl = await fetchSubtitleUrl(sub.attributes.files[0].file_id);
            if (subUrl) {
                setCurrentSubtitle({
                    id: sub.id,
                    url: subUrl,
                    name: sub.attributes.release || sub.attributes.language
                });
            }
        } catch (err) {
            console.error('Failed to select subtitle:', err);
        }
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
                introData={introData}
                subtitles={subtitles}
                currentSubtitle={currentSubtitle}
                onSelectSubtitle={onSelectSubtitle}
            />
        </div>
    );
}

export default Player;
