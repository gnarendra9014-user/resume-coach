/**
 * Application Metrics & Observability Collector
 * 
 * Implements production tracking for:
 * - Resume Processing Success Rate:
 *     Success Rate = (successful attempts / total valid attempts) * 100
 * - Explicit separation of Invalid Uploads vs Valid Processing Attempts (Denominator Policy)
 * - Granular failure taxonomy tracking
 * - Stage-by-stage latency tracking (validation, parsing, AI, serialization, end-to-end)
 * - Concurrency & throughput monitoring
 */

import { FailureCategory, InvalidUploadCategory } from "../validation/resume-validator";

export interface StageLatencies {
  validationMs: number;
  parsingMs: number;
  aiRequestMs: number;
  postProcessingMs: number;
  totalLatencyMs: number;
}

export interface ProcessingRecord {
  id: string;
  timestamp: number;
  success: boolean;
  format?: string;
  wordCount?: number;
  failureCategory?: FailureCategory;
  errorMessage?: string;
  latencies: StageLatencies;
}

export interface InvalidUploadRecord {
  id: string;
  timestamp: number;
  filename: string;
  sizeBytes: number;
  category: InvalidUploadCategory;
  reason: string;
}

export interface MetricsSnapshot {
  // Volume & Counts
  totalRequests: number;
  invalidUploadsCount: number;
  totalValidAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;

  // Key KPI
  processingSuccessRatePct: number;

  // Breakdown
  invalidUploadsByCategory: Record<InvalidUploadCategory, number>;
  failuresByCategory: Record<FailureCategory, number>;

  // Stage Latencies (in milliseconds)
  latencies: {
    validation: LatencyStats;
    parsing: LatencyStats;
    aiRequest: LatencyStats;
    postProcessing: LatencyStats;
    endToEnd: LatencyStats;
  };

  // Recent execution sample (without PII)
  recentRunsCount: number;
}

export interface LatencyStats {
  count: number;
  mean: number;
  min: number;
  max: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
}

class MetricsCollector {
  private invalidUploads: InvalidUploadRecord[] = [];
  private processingRecords: ProcessingRecord[] = [];
  private readonly maxHistory = 5000;

  /**
   * Records an invalid upload that was rejected before processing.
   * NOT counted in the valid processing attempts denominator.
   */
  public recordInvalidUpload(
    filename: string,
    sizeBytes: number,
    category: InvalidUploadCategory,
    reason: string
  ): void {
    const record: InvalidUploadRecord = {
      id: Math.random().toString(36).substring(2, 11),
      timestamp: Date.now(),
      filename,
      sizeBytes,
      category,
      reason,
    };

    this.invalidUploads.push(record);
    if (this.invalidUploads.length > this.maxHistory) {
      this.invalidUploads.shift();
    }
  }

  /**
   * Records a valid processing attempt (either success or failure).
   * Counted in the valid processing attempts denominator.
   */
  public recordProcessingAttempt(record: Omit<ProcessingRecord, "id" | "timestamp">): void {
    const fullRecord: ProcessingRecord = {
      ...record,
      id: Math.random().toString(36).substring(2, 11),
      timestamp: Date.now(),
    };

    this.processingRecords.push(fullRecord);
    if (this.processingRecords.length > this.maxHistory) {
      this.processingRecords.shift();
    }
  }

  /**
   * Calculates percentile from an array of numbers.
   */
  private computePercentiles(values: number[]): LatencyStats {
    if (values.length === 0) {
      return { count: 0, mean: 0, min: 0, max: 0, p50: 0, p90: 0, p95: 0, p99: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((acc, v) => acc + v, 0);
    const mean = Math.round((sum / count) * 100) / 100;

    const getP = (p: number) => {
      const idx = Math.min(Math.floor((p / 100) * count), count - 1);
      return Math.round(sorted[idx] * 100) / 100;
    };

    return {
      count,
      mean,
      min: Math.round(sorted[0] * 100) / 100,
      max: Math.round(sorted[count - 1] * 100) / 100,
      p50: getP(50),
      p90: getP(90),
      p95: getP(95),
      p99: getP(99),
    };
  }

  /**
   * Returns a comprehensive snapshot of all tracked metrics.
   */
  public getSnapshot(): MetricsSnapshot {
    const invalidUploadsCount = this.invalidUploads.length;
    const totalValidAttempts = this.processingRecords.length;
    const successfulAttempts = this.processingRecords.filter((r) => r.success).length;
    const failedAttempts = this.processingRecords.filter((r) => !r.success).length;

    const processingSuccessRatePct =
      totalValidAttempts > 0
        ? Math.round((successfulAttempts / totalValidAttempts) * 10000) / 100
        : 100.0;

    // Failure taxonomy counts
    const failuresByCategory: Record<FailureCategory, number> = {
      UNSUPPORTED_FORMAT: 0,
      MALFORMED_FILE: 0,
      PARSING_ERROR: 0,
      EMPTY_EXTRACTED_TEXT: 0,
      AI_PROVIDER_FAILURE: 0,
      AI_TIMEOUT: 0,
      AI_MALFORMED_OUTPUT: 0,
      INTERNAL_ERROR: 0,
    };

    for (const r of this.processingRecords) {
      if (!r.success && r.failureCategory) {
        failuresByCategory[r.failureCategory] =
          (failuresByCategory[r.failureCategory] || 0) + 1;
      }
    }

    // Invalid uploads taxonomy counts
    const invalidUploadsByCategory: Record<InvalidUploadCategory, number> = {
      MISSING_FILE_OR_CONTENT: 0,
      FILE_EMPTY_ZERO_BYTES: 0,
      FILE_EXCEEDS_SIZE_LIMIT: 0,
      UNSUPPORTED_MIME_OR_EXTENSION: 0,
    };

    for (const inv of this.invalidUploads) {
      invalidUploadsByCategory[inv.category] =
        (invalidUploadsByCategory[inv.category] || 0) + 1;
    }

    // Stage latencies
    const validWithLatencies = this.processingRecords.filter((r) => r.latencies);

    return {
      totalRequests: invalidUploadsCount + totalValidAttempts,
      invalidUploadsCount,
      totalValidAttempts,
      successfulAttempts,
      failedAttempts,
      processingSuccessRatePct,
      invalidUploadsByCategory,
      failuresByCategory,
      latencies: {
        validation: this.computePercentiles(
          validWithLatencies.map((r) => r.latencies.validationMs)
        ),
        parsing: this.computePercentiles(
          validWithLatencies.map((r) => r.latencies.parsingMs)
        ),
        aiRequest: this.computePercentiles(
          validWithLatencies.map((r) => r.latencies.aiRequestMs)
        ),
        postProcessing: this.computePercentiles(
          validWithLatencies.map((r) => r.latencies.postProcessingMs)
        ),
        endToEnd: this.computePercentiles(
          validWithLatencies.map((r) => r.latencies.totalLatencyMs)
        ),
      },
      recentRunsCount: this.processingRecords.length,
    };
  }

  /**
   * Resets metrics (used during test setup or benchmark resets).
   */
  public reset(): void {
    this.invalidUploads = [];
    this.processingRecords = [];
  }
}

// Global singleton metrics collector instance
export const globalMetrics = new MetricsCollector();

