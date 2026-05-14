import { useState, useEffect, useRef } from 'react';

/**
 * useWebSocket (Now using HTTP Polling)
 *
 * Returns:
 *   isConnected — boolean
 *   pulseEvents — array of all received pulse events
 *   latestPulse — the most recent pulse event or null
 */
export default function useWebSocket(bundleId) {
  const [isConnected, setIsConnected] = useState(true); // Always true for HTTP
  const [pulseEvents, setPulseEvents] = useState([]);
  const [latestPulse, setLatestPulse] = useState(null);
  const nextIdx = useRef(0);

  useEffect(() => {
    if (!bundleId) return;
    let isSubscribed = true;

    const poll = async () => {
      try {
        const res = await fetch(`/api/drop/bundle/${bundleId}/events?since_idx=${nextIdx.current}`);
        if (res.ok) {
          const data = await res.json();
          if (data.events && data.events.length > 0 && isSubscribed) {
            setPulseEvents(prev => [...prev, ...data.events]);
            setLatestPulse(data.events[data.events.length - 1]);
            nextIdx.current += data.events.length;
          }
        }
      } catch (e) {
        // Ignore network errors in polling
      }
    };

    const timer = setInterval(poll, 2000);
    poll(); // initial fetch

    return () => {
      isSubscribed = false;
      clearInterval(timer);
    };
  }, [bundleId]);

  // Reset events when bundleId changes
  useEffect(() => {
    setPulseEvents([]);
    setLatestPulse(null);
    nextIdx.current = 0;
  }, [bundleId]);

  return { isConnected, pulseEvents, latestPulse };
}
