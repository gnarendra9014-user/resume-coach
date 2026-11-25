import { describe, it, expect } from "vitest";
import {
  validateUploadFile,
  validateExtractedText,
  redactPII,
  MAX_FILE_SIZE_BYTES,
} from "../../lib/validation/resume-validator";

describe("Resume Validator & Safety Unit Tests", () => {
  describe("validateUploadFile (Denominator & Gatekeeping)", () => {
    it("should accept valid PDF file within size limits", () => {
      const res = validateUploadFile({
        name: "my_resume.pdf",
        size: 150000,
        type: "application/pdf",
      });
      expect(res.isUploadValid).toBe(true);
      expect(res.isValidAttempt).toBe(true);
      expect(res.format).toBe("pdf");
    });

    it("should accept valid DOCX file", () => {
      const res = validateUploadFile({
        name: "resume.docx",
        size: 50000,
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      expect(res.isUploadValid).toBe(true);
      expect(res.isValidAttempt).toBe(true);
      expect(res.format).toBe("docx");
    });

    it("should accept valid TXT file", () => {
      const res = validateUploadFile({
        name: "resume.txt",
        size: 4000,
        type: "text/plain",
      });
      expect(res.isUploadValid).toBe(true);
      expect(res.isValidAttempt).toBe(true);
      expect(res.format).toBe("txt");
    });

    it("should reject 0-byte empty file as invalid upload (excluded from denominator)", () => {
      const res = validateUploadFile({
        name: "empty.pdf",
        size: 0,
        type: "application/pdf",
      });
      expect(res.isUploadValid).toBe(false);
      expect(res.isValidAttempt).toBe(false);
      expect(res.invalidCategory).toBe("FILE_EMPTY_ZERO_BYTES");
    });

    it("should reject oversized file exceeding 10MB limit", () => {
      const res = validateUploadFile({
        name: "giant.pdf",
        size: MAX_FILE_SIZE_BYTES + 5000,
        type: "application/pdf",
      });
      expect(res.isUploadValid).toBe(false);
      expect(res.isValidAttempt).toBe(false);
      expect(res.invalidCategory).toBe("FILE_EXCEEDS_SIZE_LIMIT");
      expect(res.rejectionReason).toContain("exceeds maximum allowed limit");
    });

    it("should reject unsupported file format (.exe, .png)", () => {
      const res1 = validateUploadFile({
        name: "malicious.exe",
        size: 20000,
        type: "application/x-msdownload",
      });
      expect(res1.isUploadValid).toBe(false);
      expect(res1.invalidCategory).toBe("UNSUPPORTED_MIME_OR_EXTENSION");

      const res2 = validateUploadFile({
        name: "photo.png",
        size: 20000,
        type: "image/png",
      });
      expect(res2.isUploadValid).toBe(false);
      expect(res2.invalidCategory).toBe("UNSUPPORTED_MIME_OR_EXTENSION");
    });
  });

  describe("redactPII", () => {
    it("should redact email addresses", () => {
      const raw = "Contact me at candidate.test@domain.co.uk for inquiries.";
      const redacted = redactPII(raw);
      expect(redacted).not.toContain("candidate.test@domain.co.uk");
      expect(redacted).toContain("[REDACTED_EMAIL]");
    });

    it("should redact phone numbers", () => {
      const raw = "Call (555) 123-4567 or +1 800-555-0199 for references.";
      const redacted = redactPII(raw);
      expect(redacted).not.toContain("555-123-4567");
      expect(redacted).toContain("[REDACTED_PHONE]");
    });

    it("should redact SSN patterns", () => {
      const raw = "Tax ID: 123-45-6789 verified.";
      const redacted = redactPII(raw);
      expect(redacted).not.toContain("123-45-6789");
      expect(redacted).toContain("[REDACTED_SSN]");
    });
  });

  describe("validateExtractedText", () => {
    it("should reject empty or whitespace-only text", () => {
      const res = validateExtractedText("   \n\t   ");
      expect(res.isValid).toBe(false);
      expect(res.failureCategory).toBe("EMPTY_EXTRACTED_TEXT");
    });

    it("should reject text shorter than minimum resume threshold", () => {
      const res = validateExtractedText("Hello John");
      expect(res.isValid).toBe(false);
      expect(res.failureCategory).toBe("EMPTY_EXTRACTED_TEXT");
    });

    it("should accept valid extracted resume content", () => {
      const validText = "Alex Morgan. Software Engineer with 4 years experience in React, Node.js, and TypeScript.";
      const res = validateExtractedText(validText);
      expect(res.isValid).toBe(true);
      expect(res.wordCount).toBeGreaterThan(10);
    });
  });
});

