# Notion Internship Agent - OAuth-Only MCP Integration

## Overview

This Next.js 15 + TypeScript application demonstrates **OAuth-only authentication** with the **Notion MCP Server** hosted at `https://mcp.notion.com/mcp`.

**Key Design:** No hardcoded tokens. Every user (web or Telegram) authenticates themselves via OAuth.

- Web users: Browser-based OAuth flow
- Telegram users: Click OAuth link in Telegram → authenticate in browser
- Each user gets their own access token stored temporarily
- MCP operations use user's own token (not shared, not hardcoded)

## Architecture

### Authentication Flow (No Hardcoded Tokens)

```
┌─────────────────────────────────────────────────────────────┐
│                   Next.js Application                       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         WEB DASHBOARD (Browser OAuth)               │   │
│  │                                                     │   │
│  │  1. User clicks "Login with Notion"               │   │
│  │  2. Browser redirected to Notion OAuth            │   │
│  │  3. User grants permission                        │   │
│  │  4. Notion redirects → /api/auth/callback         │   │
│  │  5. Exchange code for access token                │   │
│  │  6. Token stored in JWT session cookie            │   │
│  │  7. Access /dashboard                             │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │      TELEGRAM BOT (Click-to-Auth OAuth)            │   │
│  │                                                     │   │
│  │  1. User sends /login                             │   │
│  │  2. Bot generates OAuth URL (with user_id)        │   │
│  │  3. Bot sends clickable link in Telegram          │   │
│  │  4. User clicks → browser opens OAuth             │   │
│  │  5. User grants permission (same as web)          │   │
│  │  6. Notion redirects → /api/auth/telegram/callback│   │
│  │  7. Token associated with Telegram user_id        │   │
│  │  8. Stored in-memory (or Redis/DB)               │   │
│  │  9. User can now use /search, other commands      │   │
│  └────────────────────────────────────────────────────┘   │
│                                                             │
│           Both flows use SAME OAuth credentials            │
│        (NOTION_CLIENT_ID + NOTION_CLIENT_SECRET)          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                          │
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Notion OAuth Server                            │
│     https://www.notion.so/oauth/authorize                 │
│                                                             │
│  Uses PKCE (Proof Key for Code Exchange)                  │
│  - code_verifier (random 96 chars)                         │
│  - code_challenge = SHA256(code_verifier)                 │
│  - code_challenge_method = S256                           │
│  - Prevents authorization code interception              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│          Notion MCP Server                                 │
│     https://mcp.notion.com/mcp                            │
│                                                             │
│  Receives: Authorization: Bearer {user_access_token}      │
│                                                             │
│  18 Available Tools:                                       │
│  - notion-search                                          │
│  - notion-fetch                                           │
│  - notion-create-pages                                    │
│  - ... and 15 more                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│         User's Notion Workspace                            │
│                                                             │
│  - Profile Pages                                          │
│  - Internship Tracker Database (Auto-populated)           │
│  - Search Results                                         │
│                                                             │
│  (Accessed with user's own access token)                  │
└─────────────────────────────────────────────────────────────┘
```

## Authentication Routes

### Web OAuth: `/api/auth/login` → `/api/auth/callback`
```
GET /api/auth/login
├─ Generate PKCE (code_verifier + code_challenge)
├─ Store verifier in secure cookie
├─ Generate state (CSRF token)
├─ Store state in secure cookie
└─ Redirect to Notion OAuth → /api/auth/callback

GET /api/auth/callback?code=...&state=...
├─ Verify state (CSRF protection)
├─ Retrieve code_verifier from cookie
├─ Exchange code for access_token (with PKCE)
├─ Create JWT session (stores access_token)
└─ Redirect to /dashboard
```

### Telegram OAuth: Special Flow
```
/login command (in Telegram)
├─ Generate OAuth URL with Telegram user_id
├─ Send clickable link to user
│
User clicks link
├─ Browser opens OAuth (same Notion endpoint)
├─ User authorizes
└─ Redirected to /api/auth/telegram/callback?code=...&state=...&user_id=...

GET /api/auth/telegram/callback
├─ Verify state (CSRF protection)
├─ Retrieve code_verifier from cookie
├─ Exchange code for access_token (with PKCE)
├─ Extract user_id from state parameter
├─ Store session: Map<user_id → {access_token, profile, ...}>
└─ Return success JSON (user goes back to Telegram)
```

## Session Storage Strategies

### Web Dashboard
- **Storage**: HTTP-only JWT cookie
- **Accessible to**: Server-side only (Next.js API routes)
- **Content**: `{userId, notionToken, email, workspace, expiresAt}`
- **Security**: Signed with SESSION_SECRET

### Telegram Bot
- **Storage (MVP)**: In-memory Map<userId → TelegramSession>
- **Storage (Production)**: Redis or database
- **Accessible to**: Bot process only
- **Content**: `{notionToken, email, workspace, expiresAt, ...chatData}`
- **Security**: Tokens cleared on expiry or logout

## Key Features

### 1. OAuth 2.0 PKCE Flow

**Why PKCE?** Prevents authorization code interception attacks.

- Code Verifier: `randomBytes(72).toString('base64url')`
- Code Challenge: `base64url(sha256(verifier))`
- Exchanged during token request: server verifies code was issued for this app

**Token Lifecycle:**
- Access Token: 1 hour expiry
- Refresh Token: Automatic rotation (new token issued each refresh)
- Expired tokens: Stored sessions auto-clear

