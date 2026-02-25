import React from 'react';
import type { ConnectionState } from '../hooks/usePollingSession';
import { ConnectionStatus } from './ConnectionStatus';
import './MobileHeader.css';

interface MobileHeaderProps {
  title: string;
  connectionState: ConnectionState;
  lastSyncTime: Date | null;
  pollInterval: number;
  retryCount?: number;
  onMenuToggle: () => void;
  showBackButton?: boolean;
  onBack?: () => void;
  activePanel?: 'list' | 'chat';
}

/**
 * Mobile-only header component with back button, title, and connection status
 */
export function MobileHeader({
  title,
  connectionState,
  lastSyncTime,
  pollInterval,
  retryCount = 0,
  onMenuToggle,
  showBackButton = false,
  onBack,
  activePanel = 'list'
}: MobileHeaderProps): React.ReactElement {
  return (
    <header className="mobile-header">
      <div className="mobile-header-left">
        {showBackButton && (
          <button
            type="button"
            className="mobile-back-button"
            onClick={onBack}
            aria-label="返回"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}
        <h1 className="mobile-header-title">{title}</h1>
      </div>

      <div className="mobile-header-right">
        <ConnectionStatus
          state={connectionState}
          lastSyncTime={lastSyncTime}
          pollInterval={pollInterval}
          retryCount={retryCount}
          isMobile={true}
        />
        <button
          type="button"
          className="mobile-menu-button"
          onClick={onMenuToggle}
          aria-label="切换面板"
        >
          <span className="menu-icon">
            <span></span>
            <span></span>
            <span></span>
          </span>
        </button>
      </div>
    </header>
  );
}
