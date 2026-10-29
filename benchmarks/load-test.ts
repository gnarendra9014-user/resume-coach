/**
 * Production API Latency & Throughput Benchmark Harness
 * 
 * Benchmarks the actual Next.js application endpoints:
 * - Measures throughput (RPS), p50, p90, p95, p99 latency
 * - Tests low, moderate, and high concurrency levels
 * - Extracts stage latency breakdown from server headers (Upload, Parsing, AI, Postprocessing)
 * - Measures error rate, timeout rate, and memory usage
 * - Outputs structured JSON and markdown summary tables
 */

import fs from "fs";
import path from "path";

export interface BenchmarkScenarioConfig {
  name: string;
  concurrency: number;
  totalRequests: number;
  warmupRequests: number;
  endpoint: string;
  fixtureFile: string;
  timeoutMs: number;
}

export interface RequestMetric {
  statusCode: number;
  durationMs: number;
  isError: boolean;
  isTimeout: boolean;
  stageValidationMs?: number;
  stageParsingMs?: number;
  stageAiMs?: number;
  stageTotalMs?: number;
}

export interface ScenarioResult {
  scenarioName: string;
  concurrency: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  timedOutRequests: number;
  errorRatePct: number;
  timeoutRatePct: number;
  totalDurationSeconds: number;
  throughputRps: number;
  latencies: {
    min: number;
    mean: number;
    p50: number;
    p90: number;
    p95: number;
    p99: number;
    max: number;
  };
  stageAverages: {
    validationMs: number;
    parsingMs: number;
    aiRequestMs: number;
    postProcessingMs: number;
  };
  memoryUsage: {
    startHeapMb: number;
    endHeapMb: number;
    deltaMb: number;
  };
}

export interface FullBenchmarkReport {
  timestamp: string;
  environment: {
    nodeVersion: string;
    platform: string;
    arch: string;
    cpus: number;
    targetUrl: string;
    mode: "mock-provider" | "real-provider";
  };
  scenarios: ScenarioResult[];
}

function calculatePercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(Math.floor((p / 100) * sorted.length), sorted.length - 1);
  return Math.round(sorted[index] * 100) / 100;
}

async function sendRequest(
  url: string,
  filePath: string,
  timeoutMs: number
): Promise<RequestMetric> {
  const start = performance.now();
  const fileBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);

  const formData = new FormData();
  const blob = new Blob([fileBuffer], {
    type: fileName.endsWith(".pdf")
      ? "application/pdf"
      : fileName.endsWith(".docx")
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "text/plain",
  });
  formData.append("file", blob, fileName);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timer);
    const duration = performance.now() - start;

    const valMs = parseFloat(res.headers.get("X-Latency-Validation-Ms") || "0");
    const parseMs = parseFloat(res.headers.get("X-Latency-Parsing-Ms") || "0");
    const aiMs = parseFloat(res.headers.get("X-Latency-Ai-Ms") || "0");
    const totMs = parseFloat(res.headers.get("X-Latency-Total-Ms") || "0");

    return {
      statusCode: res.status,
      durationMs: duration,
      isError: !res.ok,
      isTimeout: false,
      stageValidationMs: valMs,
      stageParsingMs: parseMs,
      stageAiMs: aiMs,
      stageTotalMs: totMs,
    };
  } catch (err: any) {
    clearTimeout(timer);
    const duration = performance.now() - start;
    const isTimeout = err.name === "AbortError";
    return {
      statusCode: isTimeout ? 408 : 500,
      durationMs: duration,
      isError: true,
      isTimeout,
    };
  }
}

