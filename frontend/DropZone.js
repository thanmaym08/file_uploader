import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { QRCodeSVG } from 'qrcode.react';
import './DropZone.css';

const API_URL = 'http://localhost:8000';

const DropZone = () => {
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState('');
  const [fileId, setFileId] = useState('');
  const [recipientConnected, setRecipientConnected] = useState(false);
  
  // Options
  const [ghostMode, setGhostMode] = useState(false);
  const [burnOnRead, setBurnOnRead] = useState(false);
  
  // Ref for WebSocket
  const ws = useRef(null);

  const onDrop = useCallback(async (acceptedFiles) => {
    const selectedFile = acceptedFiles[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    
    // Create FormData
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('ghost_mode', ghostMode);
    formData.append('burn_on_read', burnOnRead);
    formData.append('ttl_seconds', 3600);

    try {
      const response = await fetch(`${API_URL}/drop/upload`, {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      if (response.ok) {
        setFileId(data.file_id);
        setFileUrl(`${API_URL}/drop/download/${data.file_id}`);
        setupWebSocket(data.file_id);
      } else {
        console.error('Upload failed:', data);
        alert('Upload failed');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
    }
  }, [ghostMode, burnOnRead]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  const setupWebSocket = (id) => {
    if (ws.current) ws.current.close();
    
    const socket = new WebSocket(`ws://localhost:8000/ws/file/${id}`);
    
    socket.onopen = () => console.log('WebSocket connected for file:', id);
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.status === 'Recipient Connected!') {
        setRecipientConnected(true);
      }
    };
    socket.onclose = () => console.log('WebSocket disconnected');
    ws.current = socket;
  };

  useEffect(() => {
    return () => {
      if (ws.current) ws.current.close();
    };
  }, []);

  const handleRefine = async () => {
    if (!fileId) return;
    try {
      const response = await fetch(`${API_URL}/drop/refine/${fileId}`, {
        method: 'POST'
      });
      const data = await response.json();
      alert(data.message || 'Refinement complete!');
    } catch (error) {
      console.error('Refinement error:', error);
    }
  };

  const renderPreview = () => {
    if (!file) return null;
    
    const isImage = file.type.startsWith('image/');
    const isCode = file.type.startsWith('text/') || file.type === 'application/json';

    return (
      <div className="preview-area">
        {isImage && (
          <img src={URL.createObjectURL(file)} alt="Preview" className="preview-img" />
        )}
        {isCode && (
          <pre className="preview-code">
             {`// Code preview snippet for ${file.name}\n// In production, Monaco/Prism renders here.`}
          </pre>
        )}
        {!isImage && !isCode && (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#8b949e' }}>
            Preview not available for {file.type || 'this file type'}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`ag-drop-container ${fileUrl ? 'has-upload' : ''}`}>
      {/* Upload Panel */}
      <div className="glass-panel">
        <div 
          {...getRootProps()} 
          className={`dropzone-area ${isDragActive ? 'active' : ''}`}
        >
          <input {...getInputProps()} />
          <div className="drop-icon">✨</div>
          <h2 className="drop-title">
            {isDragActive ? 'Drop to upload' : 'AG-Drop'}
          </h2>
          <p className="drop-subtitle">
            Drag & drop any file, or click to select
          </p>
        </div>

        <div className="options-row">
          <label className="toggle-label">
            <input 
              type="checkbox" 
              checked={ghostMode} 
              onChange={(e) => setGhostMode(e.target.checked)} 
            />
            Ghost Mode (RAM only)
          </label>
          <label className="toggle-label">
            <input 
              type="checkbox" 
              checked={burnOnRead} 
              onChange={(e) => setBurnOnRead(e.target.checked)} 
            />
            Download Once & Burn
          </label>
        </div>
      </div>

      {/* Result Panel */}
      {fileUrl && (
        <div className="glass-panel result-panel">
          {recipientConnected && (
            <div className="status-badge">
              <span className="dot"></span>
              Recipient Connected
            </div>
          )}
          
          <div className="qr-container">
            <QRCodeSVG 
              value={fileUrl} 
              size={180} 
              bgColor={"#ffffff"} 
              fgColor={"#0d0f12"} 
              level={"H"} 
              includeMargin={false} 
            />
          </div>
          
          <div className="share-url">
            {fileUrl}
          </div>

          {renderPreview()}

          {file?.type.startsWith('image/') && !ghostMode && (
             <button className="refine-btn" onClick={handleRefine}>
               Refine with AI (SRResNet)
             </button>
          )}
        </div>
      )}
    </div>
  );
};

export default DropZone;
