/**
 * Fixture Generator for Resume Coach Testing & Benchmarking
 * Generates valid PDFs, DOCXs, TXTs, along with malformed, oversized, and edge-case fixtures.
 */

import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { Document, Paragraph, TextRun, Packer, HeadingLevel } from "docx";

const FIXTURES_DIR = path.resolve(__dirname);

const SAMPLE_RESUME_TEXT = `Alex Morgan
Software Engineer
alex.morgan@example.com | (555) 019-2831 | San Francisco, CA | github.com/alexmorgan

PROFESSIONAL SUMMARY
Results-oriented Software Engineer with 4+ years of hands-on experience designing and delivering high-throughput, low-latency microservices, RESTful APIs, and responsive web platforms. Proficient in TypeScript, React, Next.js, Node.js, Python, PostgreSQL, and AWS. Demonstrated track record of optimizing application performance and boosting ATS conversion rates.

WORK EXPERIENCE
Senior Full-Stack Engineer | Apex Systems | 2022 - Present
- Architected and deployed scalable payment ingestion service handling 45,000 transactions/second with 99.99% uptime.
- Reduced p99 API response latencies from 420ms to 85ms by introducing Redis caching and SQL indexing.
- Spearheaded team transition from legacy React to Next.js 14 App Router, cutting client bundle size by 38%.
- Mentored 5 junior engineers and instituted automated end-to-end testing with 88% branch coverage.

Software Engineer | CloudScale Labs | 2020 - 2022
- Developed customer-facing analytics dashboards using React, TypeScript, TailwindCSS, and D3.js.
- Integrated PostgreSQL database layer using Prisma ORM, improving complex query performance by 25%.
- Implemented OAuth2 and JWT-based authentication pipelines ensuring strict SOC-2 compliance.

EDUCATION
Bachelor of Science in Computer Science | University of California, Berkeley | 2016 - 2020
- Relevant Coursework: Data Structures, Algorithms, Distributed Systems, Database Management Systems.
- GPA: 3.82 / 4.0

TECHNICAL SKILLS
Languages: TypeScript, JavaScript, Python, Go, SQL, HTML5, CSS3
Frameworks & Libraries: React, Next.js, Node.js, Express, TailwindCSS, Jest, Vitest
Databases & Tools: PostgreSQL, Redis, MongoDB, Docker, Kubernetes, AWS (S3, ECS, Lambda), Git, CI/CD
`;

async function generatePdf(filePath: string, content: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    doc.fontSize(18).font("Helvetica-Bold").text("Alex Morgan", { align: "center" });
    doc.fontSize(10).font("Helvetica").text("alex.morgan@example.com | San Francisco, CA", { align: "center" });
    doc.moveDown();

    doc.fontSize(10).font("Helvetica").text(content, { lineGap: 3 });
    doc.end();

    stream.on("finish", () => resolve());
    stream.on("error", reject);
  });
}

async function generateDocx(filePath: string, content: string): Promise<void> {
  const lines = content.split("\n");
  const paragraphs = lines.map((line) => {
    const isHeading = line === line.toUpperCase() && line.trim().length > 3 && line.trim().length < 40;
    return new Paragraph({
      heading: isHeading ? HeadingLevel.HEADING_2 : undefined,
      children: [
        new TextRun({
          text: line,
          bold: isHeading,
          size: isHeading ? 24 : 20,
        }),
      ],
    });
  });

  const doc = new Document({
    sections: [{ properties: {}, children: paragraphs }],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(filePath, buffer);
}

export async function generateAllFixtures() {
  if (!fs.existsSync(FIXTURES_DIR)) {
    fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  }

  console.log("Generating test fixtures in:", FIXTURES_DIR);

  // 1. Valid TXT
  fs.writeFileSync(path.join(FIXTURES_DIR, "valid-swe-resume.txt"), SAMPLE_RESUME_TEXT, "utf-8");

  // 2. Valid PDF
  await generatePdf(path.join(FIXTURES_DIR, "valid-swe-resume.pdf"), SAMPLE_RESUME_TEXT);

  // 3. Valid DOCX
  await generateDocx(path.join(FIXTURES_DIR, "valid-swe-resume.docx"), SAMPLE_RESUME_TEXT);

  // 4. Empty File (0 bytes)
  fs.writeFileSync(path.join(FIXTURES_DIR, "empty-file.txt"), Buffer.alloc(0));

  // 5. Whitespace only
  fs.writeFileSync(path.join(FIXTURES_DIR, "whitespace-only.txt"), "   \n\n\t   \n  \r\n   ", "utf-8");

  // 6. Short text (< 30 chars, not a real resume)
  fs.writeFileSync(path.join(FIXTURES_DIR, "short-text.txt"), "Hi John Doe", "utf-8");

  // 7. Corrupted PDF (does not start with %PDF)
  fs.writeFileSync(path.join(FIXTURES_DIR, "corrupt-pdf.pdf"), Buffer.from("NOT_A_PDF_STREAM_CORRUPTED_BINARY_1234567890"));

  // 8. Corrupted DOCX (starts with PK but corrupt zip central directory)
  const fakeZip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x99, 0x88, 0x77, 0x66, 0x55, 0x44]);
  fs.writeFileSync(path.join(FIXTURES_DIR, "corrupt-docx.docx"), fakeZip);

  // 9. Oversized File (> 10 MB)
  const oversizedPath = path.join(FIXTURES_DIR, "oversized-resume.txt");
  const tenMbPlusOne = 10 * 1024 * 1024 + 1024; // 10.001 MB
  const chunk = Buffer.from("Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(100));
  const fd = fs.openSync(oversizedPath, "w");
  let written = 0;
  while (written < tenMbPlusOne) {
    fs.writeSync(fd, chunk);
    written += chunk.length;
  }
  fs.closeSync(fd);

  // 10. Unsupported format: Executable (.exe)
  const exeHeader = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]); // DOS MZ
  fs.writeFileSync(path.join(FIXTURES_DIR, "unsupported-app.exe"), exeHeader);

  // 11. Unsupported format: Image (.png)
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  fs.writeFileSync(path.join(FIXTURES_DIR, "unsupported-image.png"), pngHeader);

  console.log("All 11 representative test fixtures generated successfully.");
}

// Auto-run if executed directly
if (require.main === module || process.argv[1]?.includes("generate-fixtures")) {
  generateAllFixtures().catch(console.error);
}

