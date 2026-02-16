import { useState, useEffect } from 'react';
import { FaExclamationTriangle } from 'react-icons/fa';
import { getMediaUrl, isServerConfigured } from '../services/media';

function ServerAlert() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!isServerConfigured()) return;

    let mounted = true;

    const check = async () => {
      try {
        const res = await fetch(`${getMediaUrl()}/api/library`, {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000),
        });
        if (mounted) setOffline(!res.ok);
      } catch {
        if (mounted) setOffline(true);
      }
    };

    check();
    const interval = setInterval(check, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="server-alert">
      <FaExclamationTriangle />
      <span>Media server unreachable — check that the server is running</span>
    </div>
  );
}

export default ServerAlert;
