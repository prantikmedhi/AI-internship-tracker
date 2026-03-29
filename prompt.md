# Notion AI Internship Agent - Next.js + TypeScript

**Modern web app built with Next.js 14+, TypeScript, and OAuth. Ranks internships using LLM and saves to Notion.**

## Overview

A full-stack Next.js application that:
- Authenticates users via **OAuth to Notion** (no API keys)
- Reads user profile data from their Notion workspace
- Scrapes internship listings from LinkedIn, Internshala, RemoteOK
- Ranks jobs using LLM (Ollama/Gemini) via MCP server
- Saves ranked results back to user's Notion workspace
- Real-time job search UI with progress tracking

**Tech Stack**: Next.js 14 | TypeScript | TailwindCSS | Notion OAuth | Hosted MCP Server

## Prerequisites

- Node.js 18+ & npm/yarn/pnpm
- A Notion integration app (OAuth)
- Hosted Notion MCP server (or local for development)

## Project Structure

```
notion-internship-agent/
├── app/                          # Next.js app directory
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login.ts         # Initiate OAuth flow
│   │   │   ├── callback.ts      # OAuth callback handler
│   │   │   └── logout.ts        # Clear session
│   │   ├── jobs/
│   │   │   ├── search.ts        # Search + rank jobs
│   │   │   └── list.ts          # Fetch user's saved jobs
│   │   ├── profile.ts           # Read user profile from Notion
│   │   └── notion/
│   │       └── [tool].ts        # MCP tool proxying
│   ├── dashboard/               # User dashboard
│   │   └── page.tsx
│   ├── search/                  # Job search page
│   │   └── page.tsx
│   ├── layout.tsx               # Root layout
│   └── page.tsx                 # Landing page
├── components/                  # React components
│   ├── SearchForm.tsx
│   ├── JobCard.tsx
│   ├── RankingDisplay.tsx
│   └── AuthButton.tsx
├── lib/                         # Shared utilities
│   ├── mcp/
│   │   ├── client.ts           # MCP JSON-RPC client
│   │   └── tools.ts            # MCP tool wrappers
│   ├── llm/
│   │   ├── client.ts           # Ollama/Gemini dispatcher
│   │   ├── ranking.ts          # Job ranking logic
│   │   └── prompt.ts           # LLM prompts
│   ├── jobs/
│   │   ├── scraper.ts          # Internshala, LinkedIn, RemoteOK
│   │   └── normalize.ts        # Standardize job schema
│   ├── notion/
│   │   ├── oauth.ts            # Notion OAuth helpers
│   │   ├── profile.ts          # Read user profile
│   │   └── writer.ts           # Write jobs to Notion
│   ├── auth.ts                 # Session management
│   └── types.ts                # TypeScript types
├── middleware.ts               # Auth middleware
├── .env.local                  # Environment variables
├── tsconfig.json               # TypeScript config
├── next.config.ts              # Next.js config
├── tailwind.config.ts          # TailwindCSS config
└── package.json                # Dependencies
```

## Setup

### 1. Create Notion Integration (OAuth)

