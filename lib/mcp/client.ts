/**
 * MCP Client for Notion hosted MCP server at https://mcp.notion.com/mcp
 * Uses @modelcontextprotocol/sdk with Streamable HTTP transport and SSE fallback
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

export class MCPClient {
  private _client: Client | null = null;
  private _connected = false;

  constructor(
    private readonly accessToken: string,
    private readonly serverUrl = 'https://mcp.notion.com/mcp',
    private readonly sseUrl = 'https://mcp.notion.com/sse'
  ) {
    if (!accessToken) {
      throw new Error('MCP access token is required');
    }
  }

  /**
   * Ensure client is connected, with automatic SSE fallback
   */
  private async ensureConnected(): Promise<Client> {
    if (this._connected && this._client) {
      return this._client;
    }

    this._client = new Client(
      {
        name: 'notion-internship-agent',
        version: '2.0.0',
      },
      {
        capabilities: {
          roots: {},
          sampling: {},
        },
      }
    );

    try {
      // Try Streamable HTTP first (more efficient)
      await this.connectStreamable();
    } catch (error) {
      console.warn('Streamable HTTP transport failed, attempting SSE fallback:', error);
      try {
        await this.connectSSE();
      } catch (sseError) {
        console.error('Both Streamable HTTP and SSE failed:', sseError);
        throw sseError;
      }
    }

    this._connected = true;
    return this._client;
  }

  /**
   * Connect using Streamable HTTP transport
   */
  private async connectStreamable(): Promise<void> {
    if (!this._client) throw new Error('Client not initialized');

    const transport = new StreamableHTTPClientTransport(new URL(this.serverUrl), {
      requestInit: {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'notion-internship-agent/2.0.0',
        },
      },
    });

    await this._client.connect(transport);
  }

  /**
   * Connect using SSE transport (fallback)
   */
  private async connectSSE(): Promise<void> {
    if (!this._client) throw new Error('Client not initialized');

    const transport = new SSEClientTransport(new URL(this.sseUrl), {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'notion-internship-agent/2.0.0',
      },
    });

    await this._client.connect(transport);
  }

  /**
   * Call a Notion MCP tool
   * @param toolName The name of the MCP tool (e.g., 'notion-search', 'notion-fetch')
   * @param args Tool arguments
   * @returns Parsed JSON response or empty object
   */
  async callTool<T = Record<string, unknown>>(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<T> {
    const client = await this.ensureConnected();

    try {
      const result = await client.callTool({
        name: toolName,
        arguments: args,
      });

      // Check for errors
      if (result.isError) {
        const errorContent = result.content[0];
        if (errorContent && 'text' in errorContent) {
          throw new Error(`MCP tool error: ${errorContent.text}`);
        }
        throw new Error('MCP tool returned an error');
      }

      // Extract text content
      const textBlock = result.content.find(
        (block) => 'type' in block && block.type === 'text' && 'text' in block
      );

      if (!textBlock || !('text' in textBlock)) {
        console.warn(`No text content in response from ${toolName}`);
        return {} as T;
      }

      // Try to parse as JSON, fallback to returning text
      try {
        return JSON.parse(textBlock.text as string) as T;
      } catch {
        // Return as object with text field
        return { text: textBlock.text } as T;
      }
    } catch (error) {
      console.error(`Error calling MCP tool ${toolName}:`, error);
      throw error;
    }
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    if (this._client) {
      try {
        await this._client.close();
      } catch (error) {
        console.warn('Error closing MCP client:', error);
      }
      this._connected = false;
      this._client = null;
    }
  }

  /**
   * Check if client is connected
   */
  isConnected(): boolean {
    return this._connected;
  }
}

/**
 * Factory function to create MCP client for per-request use in Next.js
 */
export function createMCPClient(
  accessToken: string,
  serverUrl?: string
): MCPClient {
  return new MCPClient(accessToken, serverUrl);
}

