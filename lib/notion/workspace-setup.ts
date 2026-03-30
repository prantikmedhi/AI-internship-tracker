/**
 * Auto-setup helpers for workspace structure, Internship Tracker DB, and Profile Pages
 *
 * Flow after login:
 *   1. Search for existing "AI Internship Agent" root page via notion-search
 *   2. If found → fetch its children via notion-get-block-children (fast, no indexing lag)
 *   3. Map existing child pages/databases by title
 *   4. Only create pages that are genuinely missing
 *   5. Never duplicate — always reuse existing UUIDs
 */

import { MCPClient } from '../mcp/client';
import { searchWorkspace } from '../mcp/tools';

/** Workspace structure IDs — all page and database IDs for the auto-created workspace */
export interface WorkspaceIds {
  rootPageId: string;
  aboutMePageId: string;
  skillsPageId: string;
  projectsPageId: string;
  resumePageId: string;
  preferencesPageId: string;
  trackerDatabaseId: string;
}

/** Internship Tracker database schema */
export const TRACKER_SCHEMA = {
  Role: { title: {} },
  Company: { rich_text: {} },
  Location: { rich_text: {} },
  'Apply URL': { url: {} },
  Source: {
    select: {
      options: [
        { name: 'LinkedIn', color: 'blue' },
        { name: 'Internshala', color: 'purple' },
        { name: 'RemoteOK', color: 'gray' },
        { name: 'Other', color: 'default' },
      ],
    },
  },
  Status: {
    select: {
      options: [
        { name: 'Discovered', color: 'yellow' },
        { name: 'Applied', color: 'blue' },
        { name: 'Interviewing', color: 'orange' },
        { name: 'Rejected', color: 'red' },
        { name: 'Offer', color: 'green' },
      ],
    },
  },
  'Date Added': { date: {} },
  Applied: { checkbox: {} },
  'Priority Score': { number: {} },
  'Matched Skills': { rich_text: {} },
  'Missing Skills': { rich_text: {} },
  'Why This Fits': { rich_text: {} },
  'Blocker Reason': { rich_text: {} },
  'Apply Timestamp': { date: {} },
};

/**
 * Fetch direct children of a page and return a map of title → id.
 * Uses notion-get-block-children which hits the Notion API directly — no search indexing delay.
 */
async function fetchChildMap(client: MCPClient, pageId: string): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const result = await client.callTool<{
      results?: Array<{
        id: string;
        type: string;
        child_page?: { title?: string };
        child_database?: { title?: string };
      }>;
    }>('notion-get-block-children', { block_id: pageId, page_size: 100 });

    for (const block of result?.results ?? []) {
      const title = block.child_page?.title || block.child_database?.title;
      if (title && block.id) {
        map.set(title.toLowerCase(), block.id);
        console.log(`[workspace] Found child: "${title}" (${block.id})`);
      }
    }
  } catch (err) {
    console.warn('[workspace] Could not fetch root page children:', err);
  }
  return map;
}

/**
 * Ensure the full workspace structure exists.
 *
 * Search-first strategy:
 *   - Searches for "AI Internship Agent" root page via MCP
 *   - If root found, discovers sub-pages by fetching its children directly (not via search)
 *   - Creates only what is missing
 *   - Reuses existing UUIDs — never duplicates
 */
