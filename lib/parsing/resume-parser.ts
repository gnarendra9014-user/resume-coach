/**
 * Production-Grade Resume Parser
 * 
 * Supports:
 * - PDF via `pdf-parse` with magic byte validation (%PDF-)
 * - DOCX via `mammoth` with ZIP container validation (PK..)
 * - TXT via UTF-8 text decoding with normalization
 * 
 * Includes stage timing and rigorous error categorization.
 */

import mammoth from "mammoth";
import { FailureCategory, SupportedFormat } from "../validation/resume-validator";

export interface ParseResult {
  text: string;
  format: SupportedFormat;
  characterCount: number;
  wordCount: number;
  parseDurationMs: number;
  metadata?: {
    pages?: number;
    info?: Record<string, any>;
  };
}

export class ResumeParseError extends Error {
  category: FailureCategory;
  constructor(message: string, category: FailureCategory) {
    super(message);
    this.name = "ResumeParseError";
    this.category = category;
  }
}

/**
 * Checks magic numbers to verify file matches its purported extension
 */
export function verifyMagicBytes(buffer: Buffer, format: SupportedFormat): void {
  if (buffer.length < 4) {
    throw new ResumeParseError(
      `File buffer is too small (${buffer.length} bytes) to be a valid ${format.toUpperCase()}`,
      "MALFORMED_FILE"
    );
  }

  if (format === "pdf") {
    // Standard PDF header is %PDF- (hex: 25 50 44 46)
    const header = buffer.subarray(0, 5).toString("ascii");
    if (!header.startsWith("%PDF")) {
      throw new ResumeParseError(
        `Invalid PDF file signature. Expected '%PDF', found '${header}'.`,
        "MALFORMED_FILE"
      );
    }
  } else if (format === "docx") {
    // DOCX is a zip archive, starts with PK\x03\x04 (hex: 50 4B 03 04)
    if (buffer[0] !== 0x50 || buffer[1] !== 0x4b || buffer[2] !== 0x03 || buffer[3] !== 0x04) {
      throw new ResumeParseError(
        "Invalid DOCX file signature. Expected ZIP signature (PK\\x03\\x04).",
        "MALFORMED_FILE"
      );
    }
  }
}

/**
 * Parses resume buffer into sanitized plaintext.
 */
export async function parseResumeBuffer(
  buffer: Buffer,
  format: SupportedFormat
): Promise<ParseResult> {
  const startTime = performance.now();

  try {
    // 1. Magic byte verification
    verifyMagicBytes(buffer, format);

    let extractedText = "";
    let pages: number | undefined;

    if (format === "pdf") {
      try {
        const pdfParseModule = (await import("pdf-parse")) as any;
        if (typeof pdfParseModule.PDFParse === "function") {
          const parser = new pdfParseModule.PDFParse({ data: buffer, verbosity: 0 });
          try {
            const doc = await parser.load();
            pages = doc.numPages;
            const textResult = await parser.getText();
            extractedText = typeof textResult === "string" ? textResult : (textResult?.text || "");
          } finally {
            if (typeof parser.destroy === "function") {
              await parser.destroy().catch(() => {});
            }
          }
        } else {
          const pdfParse = typeof pdfParseModule.default === "function"
            ? pdfParseModule.default
            : typeof pdfParseModule === "function"
              ? pdfParseModule
              : pdfParseModule.default?.default;
          if (typeof pdfParse !== "function") {
            throw new Error("pdf-parse module did not export a callable function or PDFParse class");
          }
          const pdfData = await pdfParse(buffer);
          extractedText = pdfData.text || "";
          pages = pdfData.numpages;
        }
      } catch (err: any) {
        throw new ResumeParseError(
          `PDF parsing engine failure: ${err.message || err}`,
          "PARSING_ERROR"
        );
      }
    } else if (format === "docx") {
      try {
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value || "";
      } catch (err: any) {
        throw new ResumeParseError(
          `DOCX extraction failure: ${err.message || err}`,
          "PARSING_ERROR"
        );
      }
    } else if (format === "txt") {
      try {
        extractedText = buffer.toString("utf-8");
      } catch (err: any) {
        throw new ResumeParseError(
          `Plain text decode failure: ${err.message || err}`,
          "PARSING_ERROR"
        );
      }
    } else {
      throw new ResumeParseError(
        `Unsupported resume format: ${format}`,
        "UNSUPPORTED_FORMAT"
      );
    }

    // Clean and normalize text
    // Replace non-printable ASCII except standard whitespace
    extractedText = extractedText
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n");

    const duration = performance.now() - startTime;
    const words = extractedText.trim().split(/\s+/).filter(Boolean);

    return {
      text: extractedText.trim(),
      format,
      characterCount: extractedText.length,
      wordCount: words.length,
      parseDurationMs: Math.round(duration * 100) / 100,
      metadata: { pages },
    };
  } catch (error: any) {
    if (error instanceof ResumeParseError) {
      throw error;
    }
    throw new ResumeParseError(
      `Unexpected parsing failure: ${error.message || error}`,
      "PARSING_ERROR"
    );
  }
}

