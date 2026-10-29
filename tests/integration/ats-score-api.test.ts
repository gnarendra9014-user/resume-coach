import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../../app/api/ats-score/route";

describe("API Integration: /api/ats-score", () => {
  beforeEach(() => {
    process.env.MOCK_AI = "true";
  });

  it("should return numeric score and tips array for valid resume text", async () => {
    const resumeText = `Alex Morgan. Senior Software Engineer with 4 years experience in TypeScript, React, Next.js, and Node.js. Architected scalable systems.`;

    const req = new NextRequest("http://localhost:3000/api/ats-score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resume: resumeText, role: "Senior Software Engineer" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("result");
    expect(typeof data.score).toBe("number");
    expect(data.score).toBeGreaterThanOrEqual(0);
    expect(data.score).toBeLessThanOrEqual(100);
    expect(Array.isArray(data.tips)).toBe(true);
    expect(data.tips.length).toBeGreaterThan(0);
  });

  it("should reject empty resume payload with 400", async () => {
    const req = new NextRequest("http://localhost:3000/api/ats-score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resume: "" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toBeDefined();
    expect(data.score).toBeNull();
  });
});

