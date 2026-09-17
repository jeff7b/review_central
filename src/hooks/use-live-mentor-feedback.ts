"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import type { MentorFeedback } from '@/types';

interface UseLiveMentorFeedbackOptions {
  employeeId: string;
  initialFeedback?: MentorFeedback | null;
  role?: 'mentor' | 'employee';
}

export function useLiveMentorFeedback({
  employeeId,
  initialFeedback = null,
  role = 'employee',
}: UseLiveMentorFeedbackOptions) {
  const [feedback, setFeedback] = useState<MentorFeedback | null>(initialFeedback);
  const [isLoading, setIsLoading] = useState<boolean>(!initialFeedback && !!employeeId);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(
    initialFeedback ? new Date(initialFeedback.lastUpdated) : null
  );

  const channelRef = useRef<BroadcastChannel | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const feedbackRef = useRef<MentorFeedback | null>(feedback);

  // Keep ref up to date
  useEffect(() => {
    feedbackRef.current = feedback;
  }, [feedback]);

  // Handle incoming remote feedback
  const handleRemoteUpdate = useCallback((newFeedback: MentorFeedback | null) => {
    setIsLoading(false);
    if (!newFeedback) return;
    setFeedback((prev) => {
      if (!prev) {
        setLastSyncedAt(new Date(newFeedback.lastUpdated));
        return newFeedback;
      }
      // Compare lastUpdated
      const prevTime = new Date(prev.lastUpdated).getTime();
      const newTime = new Date(newFeedback.lastUpdated).getTime();
      if (newTime >= prevTime) {
        setLastSyncedAt(new Date(newFeedback.lastUpdated));
        return newFeedback;
      }
      return prev;
    });
  }, []);

  // 1. Setup BroadcastChannel for instant same-browser cross-tab sync
  useEffect(() => {
    if (typeof window === 'undefined' || !employeeId) return;

    const channelName = `rc-mentor-sync-${employeeId}`;
    try {
      const channel = new BroadcastChannel(channelName);
      channelRef.current = channel;

      channel.onmessage = (event) => {
        if (event.data?.type === 'SYNC_FEEDBACK' && event.data.payload) {
          handleRemoteUpdate(event.data.payload);
        }
      };
    } catch (e) {
      console.warn('BroadcastChannel not supported:', e);
    }

    return () => {
      channelRef.current?.close();
      channelRef.current = null;
    };
  }, [employeeId, handleRemoteUpdate]);

  // 2. Setup Server-Sent Events (SSE) stream for live multi-device / network updates and fetch initial feedback immediately
  useEffect(() => {
    if (typeof window === 'undefined' || !employeeId) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    // Immediate initial fetch to avoid delay before first SSE or poll
    fetch(`/api/mentor-feedback/${employeeId}`, {
      headers: { 'Accept': 'application/json' },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (isMounted) {
          if (json && json.feedback) {
            handleRemoteUpdate(json.feedback);
          } else {
            setIsLoading(false);
          }
        }
      })
      .catch((e) => {
        if (isMounted) setIsLoading(false);
      });

    function connectSSE() {
      try {
        const es = new EventSource(`/api/mentor-feedback/${employeeId}`);
        eventSourceRef.current = es;

        es.onopen = () => {
          if (isMounted) setIsConnected(true);
        };

        es.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data) as MentorFeedback;
            if (data && isMounted) {
              handleRemoteUpdate(data);
              setIsConnected(true);
            }
          } catch (err) {
            console.error('Failed to parse SSE mentor feedback:', err);
          }
        };

        es.onerror = () => {
          if (isMounted) setIsConnected(false);
          es.close();
          // Attempt reconnect in 4 seconds
          setTimeout(() => {
            if (isMounted) connectSSE();
          }, 4000);
        };
      } catch (err) {
        console.warn('Failed to initialize EventSource:', err);
      }
    }

    connectSSE();

    // 3. Fallback periodic polling every 4 seconds to guarantee consistency
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/mentor-feedback/${employeeId}`, {
          headers: { 'Accept': 'application/json' },
        });
        if (res.ok) {
          const json = await res.json();
          if (json && json.feedback && isMounted) {
            handleRemoteUpdate(json.feedback);
            setIsConnected(true);
          }
        }
      } catch (e) {
        // network silent fail
      }
    }, 4000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, [employeeId, handleRemoteUpdate]);

  // 4. Function to update feedback (used by Mentor or Employee)
  const saveFeedback = useCallback(
    async (partial: Partial<MentorFeedback>, immediate = false) => {
      const current = feedbackRef.current;
      const now = new Date().toISOString();

      const optimistic: MentorFeedback = {
        id: current?.id || `mf-${employeeId}`,
        employeeId,
        employeeName: current?.employeeName || 'Team Member',
        mentorId: current?.mentorId || 'mentor-1',
        mentorName: current?.mentorName || 'Team Leader',
        mentorRole: current?.mentorRole || 'Team Leader / Mentor',
        cycleId: current?.cycleId || 'current-cycle',
        cycleName: current?.cycleName || 'Current Review Cycle',
        sharedNotes: partial.sharedNotes !== undefined ? partial.sharedNotes : (current?.sharedNotes || ''),
        strengths: partial.strengths || current?.strengths || [],
        growthAreas: partial.growthAreas || current?.growthAreas || [],
        actionItems: partial.actionItems || current?.actionItems || [],
        isShared: partial.isShared !== undefined ? partial.isShared : (current?.isShared ?? true),
        lastUpdated: now,
        status: partial.status || current?.status || 'in_meeting',
      };

      // 1. Optimistic local update
      setFeedback(optimistic);
      setLastSyncedAt(new Date(now));

      // 2. Instant broadcast to other open tabs/windows
      try {
        channelRef.current?.postMessage({
          type: 'SYNC_FEEDBACK',
          payload: optimistic,
        });
      } catch (e) {
        // ignore
      }

      // 3. Debounced or immediate network persist
      const pushToServer = async () => {
        setIsSyncing(true);
        try {
          const res = await fetch(`/api/mentor-feedback/${employeeId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(optimistic),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.feedback) {
              setFeedback(data.feedback);
              setLastSyncedAt(new Date(data.feedback.lastUpdated));
            }
          }
        } catch (err) {
          console.error('Failed to sync mentor feedback with server:', err);
        } finally {
          setIsSyncing(false);
        }
      };

      if (immediate) {
        if (debounceTimeoutRef.current) {
          clearTimeout(debounceTimeoutRef.current);
          debounceTimeoutRef.current = null;
        }
        await pushToServer();
      } else {
        if (debounceTimeoutRef.current) {
          clearTimeout(debounceTimeoutRef.current);
        }
        debounceTimeoutRef.current = setTimeout(pushToServer, 600);
      }
    },
    [employeeId]
  );

  return {
    feedback,
    isLoading,
    setFeedback,
    saveFeedback,
    isConnected,
    isSyncing,
    lastSyncedAt,
  };
}
