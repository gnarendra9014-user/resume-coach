/**
 * Resume Validation & Safety Module
 * 
 * Defines the criteria for valid processing attempts vs. invalid upload requests,
 * failure taxonomy, and PII redaction utilities.
 */

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MIN_TEXT_LENGTH_CHARS = 30; // Minimum meaningful resume text length

export type SupportedFormat = "pdf" | "docx" | "txt";

export type FailureCategory =
  | "UNSUPPORTED_FORMAT"
  | "MALFORMED_FILE"
  | "PARSING_ERROR"
  | "EMPTY_EXTRACTED_TEXT"
  | "AI_PROVIDER_FAILURE"
  | "AI_TIMEOUT"
  | "AI_MALFORMED_OUTPUT"
  | "INTERNAL_ERROR";

export type InvalidUploadCategory =
  | "MISSING_FILE_OR_CONTENT"
  | "FILE_EMPTY_ZERO_BYTES"
  | "FILE_EXCEEDS_SIZE_LIMIT"
  | "UNSUPPORTED_MIME_OR_EXTENSION";

export interface ValidationResult {
  isValidAttempt: boolean;
  isUploadValid: boolean;
  format?: SupportedFormat;
  rejectionReason?: string;
  invalidCategory?: InvalidUploadCategory;
}

/**
 * Validate incoming file upload metadata before parsing.
 * 
 * Denominator policy:
 * - Invalid uploads (e.g., 0-byte file, file > 10MB, .exe/.jpg) are rejected immediately
 *   and recorded under invalidUploads (excluded from the valid processing attempts denominator).
 * - Files that match accepted types and sizes are counted as valid processing attempts.
 */
export function validateUploadFile(file: {
  name: string;
  size: number;
  type?: string;
}): ValidationResult {
  if (!file || typeof file.size !== "number") {
    return {
      isValidAttempt: false,
      isUploadValid: false,
      rejectionReason: "No file payload provided",
      invalidCategory: "MISSING_FILE_OR_CONTENT",
    };
  }

  if (file.size === 0) {
    return {
      isValidAttempt: false,
      isUploadValid: false,
      rejectionReason: "File is empty (0 bytes)",
      invalidCategory: "FILE_EMPTY_ZERO_BYTES",
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      isValidAttempt: false,
      isUploadValid: false,
      rejectionReason: `File size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB`,
      invalidCategory: "FILE_EXCEEDS_SIZE_LIMIT",
    };
  }

  const name = file.name.toLowerCase();
  const type = (file.type || "").toLowerCase();

  let detectedFormat: SupportedFormat | null = null;
  if (name.endsWith(".pdf") || type === "application/pdf") {
    detectedFormat = "pdf";
  } else if (
    name.endsWith(".docx") ||
    type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    detectedFormat = "docx";
  } else if (name.endsWith(".txt") || type.startsWith("text/plain")) {
    detectedFormat = "txt";
  }

  if (!detectedFormat) {
    return {
      isValidAttempt: false,
      isUploadValid: false,
      rejectionReason: `Unsupported file type: '${file.name}'. Only .pdf, .docx, and .txt files are supported.`,
      invalidCategory: "UNSUPPORTED_MIME_OR_EXTENSION",
    };
  }

  return {
    isValidAttempt: true,
    isUploadValid: true,
    format: detectedFormat,
  };
}

/**
 * Redact sensitive PII from string inputs to prevent leakage in telemetry,
 * evaluation reports, and log files.
 */
export function redactPII(input: string): string {
  if (!input) return "";

  let sanitized = input;

  // Redact email addresses
  sanitized = sanitized.replace(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    "[REDACTED_EMAIL]"
  );

  // Redact phone numbers (various international and domestic formats)
  sanitized = sanitized.replace(
    /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g,
    "[REDACTED_PHONE]"
  );

  // Redact SSN-like patterns (XXX-XX-XXXX)
  sanitized = sanitized.replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[REDACTED_SSN]");

  return sanitized;
}

/**
 * Validates extracted text before submitting it to an AI model.
 */
export function validateExtractedText(text: string): {
  isValid: boolean;
  wordCount: number;
  reason?: string;
  failureCategory?: FailureCategory;
} {
  if (!text || text.trim().length === 0) {
    return {
      isValid: false,
      wordCount: 0,
      reason: "Extracted text is completely empty",
      failureCategory: "EMPTY_EXTRACTED_TEXT",
    };
  }

  const trimmed = text.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);

  if (trimmed.length < MIN_TEXT_LENGTH_CHARS || words.length < 5) {
    return {
      isValid: false,
      wordCount: words.length,
      reason: `Extracted text is too short to be a valid resume (${trimmed.length} chars, ${words.length} words)`,
      failureCategory: "EMPTY_EXTRACTED_TEXT",
    };
  }

  return {
    isValid: true,
    wordCount: words.length,
  };
}

