import { NextRequest, NextResponse } from "next/server";
import { createChatCompletion } from "../../utils/omniroute";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { resume, role, jobDescription } = body;

    const prompt = `You are an expert career coach. Write a highly persuasive, professional cover letter for a candidate applying for the role of ${role}.
    
Candidate's Resume:
${resume}

${jobDescription ? `Target Job Description:\n${jobDescription}\nCRITICAL: Tailor the cover letter heavily to match the needs of this job description.` : ""}

Format the output as a clean, plain text cover letter. Do not include any meta-commentary, just the letter itself. Keep it under 400 words.`;

    const response = await createChatCompletion({
      model: "auto",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 1000,
    });

    return NextResponse.json({ coverLetter: response.choices[0].message.content });
  } catch (error: any) {
    console.error("Cover Letter Generator error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