1. Go to [Notion Integrations Dashboard](https://www.notion.so/my-integrations)
2. Click **New integration**
3. Fill in:
   - **Name**: "AI Internship Agent"
   - **Workspace**: Select your workspace
4. In **OAuth domain & URIs**:
   - Redirect URL: `http://localhost:3000/api/auth/callback`
   - Copy **Client ID** and **Client Secret**

5. Grant capabilities:
   - ✓ Read content
   - ✓ Create/Update content
   - ✓ Insert content

### 2. Clone & Setup Project

```bash
# Create Next.js project with TypeScript
npx create-next-app@latest notion-internship-agent \
  --typescript \
  --tailwind \
  --app \
  --eslint

cd notion-internship-agent

# Install dependencies
npm install \
  axios \
  next-auth \
  jose \
  cheerio \
  playwright \
  zod

# Optional: Prisma for session storage
npm install @prisma/client
npx prisma init
```

### 3. Environment Setup

Create `.env.local`:

```bash
# ──── Notion OAuth ────
NOTION_CLIENT_ID=your_client_id_here
NOTION_CLIENT_SECRET=your_client_secret_here
NOTION_REDIRECT_URI=http://localhost:3000/api/auth/callback
NOTION_BASE_URL=https://api.notion.com/v1

# ──── Session ────
SESSION_SECRET=your_random_secret_here_min_32_chars
SESSION_MAX_AGE=86400  # 24 hours

# ──── MCP Server (Hosted Notion MCP) ────
NEXT_PUBLIC_MCP_SERVER_URL=http://localhost:3000/api/mcp
MCP_SERVER_BASE_URL=http://localhost:3000
MCP_SESSION_TIMEOUT=3600

# ──── LLM Provider ────
LLM_PROVIDER=ollama  # "ollama" or "gemini"
OLLAMA_API_URL=http://localhost:11434/api/chat
OLLAMA_MODEL=qwen2.5:3b
OLLAMA_TIMEOUT_FAST=60000
OLLAMA_TIMEOUT_SLOW=120000

# ──── Gemini (Optional) ────
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash

# ──── Job Scraping ────
DRY_RUN=false
MAX_RESULTS_PER_SOURCE=20
```

### 4. Key Files Setup

**`lib/types.ts` - Type Definitions**
```typescript
export interface Job {
  company: string;
  role: string;
  location: string;
  description: string;
  url: string;
  source: "linkedin" | "internshala" | "remoteok";
}

export interface RankedJob extends Job {
  priorityScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  whyFits: string;
  blocker?: string;
}

export interface UserProfile {
  name: string;
  skills: string[];
  experience: string;
  preferences: Record<string, unknown>;
  careerGoal: string;
}

export interface Session {
  userId: string;
  notionToken: string;
  email: string;
  workspace: string;
  expiresAt: Date;
}

export interface MCPRequest {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
  id?: string | number;
}

export interface MCPResponse {
  jsonrpc: "2.0";
  result?: {
    content?: Array<{ type: string; text: string }>;
  };
  error?: {
    code: number;
    message: string;
  };
  id?: string | number;
}
```

**`lib/auth.ts` - Session Management**
```typescript
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET || "default-secret-min-32-characters-long"
);

export async function createSession(data: {
  userId: string;
  notionToken: string;
  email: string;
  workspace: string;
}) {
  const token = await new SignJWT(data)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(Date.now() + 24 * 60 * 60 * 1000)
    .sign(secret);

  const cookieStore = await cookies();
  cookieStore.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 24 * 60 * 60,
  });

  return token;
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;

  if (!token) return null;

  try {
    const verified = await jwtVerify(token, secret);
    return verified.payload;
  } catch {
    return null;
  }
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
}
```

**`lib/mcp/client.ts` - MCP JSON-RPC Client**
```typescript
import axios, { AxiosInstance } from "axios";
import type { MCPRequest, MCPResponse } from "@/lib/types";

export class MCPClient {
  private client: AxiosInstance;
  private sessionId: string;

  constructor(serverUrl: string, sessionId: string) {
    this.sessionId = sessionId;
    this.client = axios.create({
      baseURL: serverUrl,
      headers: {
        "Content-Type": "application/json",
        "mcp-session-id": sessionId,
      },
    });
  }

  async call(toolName: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const payload: MCPRequest = {
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: toolName, arguments: params },
      id: Math.random().toString(36).slice(2),
    };

    try {
      const response = await this.client.post<MCPResponse>("", payload);
      const result = response.data.result?.content?.[0];

      if (result?.type === "text") {
        try {
          return JSON.parse(result.text);
        } catch {
          return { text: result.text };
        }
      }

      return response.data.result || {};
    } catch (error) {
      console.error(`MCP error calling ${toolName}:`, error);
      return {};
    }
  }
}
```

**`lib/llm/client.ts` - LLM Dispatcher**
```typescript
import axios from "axios";

export async function callLLM(prompt: string): Promise<string> {
  const provider = process.env.LLM_PROVIDER || "ollama";

  if (provider === "gemini" && process.env.GEMINI_API_KEY) {
    return callGemini(prompt);
  }

  return callOllama(prompt);
}

async function callOllama(prompt: string): Promise<string> {
  try {
    const response = await axios.post(
      process.env.OLLAMA_API_URL || "http://localhost:11434/api/chat",
      {
        model: process.env.OLLAMA_MODEL || "qwen2.5:3b",
        messages: [{ role: "user", content: prompt }],
        stream: false,
      },
      { timeout: parseInt(process.env.OLLAMA_TIMEOUT_SLOW || "120000") }
    );

    return response.data.message?.content || "";
  } catch (error) {
    console.error("Ollama error:", error);
    return "";
  }
}

async function callGemini(prompt: string): Promise<string> {
  try {
    const response = await axios.post(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
      {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
      },
      {
        headers: {
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
      }
    );

    return response.data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } catch (error) {
    console.error("Gemini error:", error);
    return "";
  }
}
```

**`lib/jobs/scraper.ts` - Job Scraping**
```typescript
import axios from "axios";
import * as cheerio from "cheerio";
import type { Job } from "@/lib/types";

export async function scrapeInternshala(query: string, location: string): Promise<Job[]> {
  try {
    const response = await axios.get(
      `https://internshala.com/internships/search/?query=${encodeURIComponent(query)}&city=${encodeURIComponent(location)}`
    );

    const $ = cheerio.load(response.data);
    const jobs: Job[] = [];

    $(".internship_card").each((_, el) => {
      const company = $(el).find(".company_name").text().trim();
      const role = $(el).find(".job_heading").text().trim();
      const location = $(el).find(".location_link").text().trim();
      const description = $(el).find(".internship_description").text().trim();
      const url = $(el).find("a").attr("href") || "";

      if (company && role) {
        jobs.push({
          company,
          role,
          location,
          description,
          url,
          source: "internshala",
        });
      }
    });

    return jobs.slice(0, parseInt(process.env.MAX_RESULTS_PER_SOURCE || "20"));
  } catch (error) {
    console.error("Internshala scrape error:", error);
    return [];
  }
}

