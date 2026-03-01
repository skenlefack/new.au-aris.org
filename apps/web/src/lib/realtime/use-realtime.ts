'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/auth-store';
import { useRealtimeStore } from './realtime-store';
import { getSocket, disconnectSocket } from './socket';

/**
 * Hook to connect to the WebSocket realtime service.
 * Must be called once in the dashboard layout.
 * Subscribes to channels and invalidates React Query caches on events.
 */
export function useRealtime(): void {
  const accessToken = useAuthStore((s) => s.accessToken);
  const setConnectionStatus = useRealtimeStore(
    (s) => s.setConnectionStatus,
  );
  const incrementOutbreakCount = useRealtimeStore(
    (s) => s.incrementOutbreakCount,
  );
  const addToast = useRealtimeStore((s) => s.addToast);
  const queryClient = useQueryClient();
  const connectedRef = useRef(false);

  useEffect(() => {
    if (!accessToken) {
      disconnectSocket();
      setConnectionStatus('disconnected');
      return;
    }

    if (connectedRef.current) return;
    connectedRef.current = true;

    setConnectionStatus('connecting');
    const socket = getSocket(accessToken);

    socket.on('connect', () => {
      setConnectionStatus('connected');

      // Subscribe to channels
      socket.emit('subscribe', { channel: 'outbreaks' });
      socket.emit('subscribe', { channel: 'workflow' });
      socket.emit('subscribe', { channel: 'sync-status' });
      socket.emit('subscribe', { channel: 'alerts' });
    });

    socket.on('disconnect', () => {
      setConnectionStatus('disconnected');
    });

    socket.on('connect_error', (err) => {
      // Silently handle connection errors when realtime service is offline
      if (process.env.NODE_ENV === 'development') {
        console.debug('[realtime] connection error (service may be offline):', err.message);
      }
      setConnectionStatus('error');
    });

    // ── Outbreak events ──
    socket.on('outbreak:new', () => {
      incrementOutbreakCount();
      queryClient.invalidateQueries({ queryKey: ['health-events'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'kpis'] });
      addToast({
        type: 'warning',
        title: 'New Outbreak Reported',
        message: 'A new disease event has been reported.',
      });
    });

    socket.on('outbreak:confirmed', () => {
      queryClient.invalidateQueries({ queryKey: ['health-events'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'kpis'] });
      addToast({
        type: 'error',
        title: 'Outbreak Confirmed',
        message: 'A disease event has been officially confirmed.',
      });
    });

    socket.on('outbreak:alert', (data: { data?: { severity?: string } }) => {
      queryClient.invalidateQueries({ queryKey: ['health-events'] });
      addToast({
        type: 'error',
        title: 'Continental Alert',
        message: `A regional outbreak alert has been issued${data?.data?.severity ? ` (${data.data.severity})` : ''}.`,
      });
    });

    // ── Workflow events ──
    socket.on('workflow:approved', () => {
      queryClient.invalidateQueries({ queryKey: ['workflow'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'kpis'] });
      addToast({
        type: 'success',
        title: 'Workflow Approved',
        message: 'A validation has been approved.',
      });
    });

    socket.on('workflow:rejected', () => {
      queryClient.invalidateQueries({ queryKey: ['workflow'] });
      addToast({
        type: 'warning',
        title: 'Workflow Rejected',
        message: 'A validation has been rejected. Review required.',
      });
    });

    // ── Notification events ──
    socket.on('notification:new', () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });

    // ── Sync events ──
    socket.on('sync:completed', () => {
      queryClient.invalidateQueries({ queryKey: ['collecte'] });
    });

    // ── Presence ──
    socket.on('presence:updated', () => {
      // Could update a presence store if needed
    });

    return () => {
      connectedRef.current = false;
      disconnectSocket();
      setConnectionStatus('disconnected');
    };
  }, [accessToken, setConnectionStatus, incrementOutbreakCount, addToast, queryClient]);
}
