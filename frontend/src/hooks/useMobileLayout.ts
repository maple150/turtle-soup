import { useState, useEffect, useCallback } from 'react';

export type ActivePanel = 'list' | 'chat';

export interface UseMobileLayoutReturn {
  isMobile: boolean;
  isTablet: boolean;
  activePanel: ActivePanel;
  setActivePanel: (panel: ActivePanel) => void;
  togglePanel: () => void;
}

const BREAKPOINTS = {
  mobile: 768, // Below this is mobile
  tablet: 992  // Between mobile and tablet
};

/**
 * Custom hook for responsive layout management
 */
export function useMobileLayout(): UseMobileLayoutReturn {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [activePanel, setActivePanel] = useState<ActivePanel>('list');

  // Check viewport size
  const checkViewport = useCallback(() => {
    const width = window.innerWidth;
    setIsMobile(width < BREAKPOINTS.mobile);
    setIsTablet(width >= BREAKPOINTS.mobile && width < BREAKPOINTS.tablet);
  }, []);

  // Initialize and listen for resize
  useEffect(() => {
    checkViewport();

    const handleResize = () => {
      checkViewport();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [checkViewport]);

  // Reset to list panel when switching to tablet/desktop
  useEffect(() => {
    if (!isMobile) {
      setActivePanel('list');
    }
  }, [isMobile]);

  // Toggle between panels on mobile
  const togglePanel = useCallback(() => {
    setActivePanel(prev => prev === 'list' ? 'chat' : 'list');
  }, []);

  return {
    isMobile,
    isTablet,
    activePanel,
    setActivePanel,
    togglePanel
  };
}
