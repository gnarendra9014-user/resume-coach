import { NextRequest, NextResponse } from "next/server";
import { createChatCompletion } from "../../utils/omniroute";

export async function POST(req: NextRequest) {
  const { role, messages } = await req.json();

  const systemPrompt = `You are a strict, professional interviewer conducting a real job interview for a ${role} position. 

Your behavior:
- Ask one focused interview question at a time
- After the candidate answers, respond like a real interviewer — acknowledge briefly, then either ask a follow-up or move to the next topic
- Be direct, formal and professional. No excessive praise.
- Probe deeper if the answer is vague or incomplete
- After 5-6 exchanges, wrap up the interview professionally
- Never break character. You are the interviewer, not an AI assistant.
- Keep your responses concise — max 3 sentences then your next question.

Start by greeting the candidate formally and asking your first question.`;

  const response = await createChatCompletion({
    model: "auto",
    messages: [
      { role: "system", content: systemPrompt },
      ...messages,
    ],
    max_tokens: 300,
  });

  return NextResponse.json({
    result: response.choices[0].message.content,
  });
}