export async function scrapeLinkedIn(query: string, location: string): Promise<Job[]> {
  // LinkedIn scraping requires Playwright due to JS rendering
  // Implement with Playwright headless browser
  console.log("LinkedIn scraping - requires Playwright implementation");
  return [];
}

export async function scrapeRemoteOK(query: string): Promise<Job[]> {
  try {
    const response = await axios.get(
      `https://remoteok.io/api?tag=${encodeURIComponent(query)}`
    );

    return response.data
      .filter((job: Record<string, unknown>) => job.length > 3) // Skip metadata
      .map((job: Record<string, unknown>) => ({
        company: (job.company as string) || "Unknown",
        role: (job.title as string) || "Unknown",
        location: "Remote",
        description: (job.description as string) || "",
        url: (job.url as string) || "",
        source: "remoteok" as const,
      }))
      .slice(0, parseInt(process.env.MAX_RESULTS_PER_SOURCE || "20"));
  } catch (error) {
    console.error("RemoteOK scrape error:", error);
    return [];
  }
}
```

**`lib/llm/ranking.ts` - Job Ranking**
```typescript
import { callLLM } from "./client";
import type { Job, RankedJob, UserProfile } from "@/lib/types";

const RANKING_PROMPT = `
You are a job matching expert. Rank the following job against the user's profile.

User Profile:
- Skills: {skills}
- Experience: {experience}
- Career Goal: {careerGoal}

Job:
- Company: {company}
- Role: {role}
- Location: {location}
- Description: {description}

Provide a JSON response with:
{
  "priorityScore": <1-100>,
  "matchedSkills": [<array of matched skills>],
  "missingSkills": [<array of missing skills>],
  "whyFits": "<2-3 sentence explanation>",
  "blocker": "<if any blocker exists, describe it; null otherwise>"
}

Scoring rubric:
- 90-100: Exceptional match (exact role, 80%+ skills, known company)
- 75-89: Good match (relevant role, 50-70% skills)
- 55-74: Average (partial overlap, 30-50% skills)
- 35-54: Poor (significant gaps, <30% skills)
- 1-34: Skip (completely irrelevant)
`;

export async function rankJob(
  job: Job,
  profile: UserProfile
): Promise<RankedJob | null> {
  const prompt = RANKING_PROMPT.replace("{skills}", profile.skills.join(", "))
    .replace("{experience}", profile.experience)
    .replace("{careerGoal}", profile.careerGoal)
    .replace("{company}", job.company)
    .replace("{role}", job.role)
    .replace("{location}", job.location)
    .replace("{description}", job.description.slice(0, 500));

  const response = await callLLM(prompt);

  try {
    const result = JSON.parse(response);
    return {
      ...job,
      priorityScore: result.priorityScore || 50,
      matchedSkills: result.matchedSkills || [],
      missingSkills: result.missingSkills || [],
      whyFits: result.whyFits || "No explanation available",
      blocker: result.blocker || undefined,
    };
  } catch {
    console.error("Failed to parse ranking response:", response);
    return null;
  }
}

export async function rankJobs(jobs: Job[], profile: UserProfile): Promise<RankedJob[]> {
  const ranked = await Promise.all(
    jobs.map((job) => rankJob(job, profile))
  );

  return ranked
    .filter((job): job is RankedJob => job !== null)
    .sort((a, b) => b.priorityScore - a.priorityScore);
}
```

### 5. API Routes Setup

**`app/api/auth/login.ts` - Initiate OAuth**
```typescript
import { redirect } from "next/navigation";

