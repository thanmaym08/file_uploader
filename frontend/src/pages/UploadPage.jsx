import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import useUpload from '../hooks/useUpload';
import useWebSocket from '../hooks/useWebSocket';
import ProgressBar from '../components/ProgressBar';
import BundlePreview from '../components/BundlePreview';
import PulseIndicator from '../components/PulseIndicator';
import QRShare from '../components/QRShare';
import PasswordGate from '../components/PasswordGate';

/**
 * UploadPage — The main drop zone with multi-file bundle upload.
 * Features: drag & drop, progress bar, QR share, password protection,
 * burn-on-read toggle, and live download pulse notifications.
 */

const UploadPage = () => {
  // Files & upload state
  const [selectedFiles, setSelectedFiles] = useState([]);
  const { upload, progress, isUploading, error, bundleData, reset } = useUpload();

  // Options
  const [burnOnRead, setBurnOnRead] = useState(false);
  const [wantsPassword, setWantsPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // WebSocket for download pulse
  const bundleId = bundleData?.bundle_id || null;
  const { isConnected, pulseEvents, latestPulse } = useWebSocket(bundleId);

  // Dropzone
  const onDrop = useCallback((accepted) => {
    setSelectedFiles((prev) => [...prev, ...accepted]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    noClick: isUploading || !!bundleData,
  });

  // Remove a file from selection
  const removeFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Start upload
  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    try {
      await upload(selectedFiles, {
        password: wantsPassword ? password : null,
        burnOnRead,
      });
    } catch {
      // Error is captured by hook
    }
  };

  // Reset everything for a new upload
  const handleNewUpload = () => {
    setSelectedFiles([]);
    setPassword('');
    setWantsPassword(false);
    setBurnOnRead(false);
    reset();
  };

  const hasFiles = selectedFiles.length > 0;
  const hasResult = !!bundleData;

  return (
    <div className={`upload-page ${hasResult ? 'has-result' : ''}`}>
      {/* ─── Upload Panel ─── */}
      <motion.div
        className="glass-panel upload-panel"
        layout
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        {!hasResult ? (
          <>
            {/* Drop Zone */}
            <div
              {...getRootProps()}
              className={`dropzone-area ${isDragActive ? 'drag-active' : ''} ${hasFiles ? 'has-files' : ''}`}
            >
              <input {...getInputProps()} />

              <motion.div
                className="drop-icon"
                animate={{ y: isDragActive ? -12 : 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                {isDragActive ? '📥' : '✨'}
              </motion.div>

              <h1 className="drop-title">
                {isDragActive ? 'Drop files here' : 'QuickDrop Pro'}
              </h1>
              <p className="drop-subtitle">
                {hasFiles
                  ? 'Drop more files or click to add'
                  : 'Drag & drop files, or click to browse'}
              </p>
              <p className="drop-hint">
                Upload multiple files as a single bundle · One QR code for all
              </p>
            </div>

            {/* File Preview */}
            <BundlePreview files={selectedFiles} />

            {/* Options Row */}
            {hasFiles && (
              <motion.div
                className="options-section"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <div className="options-row">
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={burnOnRead}
                      onChange={(e) => setBurnOnRead(e.target.checked)}
                    />
                    <span className="toggle-track" />
                    🔥 Burn after download
                  </label>

                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={wantsPassword}
                      onChange={(e) => {
                        setWantsPassword(e.target.checked);
                        if (e.target.checked) setShowPasswordModal(true);
                        else setPassword('');
                      }}
                    />
                    <span className="toggle-track" />
                    🔒 Password protect
                  </label>
                </div>

                {wantsPassword && password && (
                  <motion.div
                    className="password-set-badge"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    🔒 Password set ·{' '}
                    <button
                      className="btn-link"
                      onClick={() => setShowPasswordModal(true)}
                    >
                      Change
                    </button>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* Progress Bar */}
            <ProgressBar
              progress={progress}
              isUploading={isUploading}
              fileCount={selectedFiles.length}
            />

            {/* Upload / Error */}
            {error && (
              <motion.div
                className="upload-error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                ⚠️ {error}
              </motion.div>
            )}

            {hasFiles && !isUploading && (
              <motion.div
                className="upload-actions"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <button
                  className="btn btn-secondary"
                  onClick={() => setSelectedFiles([])}
                >
                  Clear All
                </button>
                <button
                  className="btn btn-primary upload-btn"
                  onClick={handleUpload}
                >
                  ⚡ Upload {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''}
                </button>
              </motion.div>
            )}
          </>
        ) : (
          /* ─── Result State ─── */
          <motion.div
            className="upload-result"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="result-header">
              <motion.div
                className="result-check"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.1 }}
              >
                ✓
              </motion.div>
              <h2 className="result-title">Bundle Ready!</h2>
              <p className="result-subtitle">
                {bundleData.file_count} file{bundleData.file_count !== 1 ? 's' : ''} uploaded ·
                Share via QR or link
              </p>
            </div>

            <button className="btn btn-ghost new-upload-btn" onClick={handleNewUpload}>
              ← New Upload
            </button>
          </motion.div>
        )}
      </motion.div>

      {/* ─── Share Panel (after upload) ─── */}
      <AnimatePresence>
        {hasResult && (
          <motion.div
            className="glass-panel share-panel"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
          >
            <QRShare bundleId={bundleId} />

            {/* Live Pulse */}
            <div className="ws-status">
              <span className={`ws-dot ${isConnected ? 'connected' : ''}`} />
              {isConnected ? 'Live — waiting for recipient' : 'Connecting...'}
            </div>

            <PulseIndicator
              latestPulse={latestPulse}
              pulseEvents={pulseEvents}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Password Modal ─── */}
      <AnimatePresence>
        {showPasswordModal && (
          <PasswordGate
            mode="set"
            onSubmit={(pwd) => {
              setPassword(pwd);
              setShowPasswordModal(false);
            }}
            onCancel={() => {
              setShowPasswordModal(false);
              if (!password) setWantsPassword(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default UploadPage;
