import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import {
  parseResumeBuffer,
  verifyMagicBytes,
  ResumeParseError,
} from "../../lib/parsing/resume-parser";

const FIXTURES_DIR = path.resolve(__dirname, "..", "fixtures");

describe("Resume Parser Engine Unit Tests", () => {
  describe("Magic Byte Verification", () => {
    it("should accept valid PDF magic header (%PDF)", () => {
      const buf = Buffer.from("%PDF-1.4 sample content");
      expect(() => verifyMagicBytes(buf, "pdf")).not.toThrow();
    });

    it("should reject corrupted PDF lacking %PDF header", () => {
      const buf = Buffer.from("NOT_A_PDF_STREAM");
      expect(() => verifyMagicBytes(buf, "pdf")).toThrow(ResumeParseError);
    });

    it("should accept valid DOCX ZIP magic header (PK\\x03\\x04)", () => {
      const buf = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
      expect(() => verifyMagicBytes(buf, "docx")).not.toThrow();
    });

    it("should reject corrupted DOCX lacking ZIP signature", () => {
      const buf = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      expect(() => verifyMagicBytes(buf, "docx")).toThrow(ResumeParseError);
    });
  });

  describe("File Format Parsing using Real Fixtures", () => {
    it("should parse valid plain text resume correctly", async () => {
      const filePath = path.join(FIXTURES_DIR, "valid-swe-resume.txt");
      const buffer = fs.readFileSync(filePath);
      const res = await parseResumeBuffer(buffer, "txt");

      expect(res.format).toBe("txt");
      expect(res.text).toContain("Alex Morgan");
      expect(res.text).toContain("Software Engineer");
      expect(res.wordCount).toBeGreaterThan(50);
      expect(res.parseDurationMs).toBeGreaterThanOrEqual(0);
    });

    it("should parse valid PDF resume via pdf-parse", async () => {
      const filePath = path.join(FIXTURES_DIR, "valid-swe-resume.pdf");
      const buffer = fs.readFileSync(filePath);
      const res = await parseResumeBuffer(buffer, "pdf");

      expect(res.format).toBe("pdf");
      expect(res.text).toContain("Alex Morgan");
      expect(res.wordCount).toBeGreaterThan(50);
      expect(res.metadata?.pages).toBeGreaterThanOrEqual(1);
    });

    it("should parse valid DOCX resume via mammoth (proper XML extraction)", async () => {
      const filePath = path.join(FIXTURES_DIR, "valid-swe-resume.docx");
      const buffer = fs.readFileSync(filePath);
      const res = await parseResumeBuffer(buffer, "docx");

      expect(res.format).toBe("docx");
      expect(res.text).toContain("Alex Morgan");
      expect(res.wordCount).toBeGreaterThan(50);
      expect(res.text).not.toContain("[Content_Types].xml"); // Confirms it didn't do raw binary zip dump
    });

    it("should throw MALFORMED_FILE on corrupt PDF fixture", async () => {
      const filePath = path.join(FIXTURES_DIR, "corrupt-pdf.pdf");
      const buffer = fs.readFileSync(filePath);

      await expect(parseResumeBuffer(buffer, "pdf")).rejects.toThrow(ResumeParseError);
    });

    it("should throw PARSING_ERROR or MALFORMED_FILE on corrupt DOCX fixture", async () => {
      const filePath = path.join(FIXTURES_DIR, "corrupt-docx.docx");
      const buffer = fs.readFileSync(filePath);

      await expect(parseResumeBuffer(buffer, "docx")).rejects.toThrow();
    });
  });
});

