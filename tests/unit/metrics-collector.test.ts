import { describe, it, expect, beforeEach } from "vitest";
import { globalMetrics } from "../../lib/metrics/metrics-collector";

describe("Metrics Collector & Observability Unit Tests", () => {
  beforeEach(() => {
    globalMetrics.reset();
  });

  it("should calculate success rate formula correctly", () => {
    // 3 successful attempts, 1 failed attempt = 3 / 4 * 100 = 75.0%
    globalMetrics.recordProcessingAttempt({
      success: true,
      format: "pdf",
      wordCount: 300,
      latencies: {
        validationMs: 2,
        parsingMs: 15,
        aiRequestMs: 120,
        postProcessingMs: 5,
        totalLatencyMs: 142,
      },
    });

    globalMetrics.recordProcessingAttempt({
      success: true,
      format: "txt",
      wordCount: 250,
      latencies: {
        validationMs: 1,
        parsingMs: 2,
        aiRequestMs: 110,
        postProcessingMs: 4,
        totalLatencyMs: 117,
      },
    });

    globalMetrics.recordProcessingAttempt({
      success: true,
      format: "docx",
      wordCount: 400,
      latencies: {
        validationMs: 3,
        parsingMs: 25,
        aiRequestMs: 130,
        postProcessingMs: 6,
        totalLatencyMs: 164,
      },
    });

    globalMetrics.recordProcessingAttempt({
      success: false,
      format: "pdf",
      failureCategory: "PARSING_ERROR",
      errorMessage: "Corrupt stream",
      latencies: {
        validationMs: 2,
        parsingMs: 5,
        aiRequestMs: 0,
        postProcessingMs: 0,
        totalLatencyMs: 7,
      },
    });

    const snapshot = globalMetrics.getSnapshot();

    expect(snapshot.totalValidAttempts).toBe(4);
    expect(snapshot.successfulAttempts).toBe(3);
    expect(snapshot.failedAttempts).toBe(1);
    expect(snapshot.processingSuccessRatePct).toBe(75.0);
    expect(snapshot.failuresByCategory.PARSING_ERROR).toBe(1);
  });

  it("should separate invalid uploads from the valid attempts denominator", () => {
    // Record 2 invalid uploads (e.g. 0-byte file, .exe file)
    globalMetrics.recordInvalidUpload(
      "empty.pdf",
      0,
      "FILE_EMPTY_ZERO_BYTES",
      "File is 0 bytes"
    );
    globalMetrics.recordInvalidUpload(
      "virus.exe",
      5000,
      "UNSUPPORTED_MIME_OR_EXTENSION",
      "Unsupported format"
    );

    // Record 2 valid attempts: both successful
    globalMetrics.recordProcessingAttempt({
      success: true,
      format: "txt",
      latencies: {
        validationMs: 1,
        parsingMs: 1,
        aiRequestMs: 50,
        postProcessingMs: 1,
        totalLatencyMs: 53,
      },
    });
    globalMetrics.recordProcessingAttempt({
      success: true,
      format: "pdf",
      latencies: {
        validationMs: 1,
        parsingMs: 10,
        aiRequestMs: 60,
        postProcessingMs: 2,
        totalLatencyMs: 73,
      },
    });

    const snapshot = globalMetrics.getSnapshot();

    expect(snapshot.invalidUploadsCount).toBe(2);
    expect(snapshot.totalValidAttempts).toBe(2); // Only 2 valid attempts
    expect(snapshot.successfulAttempts).toBe(2);
    // Success rate must be 100.0%, NOT 50% (because invalid uploads are excluded from denominator)
    expect(snapshot.processingSuccessRatePct).toBe(100.0);
    expect(snapshot.totalRequests).toBe(4);
  });

  it("should accurately compute latency percentiles (p50, p90, p95, p99)", () => {
    // Insert 100 processing attempts with latencies 1ms to 100ms
    for (let i = 1; i <= 100; i++) {
      globalMetrics.recordProcessingAttempt({
        success: true,
        latencies: {
          validationMs: 1,
          parsingMs: 5,
          aiRequestMs: i,
          postProcessingMs: 2,
          totalLatencyMs: i + 8,
        },
      });
    }

    const snapshot = globalMetrics.getSnapshot();
    const aiStats = snapshot.latencies.aiRequest;

    expect(aiStats.count).toBe(100);
    expect(aiStats.min).toBe(1);
    expect(aiStats.max).toBe(100);
    expect(aiStats.p50).toBe(51);
    expect(aiStats.p90).toBe(91);
    expect(aiStats.p95).toBe(96);
    expect(aiStats.p99).toBe(100);
  });
});

