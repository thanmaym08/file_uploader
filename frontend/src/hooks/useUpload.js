import { useState, useCallback } from 'react';
import axios from 'axios';

/**
 * useUpload — Custom hook for file uploads with real-time progress tracking.
 * Uses Axios's onUploadProgress for smooth 0%→100% feedback.
 *
 * Returns:
 *   upload(files, options) — trigger upload
 *   progress — 0–100 integer
 *   isUploading — boolean
 *   error — error string or null
 *   bundleData — server response on success
 *   reset() — clear state for a new upload
 */
const API_BASE = '/api';

export default function useUpload() {
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const [bundleData, setBundleData] = useState(null);

  const upload = useCallback(async (files, { password = null, burnOnRead = false } = {}) => {
    setIsUploading(true);
    setProgress(0);
    setError(null);
    setBundleData(null);

    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file);
    }
    if (password) {
      formData.append('password', password);
    }
    formData.append('burn_on_read', burnOnRead.toString());

    try {
      const response = await axios.post(`${API_BASE}/drop/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const pct = Math.round(
            (progressEvent.loaded * 100) / (progressEvent.total || 1)
          );
          setProgress(pct);
        },
      });

      setBundleData(response.data);
      setProgress(100);
      return response.data;
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        err.message ||
        'Upload failed';
      setError(msg);
      throw err;
    } finally {
      setIsUploading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setProgress(0);
    setIsUploading(false);
    setError(null);
    setBundleData(null);
  }, []);

  return { upload, progress, isUploading, error, bundleData, reset };
}