### 2. MCP Client (SDK-Based)

**Per-Request (Web):**
```typescript
const client = createMCPClient(session.notionToken);
const results = await client.callTool<SearchResults>('notion-search', { query });
```

**Singleton (Bot):**
```typescript
const botClient = getBotMCPClient(telegramUserId); // Retrieves user's token
const results = await botClient.callTool('notion-search', { query });
```

### 3. Typed MCP Tools

18 Notion MCP tools with TypeScript wrappers:
- `searchWorkspace(client, query)`
- `fetchPage(client, pageId)`
- `createPage(client, parentId, properties, content)`
- `queryDatabase(client, databaseId, filter, sorts)`
- ... and 14 more

### 4. LLM Integration

- **Ollama**: Fast local LLM (default)
- **Gemini**: Google AI fallback
- **Prompts**: Ranking (with rubric), extraction, cover letters

### 5. Job Scraping & Ranking

- **Scraping**: RemoteOK API (Internshala/LinkedIn placeholders)
- **Ranking**: LLM evaluates job fit against user profile
- **Scoring**: 1-100 scale (90+ exceptional, 35-54 poor, 1-34 skip)

## Environment Variables

```bash
# OAuth (shared by web and bot)
NOTION_CLIENT_ID=...
NOTION_CLIENT_SECRET=...
NOTION_REDIRECT_URI=http://localhost:3000/api/auth/callback
TELEGRAM_BOT_OAUTH_CALLBACK=http://localhost:3000/api/auth/telegram/callback

# Session
SESSION_SECRET=min-32-chars-here
NODE_ENV=development

# Telegram
TELEGRAM_BOT_TOKEN=...

# LLM
LLM_PROVIDER=ollama
OLLAMA_API_URL=http://localhost:11434/api/chat

# Scraping
MAX_RESULTS_PER_SOURCE=20
DRY_RUN=false
```

**NO HARDCODED TOKENS** ✅

## Implemented Components

### ✅ Complete
- MCP Client (SDK-based, HTTP/SSE fallback)
- OAuth PKCE flow (web)
- OAuth PKCE flow (Telegram)
- Auth routes: `/api/auth/login`, `/api/auth/callback`, `/api/auth/telegram/callback`
- LLM module: Ollama/Gemini dispatcher, ranking, extraction
- Job scraping: RemoteOK API
- Types: 30+ TypeScript interfaces
- Session management: Web (JWT), Telegram (in-memory)

### 🔧 In Progress
- Notion modules: profile, workspace, setup
- API routes: profile, jobs/search, jobs/list
- Dashboard UI: landing, dashboard, search pages
- Telegram bot: commands, handlers, intent router

## Development

### Install
```bash
npm install
```

### Configure
```bash
# Copy template
cp .env.local.example .env.local

# Fill in values:
# - NOTION_CLIENT_ID + NOTION_CLIENT_SECRET
# - SESSION_SECRET (generate with: openssl rand -base64 32)
# - TELEGRAM_BOT_TOKEN
```

### Run Web Server
```bash
npm run dev
# Open http://localhost:3000
# Click "Login with Notion"
```

### Run Telegram Bot
```bash
npm run bot:dev
# Send /login to bot
# Click OAuth link
# Use /search to find jobs
```

### Run Both
```bash
npm run dev:all
```

## Production Deployment

### Vercel (Web Only)
- Set env vars in dashboard
- Deploy via git push

### Self-Hosted (Web + Bot)
```bash
npm run build
npm run bot:build
npm start &          # Web
npm run bot:start &  # Bot
```

### Docker
Two services sharing same image, different entry points.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| OAuth redirect fails | Verify NOTION_REDIRECT_URI and TELEGRAM_BOT_OAUTH_CALLBACK match Notion app settings |
| "Unauthorized" on dashboard | Check SESSION_SECRET is configured |
| Telegram OAuth URL not working | Verify TELEGRAM_BOT_OAUTH_CALLBACK is accessible from public internet |
| Bot says "not authenticated" | User must click /login and complete OAuth first |
| MCP connection fails | Verify internet access to mcp.notion.com |
| Jobs not ranking | Check OLLAMA_API_URL is running or GEMINI_API_KEY is valid |

## Security

✅ **What's Secure:**
- No hardcoded Notion tokens
- OAuth tokens stored securely (JWT cookie for web, in-memory for bot)
- PKCE prevents code interception
- CSRF protection via state parameter
- HTTP-only cookies (can't be accessed by JavaScript)
- Sessions auto-expire

⚠️ **What to Harden for Production:**
- Store Telegram user tokens in Redis or database (not in-memory)
- Implement token refresh logic
- Rate limit OAuth callback endpoint
- Monitor for suspicious token usage
- Use HTTPS everywhere
- Implement proper session timeout handling

## Next Steps

1. Implement Notion modules (`lib/notion/profile.ts`, `setup.ts`)
2. Implement API routes (`app/api/profile`, `jobs/search`)
3. Build dashboard UI
4. Implement Telegram bot handlers
5. Test end-to-end auth + job pipeline
6. Deploy to production

---

**Created:** March 2026
**Project:** Notion Internship Agent v2.0
**Authentication:** OAuth 2.0 PKCE (no tokens hardcoded)
**MCP Server:** https://mcp.notion.com/mcp