async function runScenario(
  config: BenchmarkScenarioConfig,
  baseUrl: string
): Promise<ScenarioResult> {
  const url = `${baseUrl}${config.endpoint}`;
  const fixturePath = path.resolve(__dirname, "..", "tests", "fixtures", config.fixtureFile);

  if (!fs.existsSync(fixturePath)) {
    throw new Error(`Fixture file not found: ${fixturePath}`);
  }

  // Warm-up phase
  if (config.warmupRequests > 0) {
    for (let i = 0; i < config.warmupRequests; i++) {
      await sendRequest(url, fixturePath, config.timeoutMs);
    }
  }

  const startMem = process.memoryUsage().heapUsed / (1024 * 1024);
  const scenarioStart = performance.now();
  const results: RequestMetric[] = [];

  let requestIndex = 0;
  async function worker() {
    while (requestIndex < config.totalRequests) {
      requestIndex++;
      const metric = await sendRequest(url, fixturePath, config.timeoutMs);
      results.push(metric);
    }
  }

  // Spawn concurrency workers
  const workers: Promise<void>[] = [];
  const workerCount = Math.min(config.concurrency, config.totalRequests);
  for (let i = 0; i < workerCount; i++) {
    workers.push(worker());
  }

  await Promise.all(workers);

  const totalDurationMs = performance.now() - scenarioStart;
  const totalDurationSec = totalDurationMs / 1000;
  const endMem = process.memoryUsage().heapUsed / (1024 * 1024);

  // Compute Latency Statistics
  const durations = results.map((r) => r.durationMs).sort((a, b) => a - b);
  const successfulCount = results.filter((r) => !r.isError).length;
  const failedCount = results.filter((r) => r.isError && !r.isTimeout).length;
  const timeoutCount = results.filter((r) => r.isTimeout).length;

  const validStageMetrics = results.filter((r) => r.stageTotalMs && r.stageTotalMs > 0);
  const nStages = Math.max(1, validStageMetrics.length);

  const avgVal = validStageMetrics.reduce((acc, r) => acc + (r.stageValidationMs || 0), 0) / nStages;
  const avgParse = validStageMetrics.reduce((acc, r) => acc + (r.stageParsingMs || 0), 0) / nStages;
  const avgAi = validStageMetrics.reduce((acc, r) => acc + (r.stageAiMs || 0), 0) / nStages;
  const avgTot = validStageMetrics.reduce((acc, r) => acc + (r.stageTotalMs || 0), 0) / nStages;
  const avgPost = Math.max(0, avgTot - (avgVal + avgParse + avgAi));

  return {
    scenarioName: config.name,
    concurrency: config.concurrency,
    totalRequests: results.length,
    successfulRequests: successfulCount,
    failedRequests: failedCount,
    timedOutRequests: timeoutCount,
    errorRatePct: Math.round(((failedCount + timeoutCount) / results.length) * 10000) / 100,
    timeoutRatePct: Math.round((timeoutCount / results.length) * 10000) / 100,
    totalDurationSeconds: Math.round(totalDurationSec * 100) / 100,
    throughputRps: Math.round((results.length / totalDurationSec) * 100) / 100,
    latencies: {
      min: Math.round(durations[0] * 100) / 100,
      mean: Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 100) / 100,
      p50: calculatePercentile(durations, 50),
      p90: calculatePercentile(durations, 90),
      p95: calculatePercentile(durations, 95),
      p99: calculatePercentile(durations, 99),
      max: Math.round(durations[durations.length - 1] * 100) / 100,
    },
    stageAverages: {
      validationMs: Math.round(avgVal * 100) / 100,
      parsingMs: Math.round(avgParse * 100) / 100,
      aiRequestMs: Math.round(avgAi * 100) / 100,
      postProcessingMs: Math.round(avgPost * 100) / 100,
    },
    memoryUsage: {
      startHeapMb: Math.round(startMem * 100) / 100,
      endHeapMb: Math.round(endMem * 100) / 100,
      deltaMb: Math.round((endMem - startMem) * 100) / 100,
    },
  };
}

