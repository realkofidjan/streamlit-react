import { useState, useEffect } from 'react';
import { FaDownload, FaCheck, FaTrash, FaSpinner } from 'react-icons/fa';
import { isVideoOffline, saveVideoOffline, removeOfflineVideo, formatFileSize } from '../services/offlineStorage';
import './SaveOfflineButton.css';

function SaveOfflineButton({ cacheKey, streamUrl, metadata }) {
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | downloading | done | error
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setSaved(isVideoOffline(cacheKey));
  }, [cacheKey]);

  const handleSave = async () => {
    setStatus('downloading');
    setProgress(0);
    try {
      await saveVideoOffline(cacheKey, streamUrl, metadata, (p) => setProgress(p));
      setSaved(true);
      setStatus('done');
    } catch {
      setStatus('error');
    }
  };

  const handleRemove = () => {
    removeOfflineVideo(cacheKey);
    setSaved(false);
    setStatus('idle');
  };

  if (status === 'downloading') {
    return (
      <button className="offline-btn downloading" disabled>
        <FaSpinner className="spin" />
        {progress > 0 ? `${Math.round(progress * 100)}%` : 'Downloading...'}
      </button>
    );
  }

  if (saved) {
    return (
      <div className="offline-btn-group">
        <span className="offline-btn saved">
          <FaCheck /> Downloaded
        </span>
        <button className="offline-btn remove" onClick={handleRemove} title="Remove offline copy">
          <FaTrash />
        </button>
      </div>
    );
  }

  return (
    <button className="offline-btn" onClick={handleSave}>
      <FaDownload /> Download MP4
    </button>
  );
}

export default SaveOfflineButton;
