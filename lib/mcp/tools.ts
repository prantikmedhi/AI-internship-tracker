/**
 * Typed wrappers for Notion MCP tools
 * Maps to the 18 tools available on https://mcp.notion.com/mcp
 */

import { MCPClient } from './client';
import { NotionPage, NotionDatabase } from '@/lib/types';

/**
 * Search the Notion workspace (full-text search across pages, databases, and connected sources)
 */
export async function searchWorkspace(
  client: MCPClient,
  query: string,
  options: {
    sortBy?: 'relevance' | 'last_edited_time';
    filter?: { property: 'object'; value: 'page' | 'database' };
    pageSize?: number;
    startCursor?: string;
    connectedSources?: boolean;
  } = {}
): Promise<{
  results: Array<{ title?: string; url?: string; type?: string; id?: string; [key: string]: unknown }>;
  nextCursor?: string | null;
  hasMore?: boolean;
}> {
  const { sortBy, filter, pageSize, startCursor, connectedSources } = options;
  
  const result = await client.callTool<{
    results?: Array<{ title?: string; url?: string; id?: string; type?: string; [key: string]: unknown }>;
    next_cursor?: string | null;
    has_more?: boolean;
  }>(
    'notion-search',
    {
      query,
      sort: sortBy === 'last_edited_time' ? { direction: 'descending', timestamp: 'last_edited_time' } : undefined,
      ...(filter && { filter }),
      ...(pageSize && { page_size: pageSize }),
      ...(startCursor && { start_cursor: startCursor }),
      ...(connectedSources !== undefined && { connected_sources: connectedSources }),
    }
  );

  return {
    results: result.results || [],
    nextCursor: result.next_cursor || null,
    hasMore: result.has_more || false,
  };
}

/**
 * Query multiple data sources for structured results (requires Notion AI + Enterprise)
 */
export async function queryDataSources(
  client: MCPClient,
  query: string,
  options: {
    dataSourceIds?: string[];
    pageSize?: number;
  } = {}
): Promise<{ results: Array<Record<string, unknown>> }> {
  try {
    const result = await client.callTool<{ results?: Array<Record<string, unknown>> }>(
      'notion-query-data-sources',
      {
        query,
        ...(options.dataSourceIds && { data_source_ids: options.dataSourceIds }),
        ...(options.pageSize && { page_size: options.pageSize }),
      }
    );
    return { results: result.results || [] };
  } catch (error) {
    console.error('Failed to query data sources:', error);
    return { results: [] };
  }
}

/**
 * Fetch a page or database by ID or URL
 */
export async function fetchPage(
  client: MCPClient,
  pageId: string
): Promise<NotionPage | NotionDatabase | null> {
  try {
    const result = await client.callTool<NotionPage | NotionDatabase>(
      'notion-fetch',
      { id: pageId }
    );
    return result;
  } catch (error) {
    console.error(`Failed to fetch page ${pageId}:`, error);
    return null;
  }
}

/**
 * Create a new page with content
 */
export async function createPage(
  client: MCPClient,
  parentId: string,
  properties: Record<string, unknown>,
  content?: string,
  icon?: string,
  cover?: string
): Promise<{ id: string; url?: string } | null> {
  try {
    const result = await client.callTool<{ id: string; url?: string }>(
      'notion-create-pages',
      {
        parent: { page_id: parentId },
        properties,
        ...(content && { content }),
        ...(icon && { icon }),
        ...(cover && { cover }),
      }
    );
    return result;
  } catch (error) {
    console.error('Failed to create page:', error);
    return null;
  }
}

/**
 * Update a page's properties or content
 */
export async function updatePage(
  client: MCPClient,
  pageId: string,
  properties?: Record<string, unknown>,
  content?: string,
  archived?: boolean
): Promise<boolean> {
  try {
    await client.callTool('notion-update-page', {
      page_id: pageId,
      ...(properties && { properties }),
      ...(content && { content }),
      ...(archived !== undefined && { archived }),
    });
    return true;
  } catch (error) {
    console.error(`Failed to update page ${pageId}:`, error);
    return false;
  }
}

/**
 * Move pages or databases to a new parent
 */
export async function movePages(
  client: MCPClient,
  pageIds: string[],
  newParentId: string
): Promise<boolean> {
  try {
    await client.callTool('notion-move-pages', {
      page_ids: pageIds,
      new_parent: { page_id: newParentId },
    });
    return true;
  } catch (error) {
    console.error('Failed to move pages:', error);
    return false;
  }
}

/**
 * Duplicate a page asynchronously
 */
export async function duplicatePage(
  client: MCPClient,
  pageId: string
): Promise<{ jobId?: string } | null> {
  try {
    const result = await client.callTool<{ jobId?: string }>(
      'notion-duplicate-page',
      { page_id: pageId }
    );
    return result;
  } catch (error) {
    console.error(`Failed to duplicate page ${pageId}:`, error);
    return null;
  }
}

/**
 * Create a new database
 */
export async function createDatabase(
  client: MCPClient,
  parentId: string,
  title: string,
  schema: Record<string, unknown>
): Promise<{ id: string } | null> {
  try {
    const result = await client.callTool<{ id: string }>(
      'notion-create-database',
      {
        parent: { page_id: parentId },
        title: [{ type: 'text', text: { content: title } }],
        properties: schema,
      }
    );
    return result;
  } catch (error) {
    console.error('Failed to create database:', error);
    return null;
  }
}

