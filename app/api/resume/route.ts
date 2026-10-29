import { NextRequest, NextResponse } from "next/server";
import { createChatCompletion } from "../../utils/omniroute";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, phone, role, skills, education, projects, experience, language, template, jobDescription } = body;

    const languageInstruction = language && language !== "english"
      ? `Write the entire resume in ${language} language.`
      : "";

    const templateMap: Record<string, string> = {
      classic: `Use a traditional resume format with sections: Summary, Education, Skills, Projects, Experience. Use plain text with clear headers in ALL CAPS.`,
      modern: `Use a modern resume format. Use bold section headers with a line separator (---) under each. Include a brief professional summary at the top.`,
      minimal: `Use a minimal resume format. Keep it concise and to the point. No fluff. Only the most important details. Max 1 page worth of content.`,
      creative: `Use a creative resume format. Start with a strong personal branding statement. Use unique section names like "What I Know", "What I've Built", "Where I've Studied". Make it memorable and stand out.`,
    };

    const templateInstruction = templateMap[template] || templateMap["classic"];

    const tailerPrompt = jobDescription ? `
      CRITICAL INSTRUCTION: The user is applying for a specific job. 
      Here is the Job Description: "${jobDescription}"
      You MUST strategically re-write and optimize the bullet points in their experience, skills, and projects to heavily match the keywords and responsibilities in this job description. Do not lie, but frame their background naturally around these requirements to ensure a 100% ATS score.` : "";

    const prompt = `Create a professional resume for a fresher with the following details:
        Name: ${name}
        Email: ${email}
        Phone: ${phone}
        Target Role: ${role}
        Skills: ${skills}
        Projects: ${projects}
        Experience: ${experience}
        Education: ${education}
        
        Template Style Strategy: ${templateInstruction}
        ${languageInstruction}
        ${tailerPrompt}
        
        CRITICAL TASK: Output EXACTLY a valid JSON object matching this schema. Do not invent details, use the provided input. Extrapolate missing professional summaries or formatting needed.
        {
          "personal": {
            "name": "Full Name",
            "contact": "Email | Phone | Location / LinkedIn"
          },
          "summary": "A strong, optimized professional summary (3-4 lines).",
          "experience": [
            { "title": "Job Title", "company": "Company Name", "date": "Date Range", "points": ["Bullet 1", "Bullet 2"] }
          ],
          "education": [
            { "degree": "Degree Name", "school": "School Name", "date": "Date Range", "details": "GPA/Awards/Relevant Coursework" }
          ],
          "projects": [
            { "name": "Project Name", "tech": "Tech Stack", "date": "Date Range", "points": ["Bullet 1", "Bullet 2"] }
          ],
          "skills": ["Category 1: Skill A, Skill B", "Category 2: Skill C, Skill D"]
        }`;

    const response = await createChatCompletion({
      model: "auto",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1500,
      response_format: { type: "json_object" },
    });

    return NextResponse.json({ result: response.choices[0].message.content });
  } catch (error: any) {
    console.error("OmniRoute error:", error.message);
    return NextResponse.json({ result: "Error: " + error.message }, { status: 500 });
  }
}