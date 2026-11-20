// ==============================================================
// LINKEDIN AUTOPILOT - SECURE OAUTH STATE & CSRF DEFENSE
// CRYPTOGRAPHICALLY SECURE, BROWSER-SESSION BOUND OAUTH STATE
// BY GT INNOX LLP
// ==============================================================

import crypto from 'crypto';

export interface OAuthStatePayload {
  stateId: string;
  workspaceId: string;
  userId: string;
  timestamp: number;
  nonce: string;
}

export const OAUTH_STATE_COOKIE_PREFIX = 'oauth_li_state_';
export const OAUTH_STATE_MAX_AGE_SECONDS = 15 * 60; // 15 minutes max validity

/**
 * Derives the HMAC key used to sign OAuth states.
 */
function getOAuthStateSecret(): string {
  const secret =
    process.env.LINKEDIN_OAUTH_STATE_SECRET ||
    process.env.ENCRYPTION_KEY ||
    process.env.LINKEDIN_CLIENT_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[OAuth Security] Fatal: Missing secret for OAuth state HMAC signing.');
    }
    return 'insecure_dev_oauth_state_secret_key_32_bytes!';
  }

  return secret;
}

/**
 * Creates an authoritative, signed OAuth state and generates the session cookie binding.
 */
export function createOAuthState(params: {
  workspaceId: string;
  userId: string;
}): {
  stateParam: string;
  cookieName: string;
  cookieValue: string;
  maxAge: number;
} {
  const stateId = crypto.randomBytes(32).toString('hex');
  const nonce = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now();

  const payload: OAuthStatePayload = {
    stateId,
    workspaceId: params.workspaceId,
    userId: params.userId,
    timestamp,
    nonce,
  };

  const serializedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const secret = getOAuthStateSecret();
  const signature = crypto
    .createHmac('sha256', secret)
    .update(serializedPayload)
    .digest('hex');

  const stateParam = `${serializedPayload}.${signature}`;

  // Cookie binds to the specific stateId so concurrent OAuth attempts never overwrite one another
  const cookieName = `${OAUTH_STATE_COOKIE_PREFIX}${stateId.slice(0, 16)}`;
  // Cookie value is a separate HMAC over stateId to ensure cookie integrity
  const cookieValue = crypto
    .createHmac('sha256', secret)
    .update(`cookie:${stateId}:${params.userId}:${params.workspaceId}`)
    .digest('hex');

  return {
    stateParam,
    cookieName,
    cookieValue,
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
  };
}

/**
 * Verifies the incoming state parameter and its corresponding browser cookie binding.
 * Returns the decoded payload if valid, or throws/returns null if forged, expired, or mismatched.
 */
export function verifyOAuthState(params: {
  stateParam: string | null;
  getCookie: (name: string) => string | undefined;
}): {
  isValid: boolean;
  error?: string;
  payload?: OAuthStatePayload;
  cookieNameToClear?: string;
} {
  const { stateParam, getCookie } = params;

  if (!stateParam) {
    return { isValid: false, error: 'missing_state' };
  }

  const parts = stateParam.split('.');
  if (parts.length !== 2) {
    return { isValid: false, error: 'malformed_state_format' };
  }

  const [serializedPayload, signature] = parts;
  if (!serializedPayload || !signature) {
    return { isValid: false, error: 'malformed_state_parts' };
  }

  const secret = getOAuthStateSecret();
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(serializedPayload)
    .digest('hex');

  // 1. Timing-safe cryptographic signature comparison
  const sigBuf = Buffer.from(signature, 'utf-8');
  const expBuf = Buffer.from(expectedSignature, 'utf-8');

  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { isValid: false, error: 'invalid_state_signature' };
  }

  // 2. Parse payload
  let payload: OAuthStatePayload;
  try {
    const jsonStr = Buffer.from(serializedPayload, 'base64url').toString('utf-8');
    payload = JSON.parse(jsonStr);
  } catch {
    return { isValid: false, error: 'invalid_state_payload' };
  }

  if (!payload.stateId || !payload.workspaceId || !payload.userId || !payload.timestamp) {
    return { isValid: false, error: 'incomplete_state_payload' };
  }

  const cookieNameToClear = `${OAUTH_STATE_COOKIE_PREFIX}${payload.stateId.slice(0, 16)}`;

  // 3. Expiration check (15 minutes max)
  const elapsed = Date.now() - payload.timestamp;
  if (elapsed < 0 || elapsed > OAUTH_STATE_MAX_AGE_SECONDS * 1000) {
    return { isValid: false, error: 'expired_state', cookieNameToClear };
  }

  // 4. Browser session cookie binding verification
  const sessionCookie = getCookie(cookieNameToClear);
  if (!sessionCookie) {
    return {
      isValid: false,
      error: 'missing_session_binding_cookie',
      cookieNameToClear,
    };
  }

  const expectedCookieValue = crypto
    .createHmac('sha256', secret)
    .update(`cookie:${payload.stateId}:${payload.userId}:${payload.workspaceId}`)
    .digest('hex');

  const sessBuf = Buffer.from(sessionCookie, 'utf-8');
  const expSessBuf = Buffer.from(expectedCookieValue, 'utf-8');

  if (sessBuf.length !== expSessBuf.length || !crypto.timingSafeEqual(sessBuf, expSessBuf)) {
    return {
      isValid: false,
      error: 'session_binding_cookie_mismatch',
      cookieNameToClear,
    };
  }

  return {
    isValid: true,
    payload,
    cookieNameToClear,
  };
}

/**
 * Strict allowlist validation for OAuth redirect URIs to prevent Host header poisoning.
 */
const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/autopilot\.gtinnox\.in$/,
  /^https:\/\/.*\.vercel\.app$/,
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];

export function getAuthoritativeRedirectUri(incomingOrigin?: string | null): string {
  const configuredUri = process.env.LINKEDIN_REDIRECT_URI;

  if (incomingOrigin) {
    const isAllowed = ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(incomingOrigin));
    if (isAllowed) {
      return `${incomingOrigin}/api/linkedin/callback`;
    }
  }

  if (configuredUri) {
    return configuredUri;
  }

  // Default fallback for production
  return 'https://autopilot.gtinnox.in/api/linkedin/callback';
}
