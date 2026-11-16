'use client';

import React, { useState, useEffect } from 'react';
import { MaterialIcon } from '@/components/ui/MaterialIcon';

export function OfflineConnectivityDetector() {
  const [isOffline, setIsOffline] = useState(false);
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    // Check initial state
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      setIsOffline(!navigator.onLine);
    }

    const handleOffline = () => {
      setIsOffline(true);
      setShowRestored(false);
    };

    const handleOnline = () => {
      setIsOffline(false);
      setShowRestored(true);
      const timer = setTimeout(() => setShowRestored(false), 4000);
      return () => clearTimeout(timer);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (isOffline) {
    return (
      <aside
        role="alert"
        aria-live="assertive"
        className="sticky top-0 z-50 bg-amber-600 text-white px-4 py-2.5 shadow-md flex items-center justify-between gap-3 text-body-sm font-medium"
      >
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MaterialIcon name="wifi_off" className="text-[20px] shrink-0" />
            <span>
              <strong>Network Offline:</strong> You have lost internet connectivity. Triage submissions require connectivity; your local records remain available. In an emergency, call <strong>999</strong> directly.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsOffline(false)}
            aria-label="Dismiss offline banner"
            className="p-1 rounded hover:bg-amber-700 transition-colors"
          >
            <MaterialIcon name="close" className="text-[18px]" />
          </button>
        </div>
      </aside>
    );
  }

  if (showRestored) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="sticky top-0 z-50 bg-green-700 text-white px-4 py-2 shadow-md flex items-center justify-center gap-2 text-body-sm font-medium transition-all"
      >
        <MaterialIcon name="wifi" className="text-[18px]" />
        <span>Internet connection restored. Synchronizing clinical context.</span>
      </div>
    );
  }

  return null;
}
