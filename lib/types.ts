/**
 * Core type definitions for the Notion Internship Agent
 */

// LLM and Job Types
export type LLMProvider = 'ollama' | 'gemini';

export interface JobListing {
  company: string;
  role: string;
  location: string;
  description: string;
  url: string;
  source: 'internshala' | 'linkedin' | 'remoteok';
  tags?: string[];
}

export interface RankedJob extends JobListing {
  priorityScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  whyFits: string;
  blocker?: string;
}

export interface SavedJob extends RankedJob {
  id: string;
  status: 'saved' | 'applied' | 'rejected' | 'pending';
  appliedAt?: Date;
}

// User Profile Types
export interface UserProfile {
  name: string;
  email?: string;
  location?: string;
  experienceLevel?: string;
  skills: string[];
  tools?: string[];
  experience: string;
  education: string[];
  projects: string[];
  certifications: string[];
  preferences: Record<string, unknown>;
  careerGoal: string;
  aboutMe: string;
}

// Session Types
export interface NotionSession {
  userId: string;
  notionToken: string;
  email: string;
  workspace: string;
  expiresAt: Date;
}

export interface TelegramSession {
  // OAuth token for Notion access
  notionToken: string;
  email?: string;
  workspace?: string;
  expiresAt: Date;

  // Chat session data
  lastResults: RankedJob[];
  lastQuery: string;
  lastLocation: string;
  trackerDatabaseId?: string;
  profilePageId?: string;

  // Workspace structure IDs (populated by ensureWorkspaceStructure)
  rootPageId?: string;
  aboutMePageId?: string;
  skillsPageId?: string;
  projectsPageId?: string;
  resumePageId?: string;
  preferencesPageId?: string;
}

// Notion Database Row Type
export interface InternshipTrackerRow {
  id?: string;
  Company: string;
  Role: string;
  'Apply URL': string;
  Location: string;
  Status: 'Discovered' | 'Applied' | 'Interviewing' | 'Rejected' | 'Offer';
  'Priority Score': number;
  'Matched Skills': string[];
  'Missing Skills': string[];
  'Why This Fits': string;
  'Blocker Reason'?: string;
  'Apply Timestamp'?: string;
  Source?: 'linkedin' | 'internshala' | 'remoteok';
  Applied?: boolean;
}

// OAuth Types
export interface OAuthState {
  codeVerifier: string;
  codeChallenge: string;
  state: string;
  redirectUri: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface OAuthServerMetadata {
  authorization_endpoint: string;
  token_endpoint: string;
  revocation_endpoint?: string;
  scopes_supported?: string[];
  response_types_supported?: string[];
}

// MCP Types
export interface MCPToolCall<T = Record<string, unknown>> {
  toolName: string;
  arguments: Record<string, unknown>;
  result?: T;
  error?: string;
}

export interface MCPToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    url?: string;
  }>;
  isError?: boolean;
}

export interface MCPRequestInit {
  headers?: Record<string, string>;
  timeout?: number;
}

// LLM Ranking Result
export interface RankingResult {
  priorityScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  whyFits: string;
  blocker?: string | null;
}

// Search Keywords Extraction
export interface SearchKeywords {
  keyword: string;
  location: string;
  reason: string;
}

// Notion Page/Block Types
export interface NotionPage {
  id: string;
  object: 'page';
  created_time: string;
  last_edited_time: string;
  created_by: { object: 'user'; id: string };
  last_edited_by: { object: 'user'; id: string };
  cover: unknown;
  icon: unknown;
  parent: { type: string; page_id?: string; database_id?: string };
  archived: boolean;
  properties: Record<string, unknown>;
  url: string;
  public_url: string | null;
}

export interface NotionDatabase {
  id: string;
  object: 'database';
  created_time: string;
  last_edited_time: string;
  created_by: { object: 'user'; id: string };
  last_edited_by: { object: 'user'; id: string };
  title: Array<{ type: 'text'; text: { content: string } }>;
  description: Array<{ type: 'text'; text: { content: string } }>;
  is_inline: boolean;
  parent: { type: string; page_id?: string };
  url: string;
  public_url: string | null;
  archived: boolean;
  properties: Record<string, NotionPropertyType>;
}

export interface NotionPropertyType {
  id: string;
  name: string;
  type: string;
  [key: string]: unknown;
}

// API Response Types
export interface ProfileResponse {
  profile: UserProfile;
  status: 'success' | 'error';
  message?: string;
}

export interface JobSearchResponse {
  jobs: RankedJob[];
  totalCount: number;
  savedCount: number;
  status: 'success' | 'error';
  message?: string;
}

export interface JobListResponse {
  jobs: SavedJob[];
  status: 'success' | 'error';
  message?: string;
}

// Search Progress Events (for SSE streaming)
export interface SearchProgressEvent {
  step: number;
  totalSteps: number;
  message: string;
  status: 'pending' | 'processing' | 'complete' | 'error';
  data?: Record<string, unknown>;
}

// Workspace Overview Type
export interface WorkspaceOverview {
  name: string;
  databases: Array<{ id: string; name: string; url?: string }>;
  recentPages: Array<{ id: string; title: string; url?: string }>;
  users: Array<{ id: string; name: string; email?: string }>;
  totalPages: number;
}
