import { NextRequest, NextResponse } from "next/server";
import { createChatCompletion } from "../../utils/omniroute";

export async function POST(req: NextRequest) {
  const { role, company, experience, section } = await req.json();

  // If fetching section-specific questions
  if (section) {
    const sectionPrompt = `You are an expert interview coach. Generate a detailed study guide for the "${section}" section for a ${role} interview at ${company} (${experience} level).

IMPORTANT: Only include topics that are ACTUALLY required for a ${role} position. For example:
- HR roles: Focus on communication, behavioural, HR processes, labour laws - NO DSA
- Product Manager: Focus on product thinking, metrics, stakeholder management - minimal DSA
- Data Analyst: Focus on SQL, Excel, statistics, visualization - basic DSA only
- Frontend Developer: Focus on HTML/CSS/JS, frameworks, browser APIs - light DSA
- ML Engineer: Focus on ML algorithms, statistics, Python - moderate DSA
- Software Engineer: Full DSA, System Design, OOP
- DevOps: Focus on CI/CD, cloud, infrastructure - minimal DSA

Format your response EXACTLY as JSON like this:
{
  "patterns": [
    {
      "name": "Pattern/Topic Name",
      "description": "Brief description",
      "questions": [
        {
          "title": "Problem or Topic Title",
          "difficulty": "Easy|Medium|Hard",
          "leetcode": "https://leetcode.com/problems/problem-slug/",
          "youtube": "https://www.youtube.com/results?search_query=topic+title+explanation"
        }
      ]
    }
  ],
  "tips": ["tip1", "tip2", "tip3"],
  "resources": ["resource1", "resource2"]
}

Generate 6-8 patterns with 6-8 questions/topics each relevant to ${role}.
For non-technical roles like HR, skip leetcode links and focus on interview questions and resources.
Return ONLY the JSON, no extra text.`;

    const response = await createChatCompletion({
      model: "auto",
      messages: [{ role: "user", content: sectionPrompt }],
      max_tokens: 2000,
    });

    try {
      const text = response.choices[0].message.content || "{}";
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      return NextResponse.json({ sectionData: parsed });
    } catch {
      return NextResponse.json({ sectionData: null });
    }
  }

  // General roadmap prompt
  const prompt = `You are an expert interview coach. Create a detailed interview preparation guide for:
- Role: ${role}
- Company: ${company}
- Experience: ${experience}

Include these sections with detailed points:

### DSA (Data Structures & Algorithms)
- List specific topics like arrays, strings, trees, graphs, DP, sorting etc
- Mention difficulty level and frequency at ${company}

### OOP & Design Patterns
- Key OOP concepts to master
- Important design patterns for ${role}

### System Design
- Key system design concepts
- Common ${company} system design questions

### Database & SQL
- Important DB concepts
- SQL vs NoSQL for ${company}

### Operating Systems & Networking
- Key OS concepts
- Networking basics

### Behavioural Interview
- STAR method tips
- Common questions at ${company}

### Company Specific Tips for ${company}
- Interview process and rounds
- What ${company} looks for
- Recent interview patterns

Give specific, actionable advice for ${role} at ${company} for ${experience} level.`;

  const response = await createChatCompletion({
    model: "auto",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 2000,
  });

  return NextResponse.json({ result: response.choices[0].message.content });
}