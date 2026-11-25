# Resume Coach

Resume Coach is an AI-powered web app that helps job seekers create stronger application materials and practice interviews in one place. It combines resume generation, resume review, interview simulation, and preparation roadmaps into a single Next.js application.

## Features

- **AI Resume Builder**
  - Generates resumes from user details
  - Supports multiple styles (Modern, Classic, Minimal, Creative)
  - Supports multiple languages (English, Hindi, French, German, Spanish)
  - Includes ATS-oriented checks and scoring flow
- **Resume Parsing**
  - Upload a resume (`.pdf`, `.txt`, basic `.docx` fallback) to prefill form fields
- **Resume Reviewer**
  - Upload or paste resume content for AI feedback
  - Returns both review notes and a rewritten version
  - Download rewritten output as PDF
- **Cover Letter Generator**
  - Creates a tailored cover letter from generated resume content
- **LinkedIn Optimizer**
  - Generates headline/about recommendations
  - Supports optional LinkedIn URL metadata-based suggestions
- **Mock Interview**
  - AI interviewer with text, voice, and video interaction modes
- **Interview Tips / Study Roadmap**
  - Role- and company-specific preparation roadmap with topics/resources
- **Application Tracking Dashboard**
  - Drag-and-drop board to track resume status (draft/applied/interviewing/offer/rejected)

## Tech Stack

- **Framework:** Next.js (App Router), React, TypeScript
- **Styling:** Tailwind CSS + custom styles
- **AI:** Groq SDK
- **Auth/Data:** Supabase (auth + resumes table access)
- **State:** Zustand (with persistence)
- **Document/PDF utilities:** `jspdf`, `pdfkit`, `docx`, `pdf-parse`, `file-saver`

## Prerequisites

- Node.js 20+ recommended
- npm (project includes `package-lock.json`)
- Supabase project (for auth and saved resumes pages)
- Groq API key

## Getting Started

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment variables

Create a local env file:

```bash
cp .env.example .env.local
```

If `.env.example` does not exist yet, create `.env.local` manually with the variables below.

| Variable | Required | Purpose |
| --- | --- | --- |
| `GROQ_API_KEY` | Yes | Server-side key used by AI API routes (`/api/resume`, `/api/interview`, `/api/tips`, etc.) |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL used by the frontend client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon public key used by the frontend client |
| `D_ID_API_KEY` | Optional | Used by `/api/d-id` route for avatar/video generation |

> Never commit real secrets. `.env*` files are gitignored in this repository.

### 3) Run locally

```bash
npm run dev
```

Open http://localhost:3000.

## Available Scripts

From the repository root:

```bash
npm run dev    # start local dev server
npm run build  # production build
npm run start  # run production server after build
npm run lint   # run ESLint
```

## Build, Lint, Test, Deploy

- **Lint:** `npm run lint`
- **Build:** `npm run build`
- **Production start:** `npm run start`
- **Tests:** No test script is currently defined in `package.json`.
- **Deploy:** Standard Next.js deployment workflow (for example, build with `npm run build` and serve with `npm run start`, or deploy to a Next.js-compatible host).

## Project Structure

```text
.
├── app/
│   ├── api/                  # Route handlers (resume, ATS, reviewer, interview, tips, etc.)
│   ├── components/           # UI components/templates
│   ├── dashboard/            # Drag-and-drop application tracker
│   ├── interview/            # Mock interview UI
│   ├── interview-tips/       # AI roadmap UI
│   ├── login/ & signup/      # Auth pages
│   ├── my-resumes/           # Supabase-backed saved resumes view
│   ├── resume-builder/       # Main resume generation flow
│   ├── resume-reviewer/      # Resume review + rewrite flow
│   └── utils/                # Document helpers (DOCX generation)
├── lib/
│   └── supabase.ts           # Supabase client setup
├── package.json
└── README.md
```

## Typical Usage Workflow

1. **Sign up / log in** with Supabase auth.
2. Go to **Resume Builder** and either:
   - Fill in profile details manually, or
   - Upload a resume to auto-parse fields.
3. Generate a resume, review ATS indicators, then download/export.
4. Optionally generate a **cover letter** and **LinkedIn optimization** output.
5. Use **Resume Reviewer** for AI critique + rewritten resume text.
6. Practice in **Mock Interview** mode (text/voice/video).
7. Build a targeted prep plan in **Interview Tips**.
8. Track progress in **Dashboard** with drag-and-drop status updates.

## Troubleshooting

- **`Missing GROQ_API_KEY` / AI routes failing**
  - Ensure `GROQ_API_KEY` is set in `.env.local` and restart dev server.
- **Supabase auth/data errors**
  - Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` values.
  - Confirm your Supabase project/table policies allow expected operations.
- **File parse issues for uploaded resumes**
  - Prefer PDF/TXT inputs when extraction quality is poor.
- **Microphone/camera not working in interview mode**
  - Check browser permissions and use HTTPS/localhost-compatible browser settings.

## Contributing

Contributions are welcome. If you plan significant changes, open an issue first to discuss approach and scope.

## License

No license file is currently present in this repository. Add a `LICENSE` file if you want to define usage terms explicitly.
