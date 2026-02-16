const CACHE_NAME = 'streamit-offline-videos';
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

export async function saveVideoOffline(key, streamUrl, metadata, onProgress) {
  const response = await fetch(streamUrl);
  if (!response.ok) throw new Error('Failed to fetch video');

  const contentLength = response.headers.get('content-length');
  const total = contentLength ? parseInt(contentLength, 10) : 0;

  // Clone the response for caching while reading for progress
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

  // Reconstruct the response and cache it
  const blob = new Blob(chunks);
  const cacheResponse = new Response(blob, {
    headers: {
      'Content-Type': response.headers.get('content-type') || 'video/mp4',
      'Content-Length': String(blob.size),
    },
  });

  const cache = await caches.open(CACHE_NAME);
  await cache.put(streamUrl, cacheResponse);

  // Save metadata
  const meta = getMetadata();
  meta[key] = { ...metadata, streamUrl, savedAt: new Date().toISOString(), size: blob.size };
  setMetadata(meta);
}

export async function removeOfflineVideo(key) {
  const meta = getMetadata();
  const entry = meta[key];
  if (entry?.streamUrl) {
    const cache = await caches.open(CACHE_NAME);
    await cache.delete(entry.streamUrl);
  }
  delete meta[key];
  setMetadata(meta);
}

export function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
