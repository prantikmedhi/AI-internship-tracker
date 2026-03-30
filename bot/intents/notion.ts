/**
 * Notion Query Intent
 * Handles searches within Notion workspace
 */

import { BotContext } from '../session';
import { MCPClient } from '../../lib/mcp/client';
import { TelegramSession } from '../../lib/types';
import { searchWorkspace, fetchPage } from '../../lib/mcp/tools';
import { getWorkspaceOverview } from '../../lib/notion/workspace';

const NOTION_KEYWORDS = ['search', 'read', 'show', 'find', 'workspace', 'pages', 'database'];

export function isNotionQuery(text: string): boolean {
  return (
    NOTION_KEYWORDS.some((keyword) => text.includes(keyword)) &&
    !text.includes('internship') &&
    !text.includes('job')
  );
}

export async function handleNotionQuery(
  ctx: BotContext,
  client: MCPClient,
  text: string,
  session: TelegramSession
): Promise<void> {
  try {
    const chatId = ctx.chat?.id;
    if (!chatId) {
      await ctx.reply('Error: Could not identify chat');
      return;
    }

    // Check if asking for workspace overview
    if (text.includes('workspace') || text.includes('overview')) {
      let statusMsg = await ctx.reply('📊 Loading workspace overview...');

      const overview = await getWorkspaceOverview(client);

      let content = `📊 **Workspace Overview**\n\n`;
      content += `**Databases:** ${overview.databases.length}\n`;
      overview.databases.slice(0, 5).forEach((db) => {
        content += `  • ${db.name}\n`;
      });
      if (overview.databases.length > 5) {
        content += `  ... and ${overview.databases.length - 5} more\n`;
      }

      content += `\n**Recent Pages:** ${overview.recentPages.length}\n`;
      overview.recentPages.slice(0, 3).forEach((page) => {
        content += `  • ${page.title}\n`;
      });

      await ctx.api.editMessageText(chatId, statusMsg.message_id, content, {
        parse_mode: 'Markdown',
      });
      return;
    }

    // Otherwise, perform a search
    // Extract search terms (everything after "search" or "find")
    let searchQuery = text;
    const searchIdx = text.indexOf('search');
    const findIdx = text.indexOf('find');
    const readIdx = text.indexOf('read');

    if (searchIdx !== -1) {
      searchQuery = text.substring(searchIdx + 6).trim();
    } else if (findIdx !== -1) {
      searchQuery = text.substring(findIdx + 4).trim();
    } else if (readIdx !== -1) {
      searchQuery = text.substring(readIdx + 4).trim();
    }

    if (!searchQuery || searchQuery.length < 2) {
      await ctx.reply('Please provide a search term. Example: "search my python projects"');
      return;
    }

    let statusMsg = await ctx.reply(`🔍 Searching for "${searchQuery}"...`);

    const { results } = await searchWorkspace(client, searchQuery);

    if (results.length === 0) {
      await ctx.api.editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        `❌ No results found for "${searchQuery}"`
      );
      return;
    }

    let content = `📄 **Search Results** (${results.length} found)\n\n`;
    results.slice(0, 5).forEach((result, i) => {
      content += `${i + 1}. **${result.title || 'Untitled'}**\n`;
      if (result.url) {
        content += `   [View](${result.url})\n`;
      }
    });

    if (results.length > 5) {
      content += `\n... and ${results.length - 5} more results`;
    }

    await ctx.api.editMessageText(chatId, statusMsg.message_id, content, {
      parse_mode: 'Markdown',
    });

    // Store results in session (cast search results to RankedJob format)
    ctx.session.lastResults = results.map((r) => ({
      company: r.title || 'Unknown',
      role: '',
      location: '',
      description: '',
      url: r.url || '',
      source: 'linkedin' as const,
      priorityScore: 0,
      matchedSkills: [],
      missingSkills: [],
      whyFits: '',
    }));
    ctx.session.lastQuery = searchQuery;
  } catch (error) {
    console.error('Notion query error:', error);
    await ctx.reply('❌ Search failed. Please try again.');
  }
}
