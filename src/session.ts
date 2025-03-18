import { UserSession } from "./types";

// Define session state interfaces
export interface SessionState {
  currentAction?: "login" | "sendemail" | "setdefaultwallet" | "sendwallet";
  callbackData?: string; // For storing inline keyboard callback data
  data?: Record<string, any>; // For storing step-specific data
}

export interface ExtendedSession extends UserSession {
  state?: SessionState;
}

// Store sessions with type safety
const sessions = new Map<number, ExtendedSession>();

/**
 * Get a user session
 * @param chatId The Telegram chat ID
 * @returns The user session if valid, undefined otherwise
 */
export function getSession(chatId: number): ExtendedSession | undefined {
  const session = sessions.get(chatId);
  if (session && new Date() < session.expireAt) {
    return session;
  }

  // Clean up expired session
  sessions.delete(chatId);
  return undefined;
}

/**
 * Set a user session
 * @param chatId The Telegram chat ID
 * @param session The session data to store
 */
export function setSession(chatId: number, session: ExtendedSession): void {
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
