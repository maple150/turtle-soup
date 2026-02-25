import React from 'react';
import type { ConnectionState } from '../hooks/usePollingSession';
import './ConnectionStatus.css';

interface ConnectionStatusProps {
  state: ConnectionState;
  lastSyncTime: Date | null;
  pollInterval: number;
  retryCount?: number;
  isMobile?: boolean;
}

/**
 * Real-time sync status display with animated indicators
 */
export function ConnectionStatus({
  state,
  lastSyncTime,
  pollInterval,
  retryCount = 0,
  isMobile = false
}: ConnectionStatusProps): React.ReactElement {
  const formatTimeAgo = (date: Date | null): string => {
    if (!date) return '-';
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diff < 60) return '刚刚';
    if (diff < 120) return '1分钟前';
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
    return '更早';
  };

  const getIntervalText = (interval: number): string => {
    if (interval < 1500) return '1s';
    if (interval < 3000) return '2s';
    if (interval < 6000) return '5s';
    return '10s';
  };

  const getStatusInfo = () => {
    switch (state) {
      case 'connected':
        return {
          icon: '●',
          className: 'connected',
          text: '已同步'
        };
      case 'connecting':
        return {
          icon: '○',
          className: 'connecting',
          text: '连接中...'
        };
      case 'error':
        return {
          icon: '✕',
          className: 'error',
          text: retryCount > 0 ? `重试中 (${retryCount})` : '连接失败'
        };
      case 'rate_limited':
        return {
          icon: '⏱',
          className: 'rate-limited',
          text: '限流中'
        };
      default:
        return {
          icon: '○',
          className: 'disconnected',
          text: '未连接'
        };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <div className={`connection-status ${statusInfo.className} ${isMobile ? 'mobile' : ''}`}>
      <div className="connection-indicator">
        <span className="connection-icon">{statusInfo.icon}</span>
        <span className="connection-text">{statusInfo.text}</span>
      </div>

      {state === 'connected' && (
        <div className="connection-details">
          <span className="sync-time">{formatTimeAgo(lastSyncTime)}</span>
          <span className="poll-interval">{getIntervalText(pollInterval)}</span>
        </div>
      )}
    </div>
  );
}
