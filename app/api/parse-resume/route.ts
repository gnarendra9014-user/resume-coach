import { NextRequest, NextResponse } from "next/server";
import { parseResumeBuffer, ResumeParseError } from "../../../lib/parsing/resume-parser";
import {
  validateUploadFile,
  validateExtractedText,
  FailureCategory,
} from "../../../lib/validation/resume-validator";
import { globalMetrics } from "../../../lib/metrics/metrics-collector";
import { executeAiCompletion, extractJsonFromAiResponse } from "../../../lib/ai/ai-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface ParsedResumeSchema {
  name: string;
  email: string;
  phone: string;
  location: string;
  role: string;
  experience: string;
  skills: string;
  education: string;
  projects: string;
  achievements: string;
}

const DEFAULT_PARSED_SCHEMA: ParsedResumeSchema = {
  name: "",
  email: "",
  phone: "",
  location: "",
  role: "",
  experience: "",
  skills: "",
  education: "",
  projects: "",
  achievements: "",
};

export async function POST(req: NextRequest) {
  const reqStart = performance.now();
  let validationMs = 0;
  let parsingMs = 0;
  let aiRequestMs = 0;
  let postProcessingMs = 0;
  let detectedFormat: "pdf" | "docx" | "txt" | undefined;
  let wordCount = 0;

  try {
    // Stage 1: Upload Validation
    const valStart = performance.now();
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      validationMs = performance.now() - valStart;
      globalMetrics.recordInvalidUpload(
        "unknown",
        0,
        "MISSING_FILE_OR_CONTENT",
        "No file uploaded in form data"
      );
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const uploadValidation = validateUploadFile({
      name: file.name,
      size: file.size,
      type: file.type,
    });

    validationMs = performance.now() - valStart;

    if (!uploadValidation.isUploadValid) {
      // Reject invalid upload - excluded from valid processing attempts denominator
      globalMetrics.recordInvalidUpload(
        file.name,
        file.size,
        uploadValidation.invalidCategory || "UNSUPPORTED_MIME_OR_EXTENSION",
        uploadValidation.rejectionReason || "Invalid file upload"
      );
      return NextResponse.json(
        { error: uploadValidation.rejectionReason },
        { status: 400 }
      );
    }

    detectedFormat = uploadValidation.format!;

    // Stage 2: File Reading & Parsing (counted in valid processing attempts)
    const parseStart = performance.now();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let parsedResult;
    try {
      parsedResult = await parseResumeBuffer(buffer, detectedFormat);
      parsingMs = performance.now() - parseStart;
    } catch (parseErr: any) {
      parsingMs = performance.now() - parseStart;
      const failureCategory: FailureCategory =
        parseErr instanceof ResumeParseError ? parseErr.category : "PARSING_ERROR";

      globalMetrics.recordProcessingAttempt({
        success: false,
        format: detectedFormat,
        failureCategory,
        errorMessage: parseErr.message,
        latencies: {
          validationMs: Math.round(validationMs * 100) / 100,
          parsingMs: Math.round(parsingMs * 100) / 100,
          aiRequestMs: 0,
          postProcessingMs: 0,
          totalLatencyMs: Math.round((performance.now() - reqStart) * 100) / 100,
        },
      });

      return NextResponse.json(
        { error: parseErr.message, category: failureCategory },
        { status: 400 }
      );
    }

    const textValidation = validateExtractedText(parsedResult.text);
    wordCount = textValidation.wordCount;

    if (!textValidation.isValid) {
      const failureCat: FailureCategory =
        textValidation.failureCategory || "EMPTY_EXTRACTED_TEXT";

      globalMetrics.recordProcessingAttempt({
        success: false,
        format: detectedFormat,
        wordCount,
        failureCategory: failureCat,
        errorMessage: textValidation.reason,
        latencies: {
          validationMs: Math.round(validationMs * 100) / 100,
          parsingMs: Math.round(parsingMs * 100) / 100,
          aiRequestMs: 0,
          postProcessingMs: 0,
          totalLatencyMs: Math.round((performance.now() - reqStart) * 100) / 100,
        },
      });

      return NextResponse.json(
        { error: textValidation.reason, category: failureCat },
        { status: 400 }
      );
    }

    // Stage 3: AI Information Extraction
    const prompt = `Extract the following information from the provided resume text.
Return ONLY a raw JSON object with these exact keys, and no markdown formatting or backticks around it:
{
  "name": "",
  "email": "",
  "phone": "",
  "location": "",
  "role": "",
  "experience": "",
  "skills": "",
  "education": "",
  "projects": "",
  "achievements": ""
}

If a field is not found in the resume, leave it as an empty string. Do not invent information.

Resume Text:
${parsedResult.text.substring(0, 4000)}`;

    const aiStart = performance.now();
    let aiResponse;
    try {
      aiResponse = await executeAiCompletion({
        messages: [{ role: "user", content: prompt }],
        model: "auto",
        temperature: 0.1,
      });
      aiRequestMs = performance.now() - aiStart;
    } catch (aiErr: any) {
      aiRequestMs = performance.now() - aiStart;
      const failureCat: FailureCategory =
        aiErr.category || "AI_PROVIDER_FAILURE";

      globalMetrics.recordProcessingAttempt({
        success: false,
        format: detectedFormat,
        wordCount,
        failureCategory: failureCat,
        errorMessage: aiErr.message,
        latencies: {
          validationMs: Math.round(validationMs * 100) / 100,
          parsingMs: Math.round(parsingMs * 100) / 100,
          aiRequestMs: Math.round(aiRequestMs * 100) / 100,
          postProcessingMs: 0,
          totalLatencyMs: Math.round((performance.now() - reqStart) * 100) / 100,
        },
      });

      return NextResponse.json(
        { error: "AI Extraction failed: " + aiErr.message, category: failureCat },
        { status: 500 }
      );
    }

    // Stage 4: Post-Processing & Serialization
    const postStart = performance.now();
    let parsedData: ParsedResumeSchema;
    try {
      parsedData = extractJsonFromAiResponse<ParsedResumeSchema>(
        aiResponse.content,
        DEFAULT_PARSED_SCHEMA
      );
    } catch (jsonErr: any) {
      postProcessingMs = performance.now() - postStart;
      globalMetrics.recordProcessingAttempt({
        success: false,
        format: detectedFormat,
        wordCount,
        failureCategory: "AI_MALFORMED_OUTPUT",
        errorMessage: jsonErr.message,
        latencies: {
          validationMs: Math.round(validationMs * 100) / 100,
          parsingMs: Math.round(parsingMs * 100) / 100,
          aiRequestMs: Math.round(aiRequestMs * 100) / 100,
          postProcessingMs: Math.round(postProcessingMs * 100) / 100,
          totalLatencyMs: Math.round((performance.now() - reqStart) * 100) / 100,
        },
      });

      return NextResponse.json(
        { error: "Failed to parse AI output into JSON", category: "AI_MALFORMED_OUTPUT" },
        { status: 500 }
      );
    }

    postProcessingMs = performance.now() - postStart;
    const totalLatencyMs = performance.now() - reqStart;

    // Record Successful Processing Attempt
    globalMetrics.recordProcessingAttempt({
      success: true,
      format: detectedFormat,
      wordCount,
      latencies: {
        validationMs: Math.round(validationMs * 100) / 100,
        parsingMs: Math.round(parsingMs * 100) / 100,
        aiRequestMs: Math.round(aiRequestMs * 100) / 100,
        postProcessingMs: Math.round(postProcessingMs * 100) / 100,
        totalLatencyMs: Math.round(totalLatencyMs * 100) / 100,
      },
    });

    const response = NextResponse.json(parsedData);
    response.headers.set("X-Latency-Validation-Ms", validationMs.toFixed(1));
    response.headers.set("X-Latency-Parsing-Ms", parsingMs.toFixed(1));
    response.headers.set("X-Latency-Ai-Ms", aiRequestMs.toFixed(1));
    response.headers.set("X-Latency-Total-Ms", totalLatencyMs.toFixed(1));
    return response;
  } catch (error: any) {
    const totalLatencyMs = performance.now() - reqStart;
    globalMetrics.recordProcessingAttempt({
      success: false,
      format: detectedFormat,
      failureCategory: "INTERNAL_ERROR",
      errorMessage: error.message || "Unknown error",
      latencies: {
        validationMs: Math.round(validationMs * 100) / 100,
        parsingMs: Math.round(parsingMs * 100) / 100,
        aiRequestMs: Math.round(aiRequestMs * 100) / 100,
        postProcessingMs: Math.round(postProcessingMs * 100) / 100,
        totalLatencyMs: Math.round(totalLatencyMs * 100) / 100,
      },
    });

    return NextResponse.json(
      { error: error.message || "Something went wrong", category: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
