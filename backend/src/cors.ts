import { Request, Response, NextFunction } from 'express';
import { config } from './config.js';

/**
 * Cross-Platform CORS Middleware
 * 
 * Supports:
 * - Render / Web deployments (custom domains, Vercel, Netlify)
 * - Local development (localhost, 127.0.0.1, 0.0.0.0)
 * - Android APKs / WebViews (missing Origin header, origin === 'null', capacitor://, ionic://, file://)
 * - Video streaming Range requests (Content-Range, Accept-Ranges, Content-Length)
 */
export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;

  // 1. Determine if the incoming request origin is allowed
  let allowOrigin = '*';

  if (origin) {
    // If allowed origins is wildcard, echo back the origin to allow credentials
    if (config.corsOrigins.includes('*')) {
      allowOrigin = origin;
    } else {
      const isAllowed = config.corsOrigins.some(allowed => {
        if (allowed === origin) return true;
        // Support wildcard subdomains e.g. *.onrender.com or *.vercel.app
        if (allowed.startsWith('*.')) {
          const domain = allowed.slice(2);
          try {
            const parsedUrl = new URL(origin);
            return parsedUrl.hostname.endsWith(domain);
          } catch {
            return false;
          }
        }
        return false;
      });

      if (isAllowed) {
        allowOrigin = origin;
      } else if (
        origin === 'null' ||
        origin.startsWith('capacitor://') ||
        origin.startsWith('ionic://') ||
        origin.startsWith('http://localhost') ||
        origin.startsWith('http://127.0.0.1')
      ) {
        // Always permit local dev & mobile app wrapper origins
        allowOrigin = origin;
      } else {
        // Fallback to configured primary origin or *
        allowOrigin = config.corsOrigins[0] || '*';
      }
    }
  } else {
    // Missing origin: native Android HTTP clients (OkHttp, Retrofit, Flutter, React Native, curl)
    allowOrigin = '*';
  }

  // 2. Set Access-Control Headers
  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, Range, X-Client-Platform, Cache-Control'
  );
  res.setHeader(
    'Access-Control-Expose-Headers',
    'Content-Range, Accept-Ranges, Content-Length, Content-Disposition, X-Total-Count'
  );
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours cache for preflight

  // 3. Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  next();
}
