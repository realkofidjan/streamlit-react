import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { CapacitorDownloader } from '@capgo/capacitor-downloader';

const STORAGE_KEY = 'streamit-offline-metadata';

function getMetadata() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function setMetadata(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function isVideoOffline(key) {
  return !!getMetadata()[key];
}

export function getOfflineVideos() {
  const meta = getMetadata();
  return Object.entries(meta)
    .map(([key, value]) => ({ key, ...value }))
    .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
}

/**
 * Downloads a video. 
 * On Web: Uses browser fetch + blob (manual download).
 * On Native (APK): Uses @capgo/capacitor-downloader for background saving.
 */
export async function saveVideoOffline(key, streamUrl, metadata, onProgress) {
  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    try {
      // 1. Setup Progress Listener
      let progressListener;
      try {
        progressListener = await CapacitorDownloader.addListener('notifyProgress', (event) => {
          // event.progress is typically 0-100
          if (onProgress) onProgress(event.progress);
        });
      } catch (e) {
        console.warn('Could not add progress listener', e);
      }

      // 2. Start Background Download
      const res = await CapacitorDownloader.download({
        url: streamUrl,
        filename: `${key}.mp4`,
        title: metadata.title,
        description: 'Downloading for offline play',
        notification: true,
        destination: Directory.Data
      });

      // Cleanup listener
      if (progressListener) progressListener.remove();

      // 3. Track Progress (Capacitor Downloader uses listeners)
      // Note: Full persistent tracking would need a listener in a global context,
      // but here we just wait for completion for the immediate metadata save.

      const filePath = res.path; // Internal URI

      // 4. Save metadata with local path
      const meta = getMetadata();
      meta[key] = {
        ...metadata,
        nativePath: filePath,
        isNative: true,
        savedAt: new Date().toISOString(),
        size: 0 // Will be updated on completion or estimated
      };
      setMetadata(meta);
      return res;
    } catch (err) {
      console.error('Native download failed:', err);
      throw err;
    }
  } else {
    // Legacy Web behavior
    const response = await fetch(streamUrl);
    if (!response.ok) throw new Error('Failed to fetch video');

    const contentLength = response.headers.get('content-length');
    const total = contentLength ? parseInt(contentLength, 10) : 0;

    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (onProgress && total > 0) {
        onProgress(received / total);
      }
    }

    const blob = new Blob(chunks, { type: 'video/mp4' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `${(metadata.title || 'video').replace(/[/\\?%*:|"<>]/g, '_')}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);

    const meta = getMetadata();
    meta[key] = { ...metadata, streamUrl, savedAt: new Date().toISOString(), size: blob.size };
    setMetadata(meta);
  }
}

export async function removeOfflineVideo(key) {
  const meta = getMetadata();
  const entry = meta[key];

  if (entry && entry.isNative && entry.nativePath) {
    try {
      await Filesystem.deleteFile({
        path: entry.nativePath
      });
    } catch (err) {
      console.warn('Failed to delete physical file:', err);
    }
  }

  delete meta[key];
  setMetadata(meta);
}

export function formatFileSize(bytes) {
  if (!bytes) return 'Unknown size';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
