import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useWebSocket — Auto-reconnecting WebSocket hook for pulse events.
 *
 * Returns:
 *   isConnected — boolean
 *   pulseEvents — array of all received pulse events
 *   latestPulse — the most recent pulse event or null
 */
export default function useWebSocket(bundleId) {
  const [isConnected, setIsConnected] = useState(false);
  const [pulseEvents, setPulseEvents] = useState([]);
  const [latestPulse, setLatestPulse] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const reconnectAttempts = useRef(0);

  const connect = useCallback(() => {
    if (!bundleId) return;

    // Determine WebSocket URL — use API URL in production, current host in dev
    const apiUrl = import.meta.env.VITE_API_URL || '';
    let url;
    if (apiUrl) {
      // Production: derive wss:// from the backend API URL
      const base = apiUrl.replace(/^http/, 'ws');
      url = `${base}/ws/bundle/${bundleId}`;
    } else {
      // Local dev: Vite proxy handles /ws/* → backend
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      url = `${protocol}//${window.location.host}/ws/bundle/${bundleId}`;
    }

    try {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        setIsConnected(true);
        reconnectAttempts.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setPulseEvents((prev) => [...prev, data]);
          setLatestPulse(data);
        } catch {
          // Ignore non-JSON messages
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;

        // Auto-reconnect with exponential backoff (max 30s)
        const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 30000);
        reconnectAttempts.current += 1;
        reconnectTimer.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };

      wsRef.current = ws;
    } catch {
      // Connection failed, will retry via onclose
    }
  }, [bundleId]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // Prevent reconnect on intentional close
        wsRef.current.close();
      }
    };
  }, [connect]);

  // Reset events when bundleId changes
  useEffect(() => {
    setPulseEvents([]);
    setLatestPulse(null);
  }, [bundleId]);

  return { isConnected, pulseEvents, latestPulse };
}
