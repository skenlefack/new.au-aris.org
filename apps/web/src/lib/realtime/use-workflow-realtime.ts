'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getExistingSocket } from './socket';

/**
 * Hook to subscribe to real-time workflow updates for a specific campaign.
 * Joins the `room:campaign:{campaignId}` hierarchical room and listens
 * for DATA_UPDATE messages, triggering React Query cache invalidation.
 *
 * Must be used AFTER `useRealtime()` has established the connection.
 *
 * @param campaignId — The campaign to subscribe to (null to skip)
 */
export function useWorkflowRealtime(campaignId: string | null | undefined): void {
  const queryClient = useQueryClient();
  const joinedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!campaignId) return;

    const socket = getExistingSocket();
    if (!socket?.connected) return;

    const roomId = `room:campaign:${campaignId}`;

    // Avoid re-joining the same room
    if (joinedRef.current === roomId) return;

    // Leave previous room if we switched campaigns
    if (joinedRef.current) {
      socket.emit('LEAVE_ROOM', { roomId: joinedRef.current });
    }

    // Join the campaign room
    socket.emit('JOIN_ROOM', { roomId }, (res: { type?: string }) => {
      if (res?.type === 'ROOM_JOINED') {
        joinedRef.current = roomId;
      }
    });

    // Listen for hierarchical room messages
    const handleMessage = (msg: { type?: string; entity?: string; data?: Record<string, unknown> }) => {
      if (msg?.type === 'DATA_UPDATE') {
        if (msg.entity === 'workflow') {
          queryClient.invalidateQueries({ queryKey: ['workflow'] });
          queryClient.invalidateQueries({ queryKey: ['submissions'] });
        }
        if (msg.entity === 'submission') {
          queryClient.invalidateQueries({ queryKey: ['submissions'] });
          queryClient.invalidateQueries({ queryKey: ['collecte'] });
        }
      }
    };

    socket.on('message', handleMessage);

    return () => {
      socket.off('message', handleMessage);
      if (joinedRef.current === roomId) {
        socket.emit('LEAVE_ROOM', { roomId });
        joinedRef.current = null;
      }
    };
  }, [campaignId, queryClient]);
}

/**
 * Hook to subscribe to real-time updates for a specific submission.
 * Joins the `room:submission:{submissionId}` hierarchical room and
 * triggers cache invalidation when the submission status changes.
 *
 * @param submissionId — The submission to watch (null to skip)
 * @param onStatusChange — Optional callback when status changes
 */
export function useSubmissionRealtime(
  submissionId: string | null | undefined,
  onStatusChange?: (action: string) => void,
): void {
  const queryClient = useQueryClient();
  const joinedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!submissionId) return;

    const socket = getExistingSocket();
    if (!socket?.connected) return;

    const roomId = `room:submission:${submissionId}`;

    if (joinedRef.current === roomId) return;

    if (joinedRef.current) {
      socket.emit('LEAVE_ROOM', { roomId: joinedRef.current });
    }

    socket.emit('JOIN_ROOM', { roomId }, (res: { type?: string }) => {
      if (res?.type === 'ROOM_JOINED') {
        joinedRef.current = roomId;
      }
    });

    const handleMessage = (msg: { type?: string; action?: string; data?: unknown }) => {
      if (msg?.type === 'STATUS_CHANGE') {
        queryClient.invalidateQueries({ queryKey: ['workflow'] });
        queryClient.invalidateQueries({ queryKey: ['submissions', submissionId] });
        if (msg.action && onStatusChange) {
          onStatusChange(msg.action);
        }
      }
    };

    socket.on('message', handleMessage);

    return () => {
      socket.off('message', handleMessage);
      if (joinedRef.current === roomId) {
        socket.emit('LEAVE_ROOM', { roomId });
        joinedRef.current = null;
      }
    };
  }, [submissionId, queryClient, onStatusChange]);
}
