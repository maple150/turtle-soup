import { useEffect, useRef, useCallback, useState } from 'react';
import { fetchSession } from '../api/client';
import type { SessionInfo } from '../types';
import { DEFAULT_POLLING_CONFIG, calculatePollInterval, calculateBackoffDelay, type PollingConfig } from '../utils/polling';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error' | 'rate_limited';

export interface UsePollingSessionProps {
  sessionId: string | null;
  config?: Partial<PollingConfig>;
  onUpdate?: (session: SessionInfo) => void;
  onError?: (error: Error) => void;
}

export interface UsePollingSessionReturn {
  isConnected: boolean;
  isPolling: boolean;
  lastSyncTime: Date | null;
  connectionState: ConnectionState;
  pollInterval: number;
  retryCount: number;
  forceSync: () => Promise<void>;
  stopPolling: () => void;
  startPolling: () => void;
}

/**
 * Custom hook for polling session updates with adaptive intervals
 */
export function usePollingSession(props: UsePollingSessionProps): UsePollingSessionReturn {
  const {
    sessionId,
    config: userConfig,
    onUpdate,
    onError
  } = props;

  const config = { ...DEFAULT_POLLING_CONFIG, ...userConfig };

  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [isPolling, setIsPolling] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [pollInterval, setPollInterval] = useState(config.baseInterval);
  const [retryCount, setRetryCount] = useState(0);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityTimeRef = useRef<Date>(new Date());
  const isRateLimitedRef = useRef(false);

  // Reset activity time on user interaction
  const updateActivity = useCallback(() => {
    lastActivityTimeRef.current = new Date();
  }, []);

  // Check if session should be updated
  const shouldUpdateSession = useCallback(
    (currentSession: SessionInfo | null, newSession: SessionInfo): boolean => {
      if (!currentSession) return true;

      // Check if chat history has changed
      if (currentSession.chat.length !== newSession.chat.length) return true;

      // Check if any message content has changed
      for (let i = 0; i < currentSession.chat.length; i++) {
        if (currentSession.chat[i].content !== newSession.chat[i].content) {
          return true;
        }
      }

      return false;
    },
    []
  );

  // Poll for updates
  const poll = useCallback(async () => {
    if (!sessionId || isRateLimitedRef.current) return;

    setConnectionState('connecting');

    try {
      const session = await fetchSession(sessionId);

      // Reset retry count on success
      setRetryCount(0);
      setConnectionState('connected');
      setLastSyncTime(new Date());
      lastActivityTimeRef.current = new Date();

      // Check if there are updates
      const hasChanges = shouldUpdateSession(null, session);

      // Calculate adaptive interval
      const interval = calculatePollInterval(config, lastActivityTimeRef.current, hasChanges);
      setPollInterval(interval);

      // Trigger update callback
      if (onUpdate) {
        onUpdate(session);
      }

    } catch (error) {
      const err = error as Error;

      // Handle rate limiting
      if (err.message.includes('429') || err.message.includes('rate')) {
        setConnectionState('rate_limited');
        isRateLimitedRef.current = true;

        // Wait 60 seconds before retrying
        setTimeout(() => {
          isRateLimitedRef.current = false;
          startPolling();
        }, 60000);

        if (onError) {
          onError(new Error('Rate limited. Please wait before retrying.'));
        }
        return;
      }

      // Handle other errors with exponential backoff
      const newRetryCount = retryCount + 1;
      setRetryCount(newRetryCount);

      if (newRetryCount >= config.maxRetries) {
        setConnectionState('error');
        stopPolling();
        if (onError) {
          onError(new Error(`Failed to connect after ${config.maxRetries} retries`));
        }
        return;
      }

      const backoffDelay = calculateBackoffDelay(config, newRetryCount);
      setPollInterval(backoffDelay);

      if (onError) {
        onError(err);
      }
    }
  }, [sessionId, config, retryCount, shouldUpdateSession, onUpdate, onError]);

  // Start polling
  const startPolling = useCallback(() => {
    if (!sessionId || isPolling) return;

    setIsPolling(true);

    // Immediate poll
    poll().then(() => {
      // Set up interval polling
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }

      pollingIntervalRef.current = setInterval(() => {
        poll();
      }, pollInterval);
    });
  }, [sessionId, isPolling, pollInterval, poll]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setIsPolling(false);
    setConnectionState('disconnected');
  }, []);

  // Force sync immediately
  const forceSync = useCallback(async () => {
    if (!sessionId) return;
    await poll();
  }, [sessionId, poll]);

  // Start polling when sessionId changes
  useEffect(() => {
    if (!sessionId) {
      stopPolling();
      return;
    }

    startPolling();

    return () => {
      stopPolling();
    };
  }, [sessionId, startPolling, stopPolling]);

  // Handle visibility changes to pause polling when tab is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Pause polling when tab is hidden
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        setIsPolling(false);
      } else {
        // Resume polling when tab is visible
        if (sessionId && connectionState !== 'error') {
          startPolling();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [sessionId, connectionState, startPolling]);

  return {
    isConnected: connectionState === 'connected',
    isPolling,
    lastSyncTime,
    connectionState,
    pollInterval,
    retryCount,
    forceSync,
    stopPolling,
    startPolling
  };
}