export async function GET() {
  const clientId = process.env.NOTION_CLIENT_ID;
  const redirectUri = process.env.NOTION_REDIRECT_URI;

  const authUrl = new URL("https://api.notion.com/v1/oauth/authorize");
  authUrl.searchParams.append("client_id", clientId || "");
  authUrl.searchParams.append("redirect_uri", redirectUri || "");
  authUrl.searchParams.append("response_type", "code");
  authUrl.searchParams.append("owner", "user");

  redirect(authUrl.toString());
}
```

**`app/api/auth/callback.ts` - OAuth Callback**
```typescript
import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { createSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json(
      { error: "Missing authorization code" },
      { status: 400 }
    );
  }

  try {
    // Exchange code for access token
    const response = await axios.post(
      "https://api.notion.com/v1/oauth/token",
      {
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.NOTION_REDIRECT_URI,
      },
      {
        auth: {
          username: process.env.NOTION_CLIENT_ID || "",
          password: process.env.NOTION_CLIENT_SECRET || "",
        },
      }
    );

    const { access_token, workspace_id, workspace_name, owner } = response.data;

    // Get user info
    const userResponse = await axios.get("https://api.notion.com/v1/users/me", {
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Notion-Version": "2022-06-28",
      },
    });

    // Create session with access token
    await createSession({
      userId: userResponse.data.id,
      notionToken: access_token,
      email: owner.email || userResponse.data.id,
      workspace: workspace_name,
    });

    return NextResponse.redirect(new URL("/dashboard", request.url));
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 }
    );
  }
}
```

**`app/api/jobs/search.ts` - Search & Rank Jobs**
```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { scrapeInternshala, scrapeRemoteOK } from "@/lib/jobs/scraper";
import { rankJobs } from "@/lib/llm/ranking";
import { getUserProfile } from "@/lib/notion/profile";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { query, location } = await request.json();

  try {
    // Read user profile from Notion
    const profile = await getUserProfile(session.notionToken);

    // Scrape jobs from multiple sources
    const [internshalaJobs, remoteokJobs] = await Promise.all([
      scrapeInternshala(query, location),
      scrapeRemoteOK(query),
    ]);

    const allJobs = [...internshalaJobs, ...remoteokJobs];

    // Rank jobs using LLM
    const rankedJobs = await rankJobs(allJobs, profile);

    return NextResponse.json({ jobs: rankedJobs });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}
```

### 6. Deploy

**Development:**
```bash
npm run dev
# Open http://localhost:3000
```

**Production (Vercel):**
```bash
npm install -g vercel
vercel
# Set environment variables in Vercel dashboard
```

**Production (Self-hosted):**
```bash
npm run build
npm start
```

---

## OAuth Flow Diagram

```
User → "Login with Notion" button
  ↓
GET /api/auth/login
  ↓
Redirects to: https://api.notion.com/v1/oauth/authorize?client_id=...&redirect_uri=...
  ↓
User grants permission at Notion
  ↓
Notion redirects back: http://localhost:3000/api/auth/callback?code=...
  ↓
POST /api/auth/callback (exchange code for access token)
  ↓
Server creates secure session with access token
  ↓
Redirect to /dashboard
  ↓
User logged in ✓
```

---

## Job Search Data Flow

```
1. User enters: "python internship" in "India"
   ↓
2. POST /api/jobs/search { query, location }
   ↓
3. Server:
   a) Get user session + Notion token
   b) Read profile: getUserProfile(token)
      - Queries Notion workspace for Skills, Experience, Preferences
   c) Scrape jobs:
      - scrapeInternshala(query, location) → [Job]
      - scrapeRemoteOK(query) → [Job]
   d) Rank jobs:
      - rankJobs(jobs, profile) → [RankedJob] sorted by score
   e) Return ranked results
   ↓
4. Client renders JobCard components with scores
```

---

## File Checklist

- [ ] `.env.local` with Notion OAuth credentials
- [ ] `lib/types.ts` - Type definitions
- [ ] `lib/auth.ts` - Session management
- [ ] `lib/mcp/client.ts` - MCP client (if using hosted MCP)
- [ ] `lib/llm/client.ts` - LLM dispatcher
- [ ] `lib/llm/ranking.ts` - Job ranking
- [ ] `lib/jobs/scraper.ts` - Job scrapers
- [ ] `lib/notion/profile.ts` - Profile reader
- [ ] `app/api/auth/login.ts` - OAuth login
- [ ] `app/api/auth/callback.ts` - OAuth callback
- [ ] `app/api/jobs/search.ts` - Job search endpoint
- [ ] `app/dashboard/page.tsx` - Dashboard UI
- [ ] `app/search/page.tsx` - Search UI
- [ ] Tailwind components

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| OAuth redirect fails | Verify `NOTION_REDIRECT_URI` matches exactly in both `.env.local` and Notion integration settings |
| Session not persisting | Check `SESSION_SECRET` is set and ≥32 chars; verify cookies enabled |
| Jobs not ranking | Check `OLLAMA_API_URL` is running; verify LLM provider selected in `.env.local` |
| Notion profile read fails | Verify Notion integration has "Read content" capability; check access token valid |
| Scraping returns 0 results | Website HTML may have changed; update selectors in `scraper.ts` |

---

## Next Steps

1. Create Notion integration (get Client ID/Secret)
2. Run `npm install` and setup `.env.local`
3. Start dev server: `npm run dev`
4. Click "Login with Notion"
5. Try a job search
6. Verify jobs appear in dashboard

Ready to start?