/**
 * Update a data source (database properties, name, description)
 */
export async function updateDataSource(
  client: MCPClient,
  dataSourceId: string,
  updates: { title?: string; description?: string; properties?: Record<string, unknown> }
): Promise<boolean> {
  try {
    await client.callTool('notion-update-data-source', {
      id: dataSourceId,
      ...updates,
    });
    return true;
  } catch (error) {
    console.error(`Failed to update data source ${dataSourceId}:`, error);
    return false;
  }
}

/**
 * Create a view on a database
 */
export async function createView(
  client: MCPClient,
  dataSourceId: string,
  name: string,
  type: 'table' | 'board' | 'list' | 'calendar' | 'timeline' | 'gallery' | 'form',
  config?: string
): Promise<{ id: string } | null> {
  try {
    const result = await client.callTool<{ id: string }>(
      'notion-create-view',
      {
        data_source_id: dataSourceId,
        name,
        type,
        ...(config && { configure: config }),
      }
    );
    return result;
  } catch (error) {
    console.error('Failed to create view:', error);
    return null;
  }
}

/**
 * Update a view's configuration
 */
export async function updateView(
  client: MCPClient,
  viewId: string,
  updates: { name?: string; configure?: string }
): Promise<boolean> {
  try {
    await client.callTool('notion-update-view', {
      id: viewId,
      ...updates,
    });
    return true;
  } catch (error) {
    console.error(`Failed to update view ${viewId}:`, error);
    return false;
  }
}

/**
 * Query a database or data source
 */
export async function queryDatabase(
  client: MCPClient,
  databaseId: string,
  filter?: Record<string, unknown>,
  sorts?: Array<{ property: string; direction: 'ascending' | 'descending' }>
): Promise<{ results?: Array<{ id: string; properties: Record<string, unknown> }> }> {
  try {
    const result = await client.callTool<{ results?: Array<{ id: string; properties: Record<string, unknown> }> }>(
      'notion-query-database',
      {
        database_id: databaseId,
        ...(filter && { filter }),
        ...(sorts && { sorts }),
      }
    );
    return result as { results?: Array<{ id: string; properties: Record<string, unknown> }> };
  } catch (error) {
    console.error(`Failed to query database ${databaseId}:`, error);
    return { results: [] };
  }
}

/**
 * Get block children (page blocks)
 */
export async function getBlockChildren(
  client: MCPClient,
  blockId: string
): Promise<{ results: Array<{ id: string; type: string }>; text: string }> {
  try {
    const result = await client.callTool<{ results?: Array<{ id: string; type: string }>; text?: string }>(
      'notion-get-block-children',
      { block_id: blockId, page_size: 100 }
    );
    return {
      results: result.results || [],
      text: result.text || '',
    };
  } catch (error) {
    console.error(`Failed to get block children for ${blockId}:`, error);
    return { results: [], text: '' };
  }
}

/**
 * Add a comment to a page or block
 */
export async function addComment(
  client: MCPClient,
  pageId: string,
  text: string,
  blockId?: string
): Promise<boolean> {
  try {
    await client.callTool('notion-create-comment', {
      page_id: pageId,
      rich_text: [{ type: 'text', text: { content: text } }],
      ...(blockId && { block_id: blockId }),
    });
    return true;
  } catch (error) {
    console.error('Failed to add comment:', error);
    return false;
  }
}

/**
 * Get comments on a page
 */
export async function getComments(
  client: MCPClient,
  pageId: string
): Promise<Array<{ id: string; text: string; createdBy?: string; createdTime?: string }>> {
  try {
    const result = await client.callTool<{
      results?: Array<{ id: string; text: string; createdBy?: string; createdTime?: string }>;
    }>('notion-get-comments', {
      page_id: pageId,
    });
    return result.results || [];
  } catch (error) {
    console.error(`Failed to get comments for ${pageId}:`, error);
    return [];
  }
}

/**
 * Get all users in the workspace
 */
export async function getUsers(
  client: MCPClient
): Promise<Array<{ id: string; name: string; email?: string; type: string }>> {
  try {
    const result = await client.callTool<{
      results?: Array<{ id: string; name: string; email?: string; type: string }>;
    }>('notion-get-users', {});
    return result.results || [];
  } catch (error) {
    console.error('Failed to get users:', error);
    return [];
  }
}

/**
 * Get the current user's information
 */
export async function getCurrentUser(
  client: MCPClient
): Promise<{ id: string; email?: string; name?: string } | null> {
  try {
    const result = await client.callTool<{ id: string; email?: string; name?: string }>(
      'notion-get-self',
      {}
    );
    return result;
  } catch (error) {
    console.error('Failed to get current user:', error);
    return null;
  }
}

/**
 * Get all teams in the workspace
 */
export async function getTeams(
  client: MCPClient
): Promise<Array<{ id: string; name: string; type: string }>> {
  try {
    const result = await client.callTool<{
      results?: Array<{ id: string; name: string; type: string }>;
    }>('notion-get-teams', {});
    return result.results || [];
  } catch (error) {
    console.error('Failed to get teams:', error);
    return [];
  }
}
