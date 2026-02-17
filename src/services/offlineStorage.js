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

  // Trigger a real browser download
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = `${(metadata.title || 'video').replace(/[/\\?%*:|"<>]/g, '_')}.mp4`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);

  // Save metadata (no blob storage — file is now on the user's device)
  const meta = getMetadata();
  meta[key] = { ...metadata, streamUrl, savedAt: new Date().toISOString(), size: blob.size };
  setMetadata(meta);
}

export function removeOfflineVideo(key) {
  const meta = getMetadata();
  delete meta[key];
  setMetadata(meta);
}

export function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
