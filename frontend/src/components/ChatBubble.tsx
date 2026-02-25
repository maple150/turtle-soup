import React from 'react';
import type { ChatTurn } from '../types';
import './ChatBubble.css';

interface ChatBubbleProps {
  message: ChatTurn;
  index: number;
  isVisible?: boolean;
}

/**
 * Chat bubble component with staggered animation
 */
export function ChatBubble({ message, index, isVisible = true }: ChatBubbleProps): React.ReactElement {
  if (!isVisible) return <></>;

  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  return (
    <div
      className={`chat-bubble-wrapper ${isUser ? 'user' : 'host'} ${isSystem ? 'system' : ''}`}
      style={{ '--animation-delay': `${index * 50}ms` } as React.CSSProperties}
    >
      <div className="chat-bubble">
        {!isSystem && (
          <div className="chat-meta">
            {isUser ? '你' : '主持人'}
          </div>
        )}
        <div className="chat-content">{message.content}</div>
      </div>
    </div>
  );
}
