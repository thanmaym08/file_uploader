import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';

/**
 * BundlePreview — Smart previews for uploaded files.
 * Generates low-res thumbnails client-side via <canvas>.
 * "Download" button serves the raw HD file from the server.
 */

const FILE_ICONS = {
  'image': '🖼️',
  'video': '🎬',
  'audio': '🎵',
  'application/pdf': '📄',
  'application/zip': '📦',
  'text': '📝',
  'default': '📎',
};

function getFileIcon(mimeType) {
  if (!mimeType) return FILE_ICONS.default;
  if (mimeType.startsWith('image')) return FILE_ICONS.image;
  if (mimeType.startsWith('video')) return FILE_ICONS.video;
  if (mimeType.startsWith('audio')) return FILE_ICONS.audio;
  if (mimeType in FILE_ICONS) return FILE_ICONS[mimeType];
  if (mimeType.startsWith('text')) return FILE_ICONS.text;
  return FILE_ICONS.default;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / k ** i).toFixed(1)) + ' ' + sizes[i];
}

/** Generate a low-res thumbnail from a File object using canvas */
function useThumbnail(file) {
  const [thumb, setThumb] = useState(null);

  useEffect(() => {
    if (!file || !file.type?.startsWith('image/')) {
      setThumb(null);
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX = 200; // Low-res thumbnail width
      const ratio = img.height / img.width;
      canvas.width = MAX;
      canvas.height = MAX * ratio;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      setThumb(canvas.toDataURL('image/jpeg', 0.6));
      URL.revokeObjectURL(url);
    };

    img.src = url;

    return () => URL.revokeObjectURL(url);
  }, [file]);

  return thumb;
}

/** Single file card with thumbnail */
const FileCard = ({ file, index, total }) => {
  const thumb = useThumbnail(file);
  const isImage = file.type?.startsWith('image/');

  return (
    <motion.div
      className="file-card"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35 }}
    >
      <div className="file-card-preview">
        {thumb ? (
          <img src={thumb} alt={file.name} className="file-card-thumb" />
        ) : (
          <span className="file-card-icon">{getFileIcon(file.type)}</span>
        )}
      </div>

      <div className="file-card-info">
        <span className="file-card-name" title={file.name}>
          {file.name}
        </span>
        <span className="file-card-meta">
          {formatBytes(file.size)}
          <span className="file-card-badge">
            {file.type?.split('/')[1]?.toUpperCase() || 'FILE'}
          </span>
        </span>
      </div>
    </motion.div>
  );
};

const BundlePreview = ({ files }) => {
  if (!files || files.length === 0) return null;

  return (
    <div className="bundle-preview">
      <div className="bundle-preview-header">
        <span className="bundle-file-count">
          {files.length} file{files.length !== 1 ? 's' : ''} ·{' '}
          {formatBytes(files.reduce((sum, f) => sum + (f.size || 0), 0))}
        </span>
      </div>

      <div className="bundle-preview-grid">
        {files.map((file, i) => (
          <FileCard key={i} file={file} index={i} total={files.length} />
        ))}
      </div>
    </div>
  );
};

export default BundlePreview;
