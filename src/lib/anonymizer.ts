/**
 * Utility helper to anonymize and deanonymize sensitive text
 * before sending to LLM APIs.
 */

export interface AnonymizeResult {
  anonymizedText: string;
  map: Record<string, string>;
}

/**
 * Anonymizes phone numbers, emails, and credentials, replacing them with tokens.
 * Keep client/customer names and other contextual names intact as per user preferences.
 */
export function anonymize(text: string): AnonymizeResult {
  const map: Record<string, string> = {};
  let tempText = text;

  // 1. Detect and replace emails
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  let emailCount = 0;
  tempText = tempText.replace(emailRegex, (match) => {
    emailCount++;
    const placeholder = `[EMAIL_${emailCount}]`;
    map[placeholder] = match;
    return placeholder;
  });

  // 2. Detect and replace Indonesian / international phone numbers
  // Matches formats like +62 812-3456-7890, 6281234567890, 08123456789, etc.
  const phoneRegex = /(\+62|62|0)[89]\d{1,4}[-\s]?\d{3,4}[-\s]?\d{3,4}[-\s]?\d{0,4}/g;
  let phoneCount = 0;
  tempText = tempText.replace(phoneRegex, (match) => {
    // Only mask if the digit length is substantial (to avoid false positives for small numbers)
    const digits = match.replace(/\D/g, '');
    if (digits.length >= 9 && digits.length <= 15) {
      phoneCount++;
      const placeholder = `[PHONE_${phoneCount}]`;
      map[placeholder] = match;
      return placeholder;
    }
    return match;
  });

  // 3. Detect and replace Credentials / Passwords / API Keys / Secret Tokens
  // Matches patterns like "api_key = abc123xyz", "password: password123", "token: 'jwt_secret'"
  const secretPatterns = [
    /(api[_-]?key|password|pass|secret|token|db_url|db_uri|connection_string)\s*[:=]\s*["']?([a-zA-Z0-9_\-.~%]{8,})["']?/gi
  ];

  let secretCount = 0;
  for (const pattern of secretPatterns) {
    tempText = tempText.replace(pattern, (match, label, value) => {
      secretCount++;
      const placeholder = `[SECRET_${secretCount}]`;
      map[placeholder] = value;
      return `${label}: ${placeholder}`;
    });
  }

  return {
    anonymizedText: tempText,
    map
  };
}

/**
 * Replaces token placeholders back with their original sensitive values.
 */
export function deanonymize(text: string, map: Record<string, string>): string {
  if (!text) return text;
  let restoredText = text;
  for (const [placeholder, originalValue] of Object.entries(map)) {
    // Escaping regex characters in placeholders just in case, though brackets are simple
    const escapedPlaceholder = placeholder.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(escapedPlaceholder, 'g');
    restoredText = restoredText.replace(regex, originalValue);
  }
  return restoredText;
}
