import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "../../app/api/metrics/route";
import { globalMetrics } from "../../lib/metrics/metrics-collector";

describe("API Integration: /api/metrics", () => {
  beforeEach(() => {
    globalMetrics.reset();
  });

  it("should return valid MetricsSnapshot structure via GET", async () => {
    // Record sample attempt
    globalMetrics.recordProcessingAttempt({
      success: true,
      format: "txt",
      wordCount: 150,
      latencies: {
        validationMs: 1,
        parsingMs: 2,
        aiRequestMs: 40,
        postProcessingMs: 1,
        totalLatencyMs: 44,
      },
    });

    const res = await GET();
    expect(res.status).toBe(200);

    const snapshot = await res.json();
    expect(snapshot).toHaveProperty("totalRequests");
    expect(snapshot).toHaveProperty("processingSuccessRatePct");
    expect(snapshot).toHaveProperty("failuresByCategory");
    expect(snapshot).toHaveProperty("invalidUploadsByCategory");
    expect(snapshot).toHaveProperty("latencies");
    expect(snapshot.totalValidAttempts).toBe(1);
    expect(snapshot.processingSuccessRatePct).toBe(100.0);
  });

  it("should reset metrics via POST with action: 'reset'", async () => {
    globalMetrics.recordInvalidUpload("test.png", 500, "UNSUPPORTED_MIME_OR_EXTENSION", "reason");
    expect(globalMetrics.getSnapshot().invalidUploadsCount).toBe(1);

    const req = new NextRequest("http://localhost:3000/api/metrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const postData = await res.json();
    expect(postData.success).toBe(true);
    expect(globalMetrics.getSnapshot().invalidUploadsCount).toBe(0);
  });
});

