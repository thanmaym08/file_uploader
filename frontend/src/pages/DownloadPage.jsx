import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import PasswordGate from '../components/PasswordGate';

/**
 * DownloadPage — Recipient view when they scan the QR / open the link.
 * Shows bundle info, individual file downloads (HD), and "Download All" ZIP.
 */

const API_BASE = import.meta.env.VITE_API_URL || '';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / k ** i).toFixed(1)) + ' ' + sizes[i];
}

function getTypeColor(mime) {
  if (mime?.startsWith('image')) return '#4facfe';
  if (mime?.startsWith('video')) return '#f59e0b';
  if (mime?.startsWith('audio')) return '#a855f7';
  if (mime?.includes('pdf')) return '#ef4444';
  if (mime?.includes('zip')) return '#22c55e';
  return '#8b95a5';
}

function getTypeIcon(mime) {
  if (mime?.startsWith('image')) return '🖼️';
  if (mime?.startsWith('video')) return '🎬';
  if (mime?.startsWith('audio')) return '🎵';
  if (mime?.includes('pdf')) return '📄';
  if (mime?.includes('zip')) return '📦';
  if (mime?.startsWith('text')) return '📝';
  return '📎';
}

const DownloadPage = () => {
  const { bundleId } = useParams();
  const [bundle, setBundle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Password state
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [verifying, setVerifying] = useState(false);

  // Download state per file
  const [downloading, setDownloading] = useState({});

  // Fetch bundle info
  useEffect(() => {
    const fetchBundle = async () => {
      try {
        const res = await axios.get(`${API_BASE}/drop/bundle/${bundleId}`);
        setBundle(res.data);
        if (res.data.password_protected) {
          setNeedsPassword(true);
        }
      } catch (err) {
        if (err.response?.status === 404) {
          setError('This bundle has expired or does not exist.');
        } else {
          setError('Failed to load bundle info.');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchBundle();
  }, [bundleId]);

  // Verify password
  const handlePasswordSubmit = async (pwd) => {
    setVerifying(true);
    setPasswordError('');
    try {
      const formData = new FormData();
      formData.append('password', pwd);
      await axios.post(`${API_BASE}/drop/verify-password/${bundleId}`, formData);
      setPassword(pwd);
      setNeedsPassword(false);
    } catch (err) {
      setPasswordError(err.response?.data?.detail || 'Invalid password');
    } finally {
      setVerifying(false);
    }
  };

  // Download individual file
  const handleDownloadFile = async (fileIndex, filename) => {
    setDownloading((prev) => ({ ...prev, [fileIndex]: true }));
    try {
      const params = password ? { password } : {};
      const res = await axios.get(
        `${API_BASE}/drop/download/${bundleId}/${fileIndex}`,
        { params, responseType: 'blob' }
      );

      // Trigger browser download
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.response?.data?.detail || 'Download failed');
    } finally {
      setDownloading((prev) => ({ ...prev, [fileIndex]: false }));
    }
  };

  // Download all as ZIP
  const handleDownloadAll = async () => {
    setDownloading((prev) => ({ ...prev, all: true }));
    try {
      const params = password ? { password } : {};
      const res = await axios.get(
        `${API_BASE}/drop/download-all/${bundleId}`,
        { params, responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quickdrop-${bundleId.slice(0, 8)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.response?.data?.detail || 'Download failed');
    } finally {
      setDownloading((prev) => ({ ...prev, all: false }));
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="download-page">
        <div className="glass-panel download-panel">
          <div className="download-loading">
            <motion.div
              className="loading-spinner"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
            <p>Loading bundle...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="download-page">
        <div className="glass-panel download-panel">
          <div className="download-error">
            <span className="error-icon">💨</span>
            <h2>Bundle Gone</h2>
            <p>{error}</p>
            <a href="/" className="btn btn-primary">Upload New Files</a>
          </div>
        </div>
      </div>
    );
  }

  // Password gate
  if (needsPassword) {
    return (
      <div className="download-page">
        <PasswordGate
          mode="unlock"
          onSubmit={handlePasswordSubmit}
          isLoading={verifying}
          error={passwordError}
        />
      </div>
    );
  }

  return (
    <div className="download-page">
      <motion.div
        className="glass-panel download-panel"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Header */}
        <div className="download-header">
          <h2 className="download-title">📦 Bundle Ready</h2>
          <p className="download-meta">
            {bundle.file_count} file{bundle.file_count !== 1 ? 's' : ''} ·{' '}
            {formatBytes(bundle.total_bytes)}
            {bundle.burn_on_read && (
              <span className="burn-badge">🔥 Burns after download</span>
            )}
          </p>
        </div>

        {/* Download All */}
        {bundle.file_count > 1 && (
          <button
            className="btn btn-primary download-all-btn"
            onClick={handleDownloadAll}
            disabled={downloading.all}
          >
            {downloading.all ? (
              <>
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  style={{ display: 'inline-block' }}
                >
                  ⏳
                </motion.span>
                Downloading...
              </>
            ) : (
              <>📥 Download All as ZIP</>
            )}
          </button>
        )}

        {/* File List */}
        <div className="download-file-list">
          {bundle.files.map((file) => (
            <motion.div
              key={file.index}
              className="download-file-card"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: file.index * 0.06 }}
            >
              <div className="dfc-icon" style={{ color: getTypeColor(file.mime_type) }}>
                {getTypeIcon(file.mime_type)}
              </div>

              <div className="dfc-info">
                <span className="dfc-name">{file.filename}</span>
                <span className="dfc-meta">
                  {formatBytes(file.size_bytes)}
                  <span
                    className="dfc-type-badge"
                    style={{
                      background: `${getTypeColor(file.mime_type)}18`,
                      color: getTypeColor(file.mime_type),
                    }}
                  >
                    {file.mime_type?.split('/')[1]?.toUpperCase() || 'FILE'}
                  </span>
                </span>
              </div>

              <button
                className="btn btn-secondary dfc-download-btn"
                onClick={() => handleDownloadFile(file.index, file.filename)}
                disabled={downloading[file.index]}
              >
                {downloading[file.index] ? '⏳' : '⬇️'} HD
              </button>
            </motion.div>
          ))}
        </div>

        {/* Footer note */}
        <p className="download-footer-note">
          All files are served in original quality — lossless, bit-for-bit integrity verified via SHA-256.
        </p>
      </motion.div>
    </div>
  );
};

export default DownloadPage;
