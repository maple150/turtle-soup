import React from 'react';
import './MessageIndicator.css';

interface MessageIndicatorProps {
  count: number;
  onClick: () => void;
}

/**
 * Visual indicator for new messages when user is not at bottom
 */
export function MessageIndicator({ count, onClick }: MessageIndicatorProps): React.ReactElement {
  if (count <= 0) return <></>;

  return (
    <button
      type="button"
      className="message-indicator"
      onClick={onClick}
      aria-label={`${count} new messages`}
    >
      <div className="message-indicator-content">
        <span className="message-count">{count}</span>
        <span className="message-text">条新消息</span>
      </div>
    </button>
  );
}
