const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

// In-memory token store: token -> { nodeId, name, createdAt, lastUsed }
const tokens = new Map();

// Rate limit store: ip -> { count, resetAt }
const rateLimits = new Map();

// Generate a secure random token
function generateToken(length = 48) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash a password/token for storage
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Create a new auth token for a node
 */
function createToken(nodeId, nodeName) {
  const token = generateToken();
  const hashed = hashToken(token);

  tokens.set(hashed, {
    nodeId,
    nodeName,
    createdAt: Date.now(),
    lastUsed: Date.now()
  });

  // Clean old tokens (> 24 hours)
  cleanupTokens();

  return { token, nodeId };
}

/**
 * Validate a token — returns node info or null
 */
function validateToken(token) {
  const hashed = hashToken(token);
  const entry = tokens.get(hashed);

  if (!entry) return null;

  entry.lastUsed = Date.now();
  return entry;
}

/**
 * Revoke a token
 */
function revokeToken(token) {
  const hashed = hashToken(token);
  tokens.delete(hashed);
}

/**
 * Clean expired tokens
 */
function cleanupTokens() {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours

  for (const [key, entry] of tokens) {
    if (now - entry.lastUsed > maxAge) {
      tokens.delete(key);
    }
  }
}

/**
 * Express middleware: require authentication
 */
function requireAuth(req, res, next) {
  const token = req.headers['x-auth-token'] ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.substring(7)
      : null);

  if (!token) {
    return res.status(401).json({ error: 'Authentication required', code: 'UNAUTHORIZED' });
  }

  const entry = validateToken(token);
  if (!entry) {
    return res.status(403).json({ error: 'Invalid or expired token', code: 'FORBIDDEN' });
  }

  req.authenticatedNode = entry;
  next();
}

/**
 * Express middleware: optional authentication (sets req.authenticatedNode if token present)
 */
function optionalAuth(req, res, next) {
  const token = req.headers['x-auth-token'] ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.substring(7)
      : null);

  if (token) {
    req.authenticatedNode = validateToken(token);
  }

  next();
}

/**
 * Rate limiting middleware
 */
function rateLimit(options = {}) {
  const maxRequests = options.maxRequests || 100;
  const windowMs = options.windowMs || 60 * 1000; // 1 minute

  return (req, res, next) => {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();

    let record = rateLimits.get(ip);

    if (!record || now > record.resetAt) {
      // New window
      record = { count: 1, resetAt: now + windowMs };
      rateLimits.set(ip, record);
      return next();
    }

    record.count++;

    if (record.count > maxRequests) {
      res.setHeader('Retry-After', Math.ceil((record.resetAt - now) / 1000));
      return res.status(429).json({
        error: 'Too many requests',
        code: 'RATE_LIMITED',
        retryAfter: Math.ceil((record.resetAt - now) / 1000)
      });
    }

    next();
  };
}

/**
 * Get token store stats
 */
function getTokenStats() {
  return {
    activeTokens: tokens.size,
    rateLimitedIPs: rateLimits.size
  };
}

/**
 * Clear all tokens (admin action)
 */
function clearAllTokens() {
  tokens.clear();
}

module.exports = {
  createToken,
  validateToken,
  revokeToken,
  requireAuth,
  optionalAuth,
  rateLimit,
  getTokenStats,
  clearAllTokens,
  cleanupTokens
};
