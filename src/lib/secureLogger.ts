/**
 * Secure Logger - Prevents logging sensitive information to browser console
 * 
 * This utility removes sensitive data like IDs, tokens, passwords, etc.
 * from logs to improve security and prevent data leakage.
 */

const SENSITIVE_KEYS = [
  'password',
  'token',
  'secret',
  'apiKey',
  'accessToken',
  'refreshToken',
  'idToken',
  'userId',
  'residentCode',
  'sessionId',
  'cognitoUserId',
  'sub', // Cognito subject ID
  'jti', // JWT ID
];

/**
 * Sanitize object by removing or masking sensitive fields
 */
function sanitizeObject(obj: any, depth = 0): any {
  if (depth > 5) return '[Max Depth Reached]';
  
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, depth + 1));
  }
  
  const sanitized: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    
    // Check if key contains sensitive information
    const isSensitive = SENSITIVE_KEYS.some(sensitiveKey => 
      lowerKey.includes(sensitiveKey.toLowerCase())
    );
    
    if (isSensitive) {
      if (typeof value === 'string' && value.length > 0) {
        // Show first 3 characters and mask the rest
        sanitized[key] = value.substring(0, 3) + '***';
      } else {
        sanitized[key] = '***';
      }
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value, depth + 1);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Secure console.log - sanitizes sensitive data before logging
 */
export function secureLog(message: string, ...args: any[]): void {
  if (import.meta.env.MODE === 'production') {
    // In production, only log message without details
    console.log(message);
    return;
  }
  
  // In development, sanitize and log
  const sanitizedArgs = args.map(arg => {
    if (typeof arg === 'object' && arg !== null) {
      return sanitizeObject(arg);
    }
    return arg;
  });
  
  console.log(message, ...sanitizedArgs);
}

/**
 * Secure console.error - sanitizes sensitive data from errors
 */
export function secureError(message: string, error?: any): void {
  console.error(message);
  
  if (import.meta.env.MODE !== 'production' && error) {
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      // Don't log stack trace in production
    } else if (typeof error === 'object') {
      console.error('Error details:', sanitizeObject(error));
    }
  }
}

/**
 * Check if a field should be hidden in UI
 */
export function isSensitiveField(fieldName: string): boolean {
  const lowerKey = fieldName.toLowerCase();
  return SENSITIVE_KEYS.some(sensitiveKey => 
    lowerKey.includes(sensitiveKey.toLowerCase())
  );
}
