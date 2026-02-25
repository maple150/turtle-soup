/**
 * Polling utility functions
 */

export interface PollingConfig {
  baseInterval: number; // Base polling interval in ms (default: 2000)
  maxInterval: number; // Max interval when idle (default: 10000)
  minInterval: number; // Min interval when active (default: 1000)
  activityTimeout: number; // Time before considering idle (default: 30000)
  retryDelay: number; // Initial retry delay (default: 1000)
  maxRetries: number; // Max retry attempts (default: 3)
  backoffMultiplier: number; // Exponential backoff (default: 2)
}

export const DEFAULT_POLLING_CONFIG: PollingConfig = {
  baseInterval: 2000,
  maxInterval: 10000,
  minInterval: 1000,
  activityTimeout: 30000,
  retryDelay: 1000,
  maxRetries: 3,
  backoffMultiplier: 2
};

/**
 * Calculate adaptive polling interval based on activity
 */
export function calculatePollInterval(
  config: PollingConfig,
  lastActivityTime: Date,
  hasActiveChanges: boolean
): number {
  const timeSinceActivity = Date.now() - lastActivityTime.getTime();

  // High activity (recent changes) → Fast polling
  if (hasActiveChanges) {
    return config.minInterval;
  }

  // Recent user activity → Medium polling
  if (timeSinceActivity < config.activityTimeout) {
    return config.baseInterval;
  }

  // Idle → Slow polling
  return Math.min(config.maxInterval, config.baseInterval * 3);
}

/**
 * Calculate exponential backoff delay for retries
 */
export function calculateBackoffDelay(
  config: PollingConfig,
  retryCount: number
): number {
  return config.retryDelay * Math.pow(config.backoffMultiplier, retryCount);
}

/**
 * Debounce function for rapid updates
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}
