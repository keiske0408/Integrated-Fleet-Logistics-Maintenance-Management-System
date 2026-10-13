/**
 * Resilient, quota-aware browser storage wrapper.
 * Provides safe get/set/remove methods with in-memory fallback
 * and quota-exceeded error handling.
 */

const memoryFallback = new Map<string, string>();

function isQuotaError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof DOMException) {
    return (
      error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      error.code === 22 ||
      error.code === 1014
    );
  }
  const msg = String(error);
  return (
    msg.includes('kQuotaBytes') ||
    msg.includes('quota exceeded') ||
    msg.includes('QuotaExceeded') ||
    msg.includes('QUOTA_BYTES')
  );
}

export const safeStorage = {
  getItem(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch {
      // Access to localStorage might be denied (e.g. incognito/iframe policy)
    }
    return memoryFallback.get(key) ?? null;
  },

  setItem(key: string, value: string): boolean {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
        return true;
      }
    } catch (error) {
      if (isQuotaError(error)) {
        // Attempt selective eviction of non-critical theme caches
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.removeItem('fleet_theme_vars_light');
            window.localStorage.removeItem('fleet_theme_vars_dark');
            window.localStorage.setItem(key, value);
            return true;
          }
        } catch {
          // Fall through to memory fallback
        }
      }
    }
    // Graceful in-memory fallback
    memoryFallback.set(key, value);
    return false;
  },

  removeItem(key: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Ignored
    }
    memoryFallback.delete(key);
  },
};
