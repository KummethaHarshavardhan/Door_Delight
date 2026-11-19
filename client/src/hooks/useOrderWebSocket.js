import { useEffect, useRef } from 'react';

const resolveWsBaseUrl = () => {
  const configured = import.meta.env.VITE_WS_URL?.trim().replace(/\/+$/, '');
  if (configured) {
    return configured.endsWith('/ws') ? configured : `${configured}/ws`;
  }
  if (typeof window !== 'undefined' && window.location.hostname === 'door-delight-1.onrender.com') {
    return 'wss://door-delight.onrender.com/ws';
  }
  return 'ws://localhost:8000/ws';
};

const WS_BASE_URL = resolveWsBaseUrl();

export function useOrderWebSocket({ orderId = null, enabled = true, onMessage }) {
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  useEffect(() => {
    if (!enabled) return;
    const token = localStorage.getItem('dd_token');
    if (!token) return;

    let ws = null;
    let reconnectTimer = null;
    let isUnmounted = false;
    let retryDelayMs = 2000;

    const connect = () => {
      if (isUnmounted) return;
      const path = orderId ? `/orders/${orderId}` : '/feed';
      const url = `${WS_BASE_URL}${path}?token=${encodeURIComponent(token)}`;
      ws = new WebSocket(url);

      ws.onopen = () => {
        retryDelayMs = 2000;
        if (isUnmounted) {
          ws.close();
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (onMessageRef.current) {
            onMessageRef.current(data);
          }
        } catch {
          // Ignore malformed frames
        }
      };

      ws.onclose = () => {
        if (!isUnmounted) {
          const delay = retryDelayMs;
          retryDelayMs = Math.min(retryDelayMs * 2, 15000);
          reconnectTimer = setTimeout(connect, delay);
        }
      };

      ws.onerror = () => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      };
    };

    connect();

    return () => {
      isUnmounted = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [orderId, enabled]);
}
