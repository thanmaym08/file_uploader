import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * PasswordGate — Password modal for protecting or unlocking bundles.
 *
 * mode="set"    → shown during upload (optional password field)
 * mode="unlock" → shown on download page (required password entry)
 */

const PasswordGate = ({ mode = 'set', onSubmit, onCancel, isLoading, error }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password.trim()) {
      onSubmit(password);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="password-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="password-modal glass-panel"
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="password-modal-icon">
            {mode === 'set' ? '🔐' : '🔒'}
          </div>

          <h3 className="password-modal-title">
            {mode === 'set' ? 'Set Password' : 'Password Required'}
          </h3>
          <p className="password-modal-desc">
            {mode === 'set'
              ? 'Add an optional password to protect your files.'
              : 'This bundle is password-protected. Enter the password to access files.'}
          </p>

          <form onSubmit={handleSubmit} className="password-form">
            <div className="password-input-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                className="input password-input"
                placeholder="Enter password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                disabled={isLoading}
              />
              <button
                type="button"
                className="password-toggle-vis"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>

            {error && (
              <motion.p
                className="password-error"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {error}
              </motion.p>
            )}

            <div className="password-actions">
              {onCancel && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={onCancel}
                  disabled={isLoading}
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!password.trim() || isLoading}
              >
                {isLoading ? 'Verifying...' : mode === 'set' ? 'Set Password' : 'Unlock'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PasswordGate;
