import React from 'react';
import { Routes, Route } from 'react-router-dom';
import UploadPage from './pages/UploadPage';
import DownloadPage from './pages/DownloadPage';

const App = () => {
  return (
    <div className="app-shell">
      {/* Ambient background orbs */}
      <div className="ambient-orb orb-1" />
      <div className="ambient-orb orb-2" />
      <div className="ambient-orb orb-3" />

      <header className="app-header">
        <a href="/" className="logo-link">
          <span className="logo-icon">⚡</span>
          <span className="logo-text">QuickDrop</span>
          <span className="logo-badge">PRO</span>
        </a>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<UploadPage />} />
          <Route path="/b/:bundleId" element={<DownloadPage />} />
        </Routes>
      </main>

      <footer className="app-footer">
        <p>Files auto-destruct in 24 hours · Lossless HD · End-to-end integrity</p>
      </footer>
    </div>
  );
};

export default App;
