import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import { POST } from "../../app/api/parse-resume/route";
import { globalMetrics } from "../../lib/metrics/metrics-collector";

const FIXTURES_DIR = path.resolve(__dirname, "..", "fixtures");

describe("API Integration: /api/parse-resume", () => {
  beforeEach(() => {
    globalMetrics.reset();
    process.env.MOCK_AI = "true"; // Run tests deterministically
  });

  it("should successfully parse valid TXT resume file", async () => {
    const filePath = path.join(FIXTURES_DIR, "valid-swe-resume.txt");
    const buffer = fs.readFileSync(filePath);

    const formData = new FormData();
    const file = new Blob([buffer], { type: "text/plain" });
    formData.append("file", file, "valid-swe-resume.txt");

    const req = new NextRequest("http://localhost:3000/api/parse-resume", {
      method: "POST",
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("name");
    expect(data).toHaveProperty("skills");
    expect(data).toHaveProperty("experience");
    expect(res.headers.get("X-Latency-Validation-Ms")).toBeDefined();
    expect(res.headers.get("X-Latency-Parsing-Ms")).toBeDefined();

    // Verify metrics recorded this attempt as successful
    const snapshot = globalMetrics.getSnapshot();
    expect(snapshot.totalValidAttempts).toBe(1);
    expect(snapshot.successfulAttempts).toBe(1);
    expect(snapshot.processingSuccessRatePct).toBe(100.0);
  });

  it("should successfully parse valid PDF resume file", async () => {
    const filePath = path.join(FIXTURES_DIR, "valid-swe-resume.pdf");
    const buffer = fs.readFileSync(filePath);

    const formData = new FormData();
    const file = new Blob([buffer], { type: "application/pdf" });
    formData.append("file", file, "valid-swe-resume.pdf");

    const req = new NextRequest("http://localhost:3000/api/parse-resume", {
      method: "POST",
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("name");
    expect(data).toHaveProperty("role");
  });

  it("should successfully parse valid DOCX resume file", async () => {
    const filePath = path.join(FIXTURES_DIR, "valid-swe-resume.docx");
    const buffer = fs.readFileSync(filePath);

    const formData = new FormData();
    const file = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    formData.append("file", file, "valid-swe-resume.docx");

    const req = new NextRequest("http://localhost:3000/api/parse-resume", {
      method: "POST",
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("skills");
  });

  it("should reject 0-byte file with 400 and record as invalid upload", async () => {
    const filePath = path.join(FIXTURES_DIR, "empty-file.txt");
    const buffer = fs.readFileSync(filePath);

    const formData = new FormData();
    const file = new Blob([buffer], { type: "text/plain" });
    formData.append("file", file, "empty-file.txt");

    const req = new NextRequest("http://localhost:3000/api/parse-resume", {
      method: "POST",
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toContain("empty");

    const snapshot = globalMetrics.getSnapshot();
    expect(snapshot.invalidUploadsCount).toBe(1);
    expect(snapshot.totalValidAttempts).toBe(0); // Excluded from denominator!
  });

  it("should reject oversized file (>10MB) with 400", async () => {
    const filePath = path.join(FIXTURES_DIR, "oversized-resume.txt");
    const buffer = fs.readFileSync(filePath);

    const formData = new FormData();
    const file = new Blob([buffer], { type: "text/plain" });
    formData.append("file", file, "oversized-resume.txt");

    const req = new NextRequest("http://localhost:3000/api/parse-resume", {
      method: "POST",
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toContain("exceeds maximum allowed limit");
  });

  it("should reject unsupported file extension (.exe) with 400", async () => {
    const filePath = path.join(FIXTURES_DIR, "unsupported-app.exe");
    const buffer = fs.readFileSync(filePath);

    const formData = new FormData();
    const file = new Blob([buffer], { type: "application/octet-stream" });
    formData.append("file", file, "unsupported-app.exe");

    const req = new NextRequest("http://localhost:3000/api/parse-resume", {
      method: "POST",
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toContain("Unsupported file type");
  });

  it("should fail gracefully on corrupt PDF fixture with 400", async () => {
    const filePath = path.join(FIXTURES_DIR, "corrupt-pdf.pdf");
    const buffer = fs.readFileSync(filePath);

    const formData = new FormData();
    const file = new Blob([buffer], { type: "application/pdf" });
    formData.append("file", file, "corrupt-pdf.pdf");

    const req = new NextRequest("http://localhost:3000/api/parse-resume", {
      method: "POST",
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data).toHaveProperty("error");
    expect(data.category).toBe("MALFORMED_FILE");

    const snapshot = globalMetrics.getSnapshot();
    expect(snapshot.totalValidAttempts).toBe(1); // Was counted as valid attempt
    expect(snapshot.failedAttempts).toBe(1);
    expect(snapshot.failuresByCategory.MALFORMED_FILE).toBe(1);
  });
});

