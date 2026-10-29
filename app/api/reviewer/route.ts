export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { parseResumeBuffer } from "../../../lib/parsing/resume-parser";
import { validateUploadFile, validateExtractedText } from "../../../lib/validation/resume-validator";
import { executeAiCompletion } from "../../../lib/ai/ai-client";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const pastedText = formData.get("text") as string | null;

    let resumeText = "";

    if (file) {
      const validation = validateUploadFile({
        name: file.name,
        size: file.size,
        type: file.type,
      });

      if (!validation.isUploadValid) {
        return NextResponse.json(
          { error: validation.rejectionReason },
          { status: 400 }
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const parsed = await parseResumeBuffer(buffer, validation.format!);
      resumeText = parsed.text;
    } else if (pastedText) {
      resumeText = pastedText.trim();
    }

    const textValidation = validateExtractedText(resumeText);
    if (!textValidation.isValid) {
      return NextResponse.json(
        { error: textValidation.reason || "Could not read resume content. Please provide valid text." },
        { status: 400 }
      );
    }

    const prompt = `You are a professional resume editor.

Here is the candidate's resume:
${resumeText.substring(0, 5000)}

Do two things:
1. Give a brief review with key feedback points (clarity, ATS alignment, grammar, action verbs).
2. Rewrite the FULL resume with improvements — keep the EXACT same structure and sections as the original, just improve the wording, fix grammar, strengthen bullet points, and make it more ATS-friendly.

Format your response EXACTLY like this:

REVIEW:
[Your review feedback here]

REWRITTEN RESUME:
[Full rewritten resume here in plain text, keeping same format as original]`;

    const response = await executeAiCompletion({
      model: "auto",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2500,
      temperature: 0.3,
    });

    const result = response.content || "";
    const parts = result.split(/REWRITTEN RESUME:/i);
    const review = parts[0]?.replace(/REVIEW:/i, "").trim() || "";
    const rewritten = parts[1]?.trim() || "";

    return NextResponse.json({
      review,
      rewritten,
      original: resumeText,
      latencyMs: response.latencyMs,
      isMock: response.isMock,
    });
  } catch (err: any) {
    console.error("Reviewer error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to review resume" },
      { status: 500 }
    );
  }
}
