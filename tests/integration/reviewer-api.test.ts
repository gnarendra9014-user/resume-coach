import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import { POST } from "../../app/api/reviewer/route";

const FIXTURES_DIR = path.resolve(__dirname, "..", "fixtures");

describe("API Integration: /api/reviewer", () => {
  beforeEach(() => {
    process.env.MOCK_AI = "true";
  });

  it("should review and rewrite resume from file upload", async () => {
    const filePath = path.join(FIXTURES_DIR, "valid-swe-resume.txt");
    const buffer = fs.readFileSync(filePath);

    const formData = new FormData();
    const file = new Blob([buffer], { type: "text/plain" });
    formData.append("file", file, "valid-swe-resume.txt");

    const req = new NextRequest("http://localhost:3000/api/reviewer", {
      method: "POST",
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("review");
    expect(data).toHaveProperty("rewritten");
    expect(data).toHaveProperty("original");
    expect(data.review.length).toBeGreaterThan(10);
    expect(data.rewritten.length).toBeGreaterThan(10);
  });

  it("should review and rewrite resume from pasted text", async () => {
    const sampleText = "Alex Morgan. Software Engineer with 4 years experience in React and Node.js. Led migration to Next.js.";

    const formData = new FormData();
    formData.append("text", sampleText);

    const req = new NextRequest("http://localhost:3000/api/reviewer", {
      method: "POST",
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.review).toBeDefined();
    expect(data.rewritten).toBeDefined();
    expect(data.original).toBe(sampleText);
  });

  it("should reject empty content with 400", async () => {
    const formData = new FormData();
    formData.append("text", "   ");

    const req = new NextRequest("http://localhost:3000/api/reviewer", {
      method: "POST",
      body: formData,
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toBeDefined();
  });
});