export async function ensureWorkspaceStructure(
  client: MCPClient,
  options: {
    existingIds?: Partial<WorkspaceIds>;
    parentPageId?: string;
  } = {}
): Promise<WorkspaceIds | null> {
  const { existingIds, parentPageId } = options;

  try {
    // ── STEP 1: Find root page "AI Internship Agent" ──────────────────────────

    let rootPageId = existingIds?.rootPageId;

    if (!rootPageId) {
      // 1a. Search by name
      const { results } = await searchWorkspace(client, 'AI Internship Agent');
      const found = results.find(
        r => r.title?.toLowerCase().includes('internship agent') && r.type === 'page'
      );
      if (found?.id) {
        rootPageId = found.id;
        console.log(`[workspace] ✅ Found existing root page: "${found.title}" (${rootPageId})`);
      }
    }

    if (!rootPageId) {
      // 1b. Try finding root via "Internship Tracker" database parent
      const { results } = await searchWorkspace(client, 'Internship Tracker');
      const tracker = results.find(r =>
        r.title?.toLowerCase().includes('internship tracker') && r.type === 'database'
      );
      if (tracker?.id) {
        const details = await client.callTool<any>('notion-fetch', { id: tracker.id });
        if (details?.parent?.page_id) {
          rootPageId = details.parent.page_id;
          console.log(`[workspace] ✅ Found root via tracker parent: ${rootPageId}`);
        }
      }
    }

    if (!rootPageId) {
      // 1c. Create root page — find a parent to place it under
      let parentId = parentPageId;
      if (!parentId) {
        const { results } = await searchWorkspace(client, '', {
          sortBy: 'last_edited_time',
          pageSize: 20,
        });
        const candidate = results.find(r => r.type === 'page' && r.id);
        if (candidate?.id) parentId = candidate.id;
      }

      const createArgs: Record<string, any> = {
        properties: {
          title: { title: [{ type: 'text', text: { content: 'AI Internship Agent' } }] },
        },
        content: '# AI Internship Agent\nYour personalized internship tracking workspace.',
      };
      if (parentId) createArgs.parent = { page_id: parentId };

      const r = await client.callTool<{ id: string }>('notion-create-pages', createArgs);
      rootPageId = r?.id;
      console.log(`[workspace] ✅ Created root page: ${rootPageId}`);
    }

    if (!rootPageId) {
      console.error('[workspace] ❌ Could not find or create root page. Make sure a page is shared with the integration.');
      return null;
    }

    // ── STEP 2: Discover existing children of root page ───────────────────────
    // Fetch directly via blocks API — instant, no search indexing needed.

    const childMap = await fetchChildMap(client, rootPageId);

    // ── STEP 3: Helper to find or create a child page/database ────────────────

    const findOrCreatePage = async (
      existing: string | undefined,
      name: string,
      content: string
    ): Promise<string> => {
      // Priority 1: stored ID from session
      if (existing) {
        console.log(`[workspace] Using stored ID for "${name}": ${existing}`);
        return existing;
      }

      // Priority 2: found in direct children fetch
      const fromChildren = childMap.get(name.toLowerCase());
      if (fromChildren) {
        console.log(`[workspace] ✅ Reusing existing "${name}": ${fromChildren}`);
        return fromChildren;
      }

      // Priority 3: search as last resort (handles pages moved/renamed slightly)
      const { results } = await searchWorkspace(client, name);
      const found = results.find(
        r =>
          r.title?.toLowerCase() === name.toLowerCase() &&
          (r as any).parent?.page_id === rootPageId
      );
      if (found?.id) {
        console.log(`[workspace] ✅ Found "${name}" via search: ${found.id}`);
        return found.id;
      }

      // Priority 4: create
      console.log(`[workspace] Creating "${name}"...`);
      const r = await client.callTool<{ id: string }>('notion-create-pages', {
        parent: { page_id: rootPageId },
        properties: {
          title: { title: [{ type: 'text', text: { content: name } }] },
        },
        content,
      });
      console.log(`[workspace] ✅ Created "${name}": ${r?.id}`);
      return r?.id ?? '';
    };

    const findOrCreateDatabase = async (
      existing: string | undefined,
      name: string
    ): Promise<string> => {
      // Priority 1: stored ID from session
      if (existing) {
        console.log(`[workspace] Using stored ID for "${name}" db: ${existing}`);
        return existing;
      }

      // Priority 2: found in direct children fetch
      const fromChildren = childMap.get(name.toLowerCase());
      if (fromChildren) {
        console.log(`[workspace] ✅ Reusing existing "${name}" db: ${fromChildren}`);
        return fromChildren;
      }

      // Priority 3: search
      const { results } = await searchWorkspace(client, name);
      const found = results.find(
        r =>
          r.title?.toLowerCase() === name.toLowerCase() &&
          (r.type === 'database' || r.type === 'database' )
      );
      if (found?.id) {
        console.log(`[workspace] ✅ Found "${name}" db via search: ${found.id}`);
        return found.id;
      }

      // Priority 4: create
      console.log(`[workspace] Creating "${name}" database...`);
      const r = await client.callTool<{ id: string }>('notion-create-database', {
        parent: { page_id: rootPageId },
        title: [{ type: 'text', text: { content: name } }],
        properties: TRACKER_SCHEMA,
      });
      console.log(`[workspace] ✅ Created "${name}" db: ${r?.id}`);
      return r?.id ?? '';
    };

    // ── STEP 4: Ensure all sub-pages ─────────────────────────────────────────

    const [aboutMePageId, skillsPageId, projectsPageId, resumePageId, preferencesPageId] =
      await Promise.all([
        findOrCreatePage(
          existingIds?.aboutMePageId,
          'About Me',
          '## About Me\nAdd a short introduction about yourself here.'
        ),
        findOrCreatePage(
          existingIds?.skillsPageId,
          'Skills',
          '## Skills\nList your technical skills here.\n\nSkills: Python, TypeScript, React, SQL\nTools: Git, Docker, VS Code'
        ),
        findOrCreatePage(
          existingIds?.projectsPageId,
          'Projects',
          '## Projects\nDescribe your notable projects here.'
        ),
        findOrCreatePage(
          existingIds?.resumePageId,
          'Resume',
          '## Resume\nPaste your resume or describe your work experience here.'
        ),
        findOrCreatePage(
          existingIds?.preferencesPageId,
          'Preferences',
          '## Preferences\nSet your job preferences below.\n\nPreferred Location: Remote\nPreferred Role: Software Engineer Intern\nExperience Level: beginner'
        ),
      ]);

    // ── STEP 5: Ensure Internship Tracker database ────────────────────────────

    const trackerDatabaseId = await findOrCreateDatabase(
      existingIds?.trackerDatabaseId,
      'Internship Tracker'
    );

    return {
      rootPageId,
      aboutMePageId,
      skillsPageId,
      projectsPageId,
      resumePageId,
      preferencesPageId,
      trackerDatabaseId,
    };
  } catch (error) {
    console.error('[workspace] Critical error in ensureWorkspaceStructure:', error);
    return null;
  }
}

/** Legacy fallbacks — kept for backward compatibility */
export async function ensureInternshipTracker(client: MCPClient): Promise<string | null> {
  const ids = await ensureWorkspaceStructure(client);
  return ids?.trackerDatabaseId || null;
}

export async function ensureProfilePage(client: MCPClient): Promise<string | null> {
  const ids = await ensureWorkspaceStructure(client);
  return ids?.rootPageId || null;
}
