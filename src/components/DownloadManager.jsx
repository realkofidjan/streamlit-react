import { useState, useEffect, useRef } from 'react';
import { FaDownload, FaCheck, FaTimes, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { getDownloadStatus } from '../services/download';
import './DownloadManager.css';

function DownloadManager() {
  const [current, setCurrent] = useState(null);
  const [queued, setQueued] = useState([]);
  const [collapsed, setCollapsed] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await getDownloadStatus();
        setCurrent(res.data.current || null);
        setQueued(res.data.queued || []);
      } catch {
        // Server offline
      }
    };
    poll();
    pollRef.current = setInterval(poll, 3000);
    return () => clearInterval(pollRef.current);
  }, []);

  if (!current && queued.length === 0) return null;

  return (
    <div className={`dm-panel ${collapsed ? 'collapsed' : ''}`}>
      <button className="dm-header" onClick={() => setCollapsed(!collapsed)}>
        <FaDownload />
        <span>Downloads {current ? '(1 active)' : ''}{queued.length > 0 ? ` + ${queued.length} queued` : ''}</span>
        {collapsed ? <FaChevronUp /> : <FaChevronDown />}
      </button>
      {!collapsed && (
        <div className="dm-list">
          {current && (
            <div className="dm-item">
              <div className="dm-item-info">
                <span className="dm-filename">{current.targetName}</span>
                <span className="dm-pct">Downloading via Downie</span>
              </div>
            </div>
          )}
          {queued.map((d, i) => (
            <div key={i} className="dm-item done">
              <span className="dm-filename">{d.targetName}</span>
              <span className="dm-pct">Queued</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default DownloadManager;
