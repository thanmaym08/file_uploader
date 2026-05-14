import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * PulseIndicator — Real-time download pulse animation.
 * Triggered by WebSocket events when someone scans/downloads.
 */

const PULSE_MESSAGES = {
  scan: { icon: '👁️', text: 'Someone scanned your QR!', color: '#4facfe' },
  download_start: { icon: '⬇️', text: 'Download in progress...', color: '#f59e0b' },
  download_complete: { icon: '✅', text: 'Download complete!', color: '#22c55e' },
  download_all_start: { icon: '📦', text: 'Downloading all files...', color: '#f59e0b' },
  download_all_complete: { icon: '🎉', text: 'All files downloaded!', color: '#22c55e' },
};

const PulseIndicator = ({ latestPulse, pulseEvents }) => {
  const pulseInfo = latestPulse ? PULSE_MESSAGES[latestPulse.type] : null;
  const downloadCount = pulseEvents.filter(
    (e) => e.type === 'download_complete' || e.type === 'download_all_complete'
  ).length;

  return (
    <div className="pulse-container">
      <AnimatePresence mode="wait">
        {pulseInfo && (
          <motion.div
            key={latestPulse.type + latestPulse.timestamp}
            className="pulse-card"
            initial={{ opacity: 0, scale: 0.8, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Animated ring */}
            <motion.div
              className="pulse-ring"
              style={{ borderColor: pulseInfo.color }}
              animate={{
                boxShadow: [
                  `0 0 0 0px ${pulseInfo.color}40`,
                  `0 0 0 12px ${pulseInfo.color}00`,
                ],
              }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <span className="pulse-icon">{pulseInfo.icon}</span>
            </motion.div>

            <div className="pulse-info">
              <span className="pulse-text" style={{ color: pulseInfo.color }}>
                {pulseInfo.text}
              </span>
              {latestPulse.filename && (
                <span className="pulse-filename">{latestPulse.filename}</span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {downloadCount > 0 && (
        <motion.div
          className="pulse-counter"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          key={downloadCount}
        >
          <span className="counter-dot" />
          {downloadCount} download{downloadCount !== 1 ? 's' : ''} completed
        </motion.div>
      )}
    </div>
  );
};

export default PulseIndicator;
