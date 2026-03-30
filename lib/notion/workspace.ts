/**
 * Notion Workspace Module
 * Read workspace overview and structure
 */

import { MCPClient } from '@/lib/mcp/client';
import { WorkspaceOverview } from '@/lib/types';
import { searchWorkspace as searchWorkspaceFromTools } from '@/lib/mcp/tools';

export async function getWorkspaceOverview(client: MCPClient): Promise<WorkspaceOverview> {
  // TODO: Implement workspace overview reading
  // For now, return a placeholder
  return {
    name: 'My Workspace',
    databases: [],
    recentPages: [],
    users: [],
    totalPages: 0,
  };
}

export async function searchWorkspace(client: MCPClient, query: string): Promise<any[]> {
  // Delegate to tools
  const { results } = await searchWorkspaceFromTools(client, query);
  return results;
}
