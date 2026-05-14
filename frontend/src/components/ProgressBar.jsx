import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * ProgressBar — Animated upload progress with framer-motion.
 * Shows percentage, file count, and a celebration burst on completion.
 */
const ProgressBar = ({ progress, isUploading, fileCount }) => {
  const isComplete = progress >= 100 && !isUploading;

  return (
    <AnimatePresence>
      {(isUploading || isComplete) && (
        <motion.div
          className="progress-container"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="progress-header">
            <span className="progress-label">
              {isComplete ? '✓ Upload Complete' : `Uploading ${fileCount} file${fileCount !== 1 ? 's' : ''}...`}
            </span>
            <motion.span
              className="progress-pct"
              key={progress}
              initial={{ scale: 1.3, color: '#00f2fe' }}
              animate={{ scale: 1, color: isComplete ? '#22c55e' : '#f0f2f5' }}
              transition={{ duration: 0.2 }}
            >
              {progress}%
            </motion.span>
          </div>

          <div className="progress-track">
            <motion.div
              className="progress-fill"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              style={{
                background: isComplete
                  ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                  : 'linear-gradient(90deg, #4facfe, #00f2fe)',
              }}
            />
            {isUploading && (
              <motion.div
                className="progress-shimmer"
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              />
            )}
          </div>

          {/* Completion burst particles */}
          <AnimatePresence>
            {isComplete && (
              <div className="completion-burst">
                {[...Array(8)].map((_, i) => (
                  <motion.span
                    key={i}
                    className="burst-particle"
                    initial={{ scale: 0, x: 0, y: 0 }}
                    animate={{
                      scale: [0, 1, 0],
                      x: Math.cos((i * Math.PI * 2) / 8) * 40,
                      y: Math.sin((i * Math.PI * 2) / 8) * 40,
                    }}
                    transition={{ duration: 0.6, delay: i * 0.04 }}
                  />
                ))}
              </div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ProgressBar;
