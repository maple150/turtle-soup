/**
 * Scroll-related utility functions
 */

/**
 * Check if a scrollable element is near the bottom
 * @param element - The scrollable element
 * @param threshold - Distance from bottom in pixels to consider "near bottom"
 */
export function isNearBottom(element: HTMLElement, threshold: number = 100): boolean {
  const { scrollTop, scrollHeight, clientHeight } = element;
  const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
  return distanceFromBottom <= threshold;
}

/**
 * Smoothly scroll an element to the bottom
 * @param element - The scrollable element
 * @param smooth - Whether to use smooth scrolling
 */
export function scrollToBottom(element: HTMLElement, smooth: boolean = true): void {
  element.scrollTo({
    top: element.scrollHeight,
    behavior: smooth ? 'smooth' : 'auto'
  });
}

/**
 * Get the current scroll position of an element
 * @param element - The scrollable element
 */
export interface ScrollPosition {
  scrollTop: number;
  scrollHeight: number;
  clientHeight: number;
  distanceFromBottom: number;
  isNearBottom: boolean;
}

export function getScrollPosition(element: HTMLElement, threshold: number = 100): ScrollPosition {
  const { scrollTop, scrollHeight, clientHeight } = element;
  const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

  return {
    scrollTop,
    scrollHeight,
    clientHeight,
    distanceFromBottom,
    isNearBottom: distanceFromBottom <= threshold
  };
}