export async function runFullBenchmark(options?: {
  baseUrl?: string;
  outputDir?: string;
  mode?: "mock-provider" | "real-provider";
}): Promise<FullBenchmarkReport> {
  const baseUrl = options?.baseUrl || "http://localhost:3000";
  const mode = options?.mode || (process.env.MOCK_AI === "true" ? "mock-provider" : "real-provider");

  console.log(`\n===============================================================`);
  console.log(`       RESUME COACH: API LATENCY & THROUGHPUT BENCHMARK`);
  console.log(`       Target Endpoint: ${baseUrl}/api/parse-resume`);
  console.log(`       Execution Mode:  ${mode.toUpperCase()}`);
  console.log(`===============================================================\n`);

  const scenarios: BenchmarkScenarioConfig[] = [
    {
      name: "Low Concurrency (C=1, 20 requests)",
      concurrency: 1,
      totalRequests: 20,
      warmupRequests: 3,
      endpoint: "/api/parse-resume",
      fixtureFile: "valid-swe-resume.txt",
      timeoutMs: 10000,
    },
    {
      name: "Low Concurrency (C=5, 50 requests)",
      concurrency: 5,
      totalRequests: 50,
      warmupRequests: 5,
      endpoint: "/api/parse-resume",
      fixtureFile: "valid-swe-resume.txt",
      timeoutMs: 10000,
    },
    {
      name: "Moderate Concurrency (C=15, 75 requests - PDF)",
      concurrency: 15,
      totalRequests: 75,
      warmupRequests: 5,
      endpoint: "/api/parse-resume",
      fixtureFile: "valid-swe-resume.pdf",
      timeoutMs: 15000,
    },
    {
      name: "Moderate Concurrency (C=25, 100 requests - DOCX)",
      concurrency: 25,
      totalRequests: 100,
      warmupRequests: 5,
      endpoint: "/api/parse-resume",
      fixtureFile: "valid-swe-resume.docx",
      timeoutMs: 15000,
    },
    {
      name: "High Concurrency (C=50, 150 requests)",
      concurrency: 50,
      totalRequests: 150,
      warmupRequests: 5,
      endpoint: "/api/parse-resume",
      fixtureFile: "valid-swe-resume.txt",
      timeoutMs: 20000,
    },
  ];

  const results: ScenarioResult[] = [];

  for (const s of scenarios) {
    process.stdout.write(`Running: ${s.name.padEnd(52)} ... `);
    const res = await runScenario(s, baseUrl);
    results.push(res);
    console.log(`Done (${res.throughputRps} req/s | p50: ${res.latencies.p50}ms | p95: ${res.latencies.p95}ms)`);
  }

  const report: FullBenchmarkReport = {
    timestamp: new Date().toISOString(),
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      cpus: require("os").cpus().length,
      targetUrl: baseUrl,
      mode,
    },
    scenarios: results,
  };

  const resultsDir = options?.outputDir || path.resolve(__dirname, "results");
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const outPath = path.join(resultsDir, "benchmark-report.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf-8");

  // Print Summary Table
  console.log(`\n-----------------------------------------------------------------------------------------------------`);
  console.log(`                                API BENCHMARK LATENCY & THROUGHPUT SUMMARY`);
  console.log(`-----------------------------------------------------------------------------------------------------`);
  console.log(`Scenario                   Conc  TotalReq  RPS      p50 (ms)  p95 (ms)  p99 (ms)  Errors  Validation Parsing  AI Req`);
  console.log(`-----------------------------------------------------------------------------------------------------`);
  for (const r of results) {
    console.log(
      `${r.scenarioName.slice(0, 26).padEnd(26)} ` +
      `${String(r.concurrency).padStart(4)}  ` +
      `${String(r.totalRequests).padStart(8)}  ` +
      `${r.throughputRps.toFixed(1).padStart(7)}  ` +
      `${r.latencies.p50.toFixed(1).padStart(8)}  ` +
      `${r.latencies.p95.toFixed(1).padStart(8)}  ` +
      `${r.latencies.p99.toFixed(1).padStart(8)}  ` +
      `${(r.errorRatePct + "%").padStart(6)}  ` +
      `${r.stageAverages.validationMs.toFixed(1).padStart(10)}  ` +
      `${r.stageAverages.parsingMs.toFixed(1).padStart(7)}  ` +
      `${r.stageAverages.aiRequestMs.toFixed(1).padStart(6)}`
    );
  }
  console.log(`-----------------------------------------------------------------------------------------------------`);
  console.log(`Detailed JSON benchmark saved to: ${outPath}\n`);

  return report;
}

// Auto-run if executed directly
if (require.main === module || process.argv[1]?.includes("load-test")) {
  runFullBenchmark().catch(console.error);
}

