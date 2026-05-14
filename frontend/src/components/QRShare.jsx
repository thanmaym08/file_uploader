import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { motion } from 'framer-motion';

/**
 * QRShare — Displays QR code and shareable link for a bundle.
 * One QR code to access the entire bundle (all files).
 */

const QRShare = ({ bundleId }) => {
  const [copied, setCopied] = useState(false);
  const shareUrl = `${window.location.origin}/b/${bundleId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.createElement('input');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'QuickDrop Pro',
          text: 'Download my files:',
          url: shareUrl,
        });
      } catch {
        // User cancelled
      }
    }
  };

  return (
    <motion.div
      className="qr-share"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="qr-code-wrap">
        <QRCodeSVG
          value={shareUrl}
          size={180}
          bgColor="#ffffff"
          fgColor="#0d1017"
          level="H"
          includeMargin={false}
          imageSettings={{
            src: '',
            height: 0,
            width: 0,
          }}
        />
      </div>

      <p className="qr-instruction">Scan to download · Expires in 24h</p>

      <div className="share-url-bar">
        <code className="share-url-text">{shareUrl}</code>
        <button
          className="btn btn-ghost share-copy-btn"
          onClick={handleCopy}
        >
          {copied ? '✓ Copied' : '📋 Copy'}
        </button>
      </div>

      {typeof navigator.share === 'function' && (
        <button
          className="btn btn-secondary share-native-btn"
          onClick={handleNativeShare}
        >
          📤 Share via...
        </button>
      )}
    </motion.div>
  );
};

export default QRShare;
