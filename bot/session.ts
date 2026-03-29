/**
 * Telegram Bot Session Type Definitions
 */

import { Context, SessionFlavor } from 'grammy';
import { RankedJob } from '@/lib/types';

/**
 * Session data stored per chat
 */
export interface BotSession {
  lastResults: RankedJob[];
  lastQuery: string;
  lastLocation: string;
  lastStatusMessageId?: number;
}

/**
 * Extended context type with session
 */
export type BotContext = Context & SessionFlavor<BotSession>;
