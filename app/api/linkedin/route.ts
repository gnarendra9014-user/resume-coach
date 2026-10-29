import { NextRequest, NextResponse } from "next/server";
import { createChatCompletion } from "../../utils/omniroute";
import * as cheerio from "cheerio";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { resume, role, linkedinUrl } = body;

    let scrapedProfile = "";
    if (linkedinUrl && linkedinUrl.includes("linkedin.com/in/")) {
      try {
        const res = await fetch(linkedinUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36",
          },
        });
        const html = await res.text();
        const $ = cheerio.load(html);
        const title = $("title").text() || "";
        const description = $('meta[name="description"]').attr("content") || "";
        // Extracting basic public meta data since full LinkedIn scraping requires auth.
        scrapedProfile = `Public Title: ${title}\nPublic Description: ${description}`;
      } catch (err: any) {
        console.warn("Could not scrape URL, falling back to pure generation:", err.message);
      }
    }

    const prompt = `You are an expert LinkedIn profile optimizer and career coach. 
    
    The user wants to optimize their LinkedIn profile for the role of: ${role}.
    Here is their current resume:
    ${resume}
    
    ${
      linkedinUrl
        ? `The user has provided their current LinkedIn URL: ${linkedinUrl}
        Here is the public metadata we could scrape from it:
        ${scrapedProfile}
        
        CRITICAL TASK: Since they provided a URL, you MUST audit their current profile.
        Output exactly 3 properties in valid JSON format:
        {
          "currentIssues": "Based on what a typical profile for this role should look like vs their current metadata/resume, what are they likely missing on their LinkedIn?",
          "recommendedHeadline": "A highly engaging, keyword-rich LinkedIn headline (under 120 chars) they should change to.",
          "whatToChangeInAbout": "Specific, actionable bullet points on what they need to rewrite in their 'About' section to secure interviews for this specific role."
        }`
        : `Output EXACTLY valid JSON with the following two properties:
        {
          "headline": "A highly engaging, keyword-rich LinkedIn headline (under 120 characters) that stands out to recruiters looking for this role.",
          "about": "A persuasive, story-driven 'About' section that highlights their top skills, experience, and passion. Make it sound professional yet approachable. Break it into readable paragraphs."
        }`
    }`;

    const response = await createChatCompletion({
      model: "auto",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 1000,
      response_format: { type: "json_object" },
    });

    return NextResponse.json({ linkedInOptimized: JSON.parse(response.choices[0].message.content || "{}") });
  } catch (error: any) {
    console.error("LinkedIn Optimizer error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
