/**
 * Centralized API Client Helper for Cross-Platform Consumption
 * Supports Web, Mobile WebView, Capacitor, Cordova, and Android APK builds.
 * 
 * In development / same-host environments, defaults to relative paths ('').
 * When deployed separately (e.g. Render backend + Vercel/Android APK frontend),
 * it routes all /api requests to VITE_API_BASE_URL or runtime configured URL.
 */

// Global window declaration for runtime Android APK / WebView injection
declare global {
  interface Window {
    __ANILOVE_BACKEND_URL__?: string;
  }
}

const STORAGE_KEY_CUSTOM_API = 'anilove_backend_url';

/**
 * Returns the active Backend Base URL without trailing slash.
 * Priority:
 * 1. Runtime window injection (__ANILOVE_BACKEND_URL__) - useful for APK shell wrappers
 * 2. LocalStorage override ('anilove_backend_url') - useful for dev/testing on Android device
 * 3. Vite environment variable VITE_API_BASE_URL or VITE_PUBLIC_API_BASE_URL
 * 4. Empty string '' (relative path for same-origin web hosting)
 */
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    // 1. Runtime injected
    if (window.__ANILOVE_BACKEND_URL__ && typeof window.__ANILOVE_BACKEND_URL__ === 'string') {
      return sanitizeBaseUrl(window.__ANILOVE_BACKEND_URL__);
    }

    // 2. LocalStorage override
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CUSTOM_API);
      if (stored && typeof stored === 'string' && stored.trim().length > 0) {
        return sanitizeBaseUrl(stored);
      }
    } catch {
      // localStorage may be restricted in some sandboxed WebViews
    }
  }

  // 3. Environment variables
  const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined;
  const envUrl = (metaEnv && (metaEnv.VITE_API_BASE_URL || metaEnv.VITE_PUBLIC_API_BASE_URL)) || '';

  if (envUrl && typeof envUrl === 'string') {
    return sanitizeBaseUrl(envUrl);
  }

  // 4. Default: relative path
  return '';
}

/**
 * Sets a custom backend URL at runtime (stored in localStorage)
 */
export function setCustomApiBaseUrl(url: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (url && url.trim().length > 0) {
      localStorage.setItem(STORAGE_KEY_CUSTOM_API, sanitizeBaseUrl(url));
    } else {
      localStorage.removeItem(STORAGE_KEY_CUSTOM_API);
    }
  } catch {
    // ignore
  }
}

/**
 * Cleans and strips trailing slash from base URL
 */
function sanitizeBaseUrl(url: string): string {
  const trimmed = url.trim();
  return trimmed.replace(/\/+$/, '');
}

/**
 * Builds a full API URL from an endpoint path.
 * If endpoint is already an absolute URL (starts with http:// or https://), it is returned as-is.
 * Example:
 *   apiUrl('/api/stream/resolve') => 'https://anilove-backend.onrender.com/api/stream/resolve'
 *   apiUrl('/api/stream/resolve') (no base set) => '/api/stream/resolve'
 */
export function apiUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('//') || path.startsWith('data:')) {
    return path;
  }

  const base = getApiBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  if (!base) {
    return normalizedPath;
  }

  return `${base}${normalizedPath}`;
}

/**
 * Fetch wrapper automatically prepending the backend API base URL
 */
export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const targetUrl = apiUrl(input);
  return fetch(targetUrl, init);
}

/**
 * Resolves a media endpoint via JSON-mode for mobile APK / WebView clients.
 * Requests the endpoint with ?json=1 and Accept: application/json.
 * Returns the resolved streamUrl/mediaUrl/downloadUrl, or falls back to apiUrl(endpoint).
 */
export async function resolveMediaUrl(
  endpoint: string,
  field: 'streamUrl' | 'downloadUrl' | 'thumbnailUrl' | 'mediaUrl' = 'streamUrl'
): Promise<string> {
  const fallback = apiUrl(endpoint);
  try {
    const separator = endpoint.includes('?') ? '&' : '?';
    const jsonUrl = `${endpoint}${separator}json=1`;
    const res = await apiFetch(jsonUrl, {
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data[field]) {
        return data[field];
      }
    }
  } catch {
    // Fallback to direct redirect URL
  }
  return fallback;
}

