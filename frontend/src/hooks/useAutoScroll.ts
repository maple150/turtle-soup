import { useEffect, useRef, useState, useCallback } from 'react';
import { isNearBottom, scrollToBottom, getScrollPosition, type ScrollPosition } from '../utils/scroll';

export interface UseAutoScrollOptions {
  threshold?: number; // Distance from bottom to consider "near bottom" (default: 100px)
  smooth?: boolean; // Use smooth scrolling (default: true)
  autoScrollOnNewMessage?: boolean; // Auto-scroll on new messages (default: true)
}

export interface UseAutoScrollReturn {
  chatLogRef: React.RefObject<HTMLDivElement>;
  scrollPosition: ScrollPosition;
  scrollToBottom: (smooth?: boolean) => void;
  manualScroll: () => void; // Call this when user manually scrolls
}

/**
 * Custom hook for chat auto-scroll with user position awareness
 */
export function useAutoScroll(options: UseAutoScrollOptions = {}): UseAutoScrollReturn {
  const {
    threshold = 100,
    smooth = true,
    autoScrollOnNewMessage = true
  } = options;

  const chatLogRef = useRef<HTMLDivElement>(null);
  const [scrollPosition, setScrollPosition] = useState<ScrollPosition>({
    scrollTop: 0,
    scrollHeight: 0,
    clientHeight: 0,
    distanceFromBottom: 0,
    isNearBottom: true
  });
  const [shouldAutoScroll, setShouldAutoScroll] = useState(autoScrollOnNewMessage);

  // Update scroll position on scroll events
  const updateScrollPosition = useCallback(() => {
    const element = chatLogRef.current;
    if (!element) return;

    const position = getScrollPosition(element, threshold);
    setScrollPosition(position);

    // User is manually scrolling near bottom, enable auto-scroll
    if (position.isNearBottom) {
      setShouldAutoScroll(true);
    }
  }, [threshold]);

  // Manual scroll handler - disable auto-scroll when user scrolls away from bottom
  const manualScroll = useCallback(() => {
    const element = chatLogRef.current;
    if (!element) return;

    const position = getScrollPosition(element, threshold);

    // If user scrolls up significantly, disable auto-scroll
    if (!position.isNearBottom) {
      setShouldAutoScroll(false);
    }
  }, [threshold]);

  // Scroll to bottom function
  const scrollToBottomHandler = useCallback((useSmooth: boolean = smooth) => {
    const element = chatLogRef.current;
    if (!element) return;
    scrollToBottom(element, useSmooth);
    setShouldAutoScroll(true);
  }, [smooth]);

  // Auto-scroll when new message arrives
  useEffect(() => {
    const element = chatLogRef.current;
    if (!element || !autoScrollOnNewMessage) return;

    const observer = new MutationObserver(() => {
      if (shouldAutoScroll) {
        scrollToBottom(element, smooth);
      }
    });

    observer.observe(element, {
      childList: true,
      subtree: true
    });

    return () => observer.disconnect();
  }, [shouldAutoScroll, autoScrollOnNewMessage, smooth]);

  // Attach scroll event listener
  useEffect(() => {
    const element = chatLogRef.current;
    if (!element) return;

    element.addEventListener('scroll', updateScrollPosition);

    // Initial scroll to bottom
    requestAnimationFrame(() => {
      updateScrollPosition();
      if (element.scrollHeight > element.clientHeight) {
        scrollToBottom(element, false);
      }
    });

    return () => {
      element.removeEventListener('scroll', updateScrollPosition);
    };
  }, [updateScrollPosition]);

  return {
    chatLogRef,
    scrollPosition,
    scrollToBottom: scrollToBottomHandler,
    manualScroll
  };
}
