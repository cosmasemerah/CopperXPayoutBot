import { UserSession } from "./types";
import * as authService from "./services/auth.service";

// Define session state interfaces
export interface SessionState {
  currentAction?:
    | "login"
    | "sendemail"
    | "setdefaultwallet"
    | "sendwallet"
    | "deposit"
    | "withdrawbank";
  callbackData?: string; // For storing inline keyboard callback data
  data?: Record<string, any>; // For storing step-specific data
}

export interface ExtendedSession extends UserSession {
  state?: SessionState;
}

// Store sessions with type safety
const sessions = new Map<number, ExtendedSession>();

// Consider a token as expiring when it has this many milliseconds left
const TOKEN_REFRESH_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Get a user session
 * @param chatId The Telegram chat ID
 * @returns The user session if valid, undefined otherwise
 */
export function getSession(chatId: number): ExtendedSession | undefined {
  const session = sessions.get(chatId);

  if (!session) {
    return undefined;
  }

  // Check if the session needs to be refreshed
  const now = new Date();

  if (now >= session.expireAt) {
    // Session has already expired
    sessions.delete(chatId);
    return undefined;
  }

  // Check if the token is about to expire and should be refreshed
  // We won't await this so as not to block the current request
  const timeUntilExpiry = session.expireAt.getTime() - now.getTime();
  if (timeUntilExpiry < TOKEN_REFRESH_THRESHOLD_MS) {
    // Token is about to expire, attempt to refresh it in the background
    refreshSessionInBackground(chatId, session);
  }

  return session;
}

/**
 * Refresh the session token in the background
 * @param chatId The Telegram chat ID
 * @param session The current session
 */
async function refreshSessionInBackground(
  chatId: number,
  session: ExtendedSession
): Promise<void> {
  try {
    // We'll use the current token to get a fresh user profile
    // This will help keep the session active
    const user = await authService.getUserProfile(session.token);

    // If we got a successful response, extend the expiry time
    // Note: If the API had a specific token refresh endpoint, we would use that instead
    const extendedExpiry = new Date();
    extendedExpiry.setHours(extendedExpiry.getHours() + 24); // Extend by 24 hours

    // Update the session with the extended expiry
    session.expireAt = extendedExpiry;
    sessions.set(chatId, session);

    console.log(`Session refreshed for user ${user.email}`);
  } catch (error) {
    console.error("Failed to refresh session:", error);
    // If we couldn't refresh, we'll leave the session as is
    // The next request that hits the threshold will try again
  }
}

/**
 * Set a user session
 * @param chatId The Telegram chat ID
 * @param session The session data to store
 */
export function setSession(chatId: number, session: ExtendedSession): void {
  // Set a minimum expiry time to prevent very short-lived tokens
  const minExpiry = new Date();
  minExpiry.setHours(minExpiry.getHours() + 1); // At least 1 hour

  if (session.expireAt < minExpiry) {
    session.expireAt = minExpiry;
  }

  sessions.set(chatId, session);
}

/**
 * Delete a user session
 * @param chatId The Telegram chat ID
 */
export function deleteSession(chatId: number): void {
  sessions.delete(chatId);
}

/**
 * Check if a session is valid
 * @param session The session to check
 * @returns True if valid, false otherwise
 */
export function isSessionValid(session: UserSession): boolean {
  return new Date() < session.expireAt;
}

/**
 * Update session state
 * @param chatId The Telegram chat ID
 * @param state The new state
 * @returns True if session was updated, false if session does not exist
 */
export function updateSessionState(
  chatId: number,
  state: SessionState
): boolean {
  const session = sessions.get(chatId);
  if (!session) return false;

  session.state = state;
  sessions.set(chatId, session);
  return true;
}

/**
 * Get session state
 * @param chatId The Telegram chat ID
 * @returns The session state if exists, undefined otherwise
 */
export function getSessionState(chatId: number): SessionState | undefined {
  return sessions.get(chatId)?.state;
}

/**
 * Scan and refresh all sessions that are close to expiring
 * This function should be called periodically
 */
export function scanAndRefreshSessions(): void {
  const now = new Date();
  const sessionsToRefresh: [number, ExtendedSession][] = [];

  // Collect all sessions that need refreshing
  sessions.forEach((session, chatId) => {
    // Skip already expired sessions, they'll be cleaned up on next access
    if (now >= session.expireAt) {
      return;
    }

    const timeUntilExpiry = session.expireAt.getTime() - now.getTime();
    if (timeUntilExpiry < TOKEN_REFRESH_THRESHOLD_MS) {
      sessionsToRefresh.push([chatId, session]);
    }
  });

  // Refresh all collected sessions
  if (sessionsToRefresh.length > 0) {
    console.log(`Refreshing ${sessionsToRefresh.length} sessions`);

    for (const [chatId, session] of sessionsToRefresh) {
      refreshSessionInBackground(chatId, session);
    }
  }
}
