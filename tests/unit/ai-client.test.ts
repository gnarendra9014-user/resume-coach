import { describe, it, expect } from "vitest";
import {
  extractJsonFromAiResponse,
  executeAiCompletion,
  AiClientError,
} from "../../lib/ai/ai-client";

describe("AI Client & JSON Extraction Unit Tests", () => {
  describe("extractJsonFromAiResponse", () => {
    it("should extract pure JSON object", () => {
      const raw = '{"name": "John Doe", "role": "Engineer"}';
      const parsed = extractJsonFromAiResponse(raw);
      expect(parsed.name).toBe("John Doe");
      expect(parsed.role).toBe("Engineer");
    });

    it("should strip markdown code fences (```json ... ```)", () => {
      const raw = `\`\`\`json
{
  "name": "Jane Smith",
  "score": 92
}
\`\`\``;
      const parsed = extractJsonFromAiResponse(raw);
      expect(parsed.name).toBe("Jane Smith");
      expect(parsed.score).toBe(92);
    });

    it("should extract JSON embedded in conversational prose", () => {
      const raw = `Here is the requested analysis:
{
  "status": "success",
  "skills": ["React", "TypeScript"]
}
Hope this helps with your ATS optimization!`;
      const parsed = extractJsonFromAiResponse(raw);
      expect(parsed.status).toBe("success");
      expect(parsed.skills).toContain("React");
    });

    it("should return fallbackDefault when input is invalid instead of throwing", () => {
      const raw = "This is not json at all";
      const fallback = { fallback: true };
      const parsed = extractJsonFromAiResponse(raw, fallback);
      expect(parsed.fallback).toBe(true);
    });

    it("should throw AiClientError if invalid and no fallbackDefault provided", () => {
      const raw = "Random text without braces";
      expect(() => extractJsonFromAiResponse(raw)).toThrow(AiClientError);
    });
  });

  describe("executeAiCompletion (Mock Mode)", () => {
    it("should return deterministic structured resume parsing in mock mode", async () => {
      const res = await executeAiCompletion({
        messages: [
          {
            role: "user",
            content: "Extract the following information from the provided resume text: React, TypeScript, Next.js",
          },
        ],
        useMock: true,
      });

      expect(res.isMock).toBe(true);
      expect(res.latencyMs).toBeGreaterThanOrEqual(0);

      const parsed = JSON.parse(res.content);
      expect(parsed).toHaveProperty("name");
      expect(parsed).toHaveProperty("skills");
      expect(parsed).toHaveProperty("experience");
    });

    it("should return formatted ATS scores and tips in mock mode", async () => {
      const res = await executeAiCompletion({
        messages: [
          {
            role: "user",
            content: "Analyze this resume for ATS (Applicant Tracking System) compatibility and give: SCORE: [number]",
          },
        ],
        useMock: true,
      });

      expect(res.content).toContain("SCORE:");
      expect(res.content).toContain("TIPS:");
    });
  });
});

