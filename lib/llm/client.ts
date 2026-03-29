/**
 * LLM Client - Ollama/Gemini dispatcher
 */

import { LLMProvider } from '@/lib/types';
import { extractJSONFromResponse } from './prompts';

/**
 * Call the configured LLM provider (Ollama by default, Gemini fallback)
 */
export async function callLLM(prompt: string): Promise<string> {
  const provider = (process.env.LLM_PROVIDER || 'ollama') as LLMProvider;

  if (provider === 'gemini' && process.env.GEMINI_API_KEY) {
    return callGemini(prompt);
  }

  return callOllama(prompt);
}

/**
 * Call Ollama local LLM
 */
export async function callOllama(prompt: string): Promise<string> {
  try {
    const apiUrl = process.env.OLLAMA_API_URL || 'http://localhost:11434/api/chat';
    const model = process.env.OLLAMA_MODEL || 'qwen2.5:3b';
    const timeout = parseInt(process.env.OLLAMA_TIMEOUT_SLOW || '120000');

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
      }),
      signal: AbortSignal.timeout(timeout),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      message?: { content: string };
      error?: string;
    };

    if (data.error) {
      throw new Error(`Ollama error: ${data.error}`);
    }

    return data.message?.content || '';
  } catch (error) {
    console.error('Ollama call failed:', error);
    // Fallback to Gemini if Ollama fails
    if (process.env.GEMINI_API_KEY) {
      console.log('Falling back to Gemini...');
      return callGemini(prompt).catch(() => '');
    }
    return '';
  }
}

/**
 * Call Google Gemini API
 */
export async function callGemini(prompt: string): Promise<string> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
        }),
        signal: AbortSignal.timeout(60000),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Gemini API error: ${error.error?.message || response.statusText}`
      );
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
      error?: { message: string };
    };

    if (data.error) {
      throw new Error(`Gemini error: ${data.error.message}`);
    }

    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } catch (error) {
    console.error('Gemini call failed:', error);
    return '';
  }
}

/**
 * Call LLM and parse JSON response
 */
export async function callLLMAndParseJSON(
  prompt: string
): Promise<Record<string, unknown> | null> {
  const response = await callLLM(prompt);
  return extractJSONFromResponse(response);
}
