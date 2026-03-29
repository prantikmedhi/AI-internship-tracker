/**
 * Logout route
 * POST /api/auth/logout
 * Clears session cookie
 */

import { NextRequest, NextResponse } from 'next/server';
import { clearSession } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    await clearSession();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Logout failed' },
      { status: 500 }
    );
  }
}

// Also support GET for convenience (e.g., logout links)
export async function GET(request: NextRequest) {
  try {
    await clearSession();
    return NextResponse.redirect(new URL('/', request.url));
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.redirect(new URL('/?error=logout_failed', request.url));
  }
}
