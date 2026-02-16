import { useState } from 'react';
import { FaDownload, FaCheck, FaRedo, FaExternalLinkAlt } from 'react-icons/fa';
import { downloadMovie, downloadEpisode } from '../services/download';
import { useUser } from '../contexts/UserContext';
import './DownloadButton.css';

function DownloadButton({ type, tmdbId, title, year, showName, season, episode, episodeTitle, onComplete }) {
  const { currentUser } = useUser();
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error

  if (currentUser?.username?.toLowerCase() !== 'fiifi') return null;

  const startDownload = async () => {
    setStatus('sending');
    try {
      if (type === 'movie') {
        await downloadMovie(tmdbId, title, year);
      } else {
        await downloadEpisode(tmdbId, showName, season, episode, episodeTitle);
      }
      setStatus('sent');
    } catch {
      setStatus('error');
    }
  };

  if (status === 'sent') {
    return (
      <button className="dl-btn sent" disabled>
        <FaExternalLinkAlt /> Sent to Downie
      </button>
    );
  }

  if (status === 'sending') {
    return (
      <button className="dl-btn downloading" disabled>
        <FaExternalLinkAlt /> Opening Downie...
      </button>
    );
  }

  if (status === 'error') {
    return (
      <button className="dl-btn error" onClick={startDownload}>
        <FaRedo /> Retry
      </button>
    );
  }

  return (
    <button className="dl-btn" onClick={startDownload}>
      <FaDownload /> Download
    </button>
  );
}

export default DownloadButton;
