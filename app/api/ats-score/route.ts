import { NextRequest, NextResponse } from "next/server";
import { executeAiCompletion } from "../../../lib/ai/ai-client";
import { validateExtractedText } from "../../../lib/validation/resume-validator";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { resume, role } = body;

    if (!resume || typeof resume !== "string") {
      return NextResponse.json(
        { error: "Resume text is required", score: null, tips: [] },
        { status: 400 }
      );
    }

    const validation = validateExtractedText(resume);
    if (!validation.isValid) {
      return NextResponse.json(
        { error: validation.reason, score: null, tips: [] },
        { status: 400 }
      );
    }

    const prompt = `Analyze this resume for ATS (Applicant Tracking System) compatibility${role ? ` for the target role: "${role}"` : ""} and give:
1. A calibrated score out of 100 based on standard industry criteria: keyword relevance, impact quantification, clean formatting, action verbs, and skill coverage.
2. 3-5 specific, evidence-based tips to improve it.

Resume Content:
${resume.substring(0, 5000)}

Respond in this exact format:
SCORE: [number between 0 and 100]
TIPS:
- [tip 1]
- [tip 2]
- [tip 3]`;

    const response = await executeAiCompletion({
      model: "auto",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 600,
      temperature: 0.2,
    });

    const rawContent = response.content || "";

    // Parse score and tips
    let extractedScore: number | null = null;
    const scoreMatch = rawContent.match(/SCORE:\s*(\d+)/i);
    if (scoreMatch && scoreMatch[1]) {
      const parsed = parseInt(scoreMatch[1], 10);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
        extractedScore = parsed;
      }
    }

    const tips: string[] = [];
    const tipsSection = rawContent.split(/TIPS:?/i)[1];
    if (tipsSection) {
      const tipLines = tipsSection.split(/\r?\n/);
      for (const line of tipLines) {
        const clean = line.replace(/^[\s*\-•\d.]+/g, "").trim();
        if (clean.length > 3) {
          tips.push(clean);
        }
      }
    }

    return NextResponse.json({
      result: rawContent,
      score: extractedScore,
      tips,
      latencyMs: response.latencyMs,
      isMock: response.isMock,
    });
  } catch (error: any) {
    console.error("ATS Score API Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to calculate ATS score", score: null, tips: [] },
      { status: 500 }
    );
  }
}
