import { UserSession } from "../types";
import * as authService from "../services/auth.service";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { config } from "../config";
import EventEmitter from "events";
import {
  SESSION_FILE_PATH,
  TOKEN_REFRESH_THRESHOLD_MS,
  SESSION_MIN_EXPIRY_HOURS,
  SESSION_EXTENSION_HOURS,
  SESSION_SAVE_PROBABILITY,
  SESSION_VERSION,
  MAX_SESSIONS,
  MAX_RETRIES,
  SESSION_SALT,
  SESSION_SAVE_DEBOUNCE_MS,
} from "../utils/constants";
import { getModuleLogger } from "../utils/logger";

// Get module-specific logger
const logger = getModuleLogger("session-service");

// Define session state interfaces
export interface SessionState {
  currentAction?:
    | "login"
    | "sendemail"
    | "setdefaultwallet"
    | "sendwallet"
    | "deposit"
    | "withdrawbank"
    | "history"
    | "addpayee"
    | "sendbatch";
  callbackData?: string; // For storing inline keyboard callback data
  data?: Record<string, any>; // For storing step-specific data
}

export interface ExtendedSession extends UserSession {
  state?: SessionState;
  lastActivity: Date; // Track when the session was last active
}

// Define interfaces for serialized session format
interface SerializedSession {
  token: string;
  expireAt: string; // ISO date string
  organizationId: string;
  state?: SessionState;
  lastActivity: string; // ISO date string
}

interface SerializedSessionStore {
  version: number;
  sessions: Record<string, SerializedSession>;
}

// Configuration constants
const ENCRYPTION_KEY = config.session.encryptionKey;
const SESSION_INACTIVITY_TIMEOUT = config.session.inactivityTimeout; // 5 days

// Session events setup
export const sessionEvents = new EventEmitter();

// Session metrics tracking
const sessionMetrics = {
  totalCreated: 0,
  totalExpired: 0,
  totalInactive: 0,
  totalRefreshed: 0,
  activeSessions: 0,
  lastSave: new Date(),
  loadErrors: 0,
  saveErrors: 0,
};

// Export function to get session metrics
export function getSessionMetrics(): typeof sessionMetrics {
  return { ...sessionMetrics, activeSessions: sessions.size };
}

// Store sessions with type safety
const sessions = new Map<number, ExtendedSession>();

// Track pending save operations
let saveTimeout: NodeJS.Timeout | null = null;

// Make sure the data directory exists
try {
  const dataDir = path.dirname(SESSION_FILE_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
} catch (error) {
  logger.error("Failed to create data directory:", error as Error);
}

class SessionServiceImpl {
  constructor() {
    this.loadSessions(); // Load sessions on service initialization
  }

  /**
   * Derive a cryptographic key from the provided password
   */
  private deriveKey(password: string): Buffer {
    return crypto.pbkdf2Sync(password, SESSION_SALT, 10000, 32, "sha256");
  }

  /**
   * Encrypt data using AES-GCM for authenticated encryption
   */
  private encryptData(data: string): string {
    const iv = crypto.randomBytes(12); // GCM recommends 12 bytes
    const key = this.deriveKey(ENCRYPTION_KEY);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

    let encrypted = cipher.update(data, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag().toString("hex");

    return `${iv.toString("hex")}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypt data using AES-GCM
   */
  private decryptData(data: string): string {
    const [ivHex, authTagHex, encryptedData] = data.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const key = this.deriveKey(ENCRYPTION_KEY);

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData, "hex", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  }

  /**
   * Schedule a session save operation with debouncing
   */
  private scheduleSave(): void {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      this.saveSessionsWithRetry();
      saveTimeout = null;
    }, SESSION_SAVE_DEBOUNCE_MS);
  }

  /**
   * Save sessions to file with retry logic
   */
  private async saveSessionsWithRetry(maxRetries = MAX_RETRIES): Promise<void> {
    let retries = 0;
    while (retries < maxRetries) {
      try {
        this.saveSessions();
        return; // Success, exit
      } catch (error) {
        retries++;
        logger.error(
          `Failed to save sessions (attempt ${retries}/${maxRetries}):`,
          error as Error
        );
        sessionMetrics.saveErrors++;

        if (retries >= maxRetries) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1000 * retries)); // Exponential backoff
      }
    }
  }

  /**
   * Save sessions to file
   */
  private saveSessions(): void {
    try {
      // Backup existing file if it exists
      if (fs.existsSync(SESSION_FILE_PATH)) {
        fs.copyFileSync(SESSION_FILE_PATH, `${SESSION_FILE_PATH}.bak`);
      }

      // Prepare for serialization by converting Date objects to strings
      const serializable: SerializedSessionStore = {
        version: SESSION_VERSION,
        sessions: Object.fromEntries(
          Array.from(sessions.entries()).map(([chatId, session]) => {
            return [
              chatId.toString(),
              {
                ...session,
                expireAt: session.expireAt.toISOString(),
                lastActivity: session.lastActivity.toISOString(),
              },
            ];
          })
        ),
      };

      // Encrypt data before saving to file
      const encrypted = this.encryptData(JSON.stringify(serializable));
      fs.writeFileSync(SESSION_FILE_PATH, encrypted);

      sessionMetrics.lastSave = new Date();
      logger.debug(`Saved ${sessions.size} sessions to file`);
    } catch (error) {
      sessionMetrics.saveErrors++;
      logger.error("Failed to save sessions:", error as Error);
      throw error; // Re-throw for retry mechanism
    }
  }

  /**
   * Check and limit session cache size
   */
  private checkSessionCacheSize(): void {
    if (sessions.size > MAX_SESSIONS) {
      logger.warn(
        `Session cache exceeds limit (${sessions.size}/${MAX_SESSIONS}), pruning oldest sessions`
      );

      // Remove the oldest sessions based on lastActivity
      const oldestSessions = Array.from(sessions.entries())
        .sort(
          (a, b) => a[1].lastActivity.getTime() - b[1].lastActivity.getTime()
        )
        .slice(0, Math.floor(MAX_SESSIONS * 0.2)); // Remove 20% of sessions

      oldestSessions.forEach(([chatId]) => {
        sessions.delete(chatId);
        logger.debug(`Pruned old session for chat ${chatId}`);
      });

      this.scheduleSave();
    }
  }

  /**
   * Load sessions from file
   */
  private loadSessions(): void {
    try {
      if (!fs.existsSync(SESSION_FILE_PATH)) {
        logger.info("No session file found, starting with empty sessions");
        return; // No file yet, start with empty sessions
      }

      const encrypted = fs.readFileSync(SESSION_FILE_PATH, "utf8");
      const data = this.decryptData(encrypted);
      const loaded = JSON.parse(data) as SerializedSessionStore;

      // Clear current sessions and load from file
      sessions.clear();

      // Check version and handle accordingly
      if (!loaded.version || loaded.version < SESSION_VERSION) {
        logger.warn(
          `Loading sessions from older format (version ${
            loaded.version || "unknown"
          })`
        );
        // Handle legacy format (pre-versioning)
        if (!loaded.sessions && typeof loaded === "object") {
          this.migrateOldSessions(loaded as Record<string, any>);
          return;
        }
      }

      // Restore date objects and load into Map
      Object.entries(loaded.sessions).forEach(([chatIdStr, sessionData]) => {
        const chatId = Number(chatIdStr);
        const session: ExtendedSession = {
          ...sessionData,
          expireAt: new Date(sessionData.expireAt),
          lastActivity: new Date(sessionData.lastActivity),
        };

        // Only load valid sessions (not expired)
        if (new Date() < session.expireAt) {
          sessions.set(chatId, session);
        }
      });

      sessionMetrics.activeSessions = sessions.size;
      logger.info(`Loaded ${sessions.size} sessions from file`);
    } catch (error) {
      sessionMetrics.loadErrors++;
      logger.error("Failed to load sessions:", error as Error);

      // Try to load backup file if exists
      try {
        if (fs.existsSync(`${SESSION_FILE_PATH}.bak`)) {
          logger.warn("Attempting to load sessions from backup file");
          const encrypted = fs.readFileSync(`${SESSION_FILE_PATH}.bak`, "utf8");
          const data = this.decryptData(encrypted);
          const loaded = JSON.parse(data) as SerializedSessionStore;

          // Clear and load from backup
          sessions.clear();

          // Process the backup data (similar logic as above)
          Object.entries(loaded.sessions || {}).forEach(
            ([chatIdStr, sessionData]) => {
              const chatId = Number(chatIdStr);
              const session: ExtendedSession = {
                ...sessionData,
                expireAt: new Date(sessionData.expireAt),
                lastActivity: new Date(sessionData.lastActivity),
              };

              if (new Date() < session.expireAt) {
                sessions.set(chatId, session);
              }
            }
          );

          logger.info(`Recovered ${sessions.size} sessions from backup file`);
        }
      } catch (backupError) {
        logger.error("Failed to load backup sessions:", backupError as Error);
        // If we failed to load, start with an empty session store
      }
    }
  }

  /**
   * Migrate sessions from old format (pre-versioning)
   */
  private migrateOldSessions(oldSessions: Record<string, any>): void {
    try {
      logger.info("Migrating sessions from old format");
      Object.entries(oldSessions).forEach(([chatIdStr, sessionData]) => {
        const chatId = Number(chatIdStr);
        // Add lastActivity if it doesn't exist
        if (!sessionData.lastActivity) {
          sessionData.lastActivity =
            sessionData.expireAt || new Date().toISOString();
        }

        const session: ExtendedSession = {
          ...sessionData,
          expireAt: new Date(sessionData.expireAt),
          lastActivity: new Date(sessionData.lastActivity),
        };

        if (new Date() < session.expireAt) {
          sessions.set(chatId, session);
        }
      });

      // Save in new format immediately
      this.scheduleSave();
      logger.info(`Migrated ${sessions.size} sessions to new format`);
    } catch (error) {
      logger.error("Failed to migrate old sessions:", error as Error);
    }
  }

  /**
   * Update the last activity timestamp for a session
   */
  private updateLastActivity(chatId: number): void {
    const session = sessions.get(chatId);
    if (session) {
      session.lastActivity = new Date();
      sessions.set(chatId, session);
    }
  }

  /**
   * Get a user session
   */
  public getSession(chatId: number): ExtendedSession | undefined {
    const session = sessions.get(chatId);

    if (!session) {
      return undefined;
    }

    // Check if the session has expired
    const now = new Date();

    if (now >= session.expireAt) {
      // Session has already expired
      sessions.delete(chatId);
      sessionMetrics.totalExpired++;
      sessionEvents.emit("session:expired", chatId);
      this.scheduleSave();
      return undefined;
    }

    // Check for inactivity timeout
    const inactivityTime = now.getTime() - session.lastActivity.getTime();
    if (inactivityTime > SESSION_INACTIVITY_TIMEOUT) {
      logger.info(`Session for chat ${chatId} timed out due to inactivity`);
      sessions.delete(chatId);
      sessionMetrics.totalInactive++;
      sessionEvents.emit("session:inactive", chatId);
      this.scheduleSave();
      return undefined;
    }

    // Check if the token is about to expire and should be refreshed
    // We won't await this so as not to block the current request
    const timeUntilExpiry = session.expireAt.getTime() - now.getTime();
    if (timeUntilExpiry < TOKEN_REFRESH_THRESHOLD_MS) {
      // Token is about to expire, attempt to refresh it in the background
      this.refreshSessionInBackground(chatId, session);
    }

    // Update activity timestamp
    this.updateLastActivity(chatId);

    // Periodically save sessions after activity
    if (Math.random() < SESSION_SAVE_PROBABILITY) {
      this.scheduleSave();
    }

    return session;
  }

  /**
   * Refresh the session token in the background
   */
  private async refreshSessionInBackground(
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
      extendedExpiry.setHours(
        extendedExpiry.getHours() + SESSION_EXTENSION_HOURS
      );

      // Update the session with the extended expiry and last activity
      session.expireAt = extendedExpiry;
      session.lastActivity = new Date();
      sessions.set(chatId, session);

      sessionMetrics.totalRefreshed++;
      sessionEvents.emit("session:refreshed", chatId);

      // Schedule a save operation
      this.scheduleSave();

      logger.info(`Session refreshed for user ${user.email}`);
    } catch (error) {
      logger.error("Failed to refresh session:", error as Error);
      // If we couldn't refresh, we'll leave the session as is
      // The next request that hits the threshold will try again
    }
  }

  /**
   * Set a user session
   */
  public setSession(
    chatId: number,
    session: Omit<ExtendedSession, "lastActivity">
  ): void {
    // Set a minimum expiry time to prevent very short-lived tokens
    const minExpiry = new Date();
    minExpiry.setHours(minExpiry.getHours() + SESSION_MIN_EXPIRY_HOURS);

    if (session.expireAt < minExpiry) {
      session.expireAt = minExpiry;
    }

    // Add lastActivity field if not present
    const fullSession: ExtendedSession = {
      ...session,
      lastActivity: new Date(),
    };

    sessions.set(chatId, fullSession);
    sessionMetrics.totalCreated++;
    sessionEvents.emit("session:created", chatId);

    // Check if we need to prune old sessions
    this.checkSessionCacheSize();

    // Save to file after setting a session
    this.scheduleSave();
  }

  /**
   * Delete a user session
   */
  public deleteSession(chatId: number): void {
    sessions.delete(chatId);
    sessionEvents.emit("session:deleted", chatId);
    this.scheduleSave(); // Schedule save to file after deleting
  }

  /**
   * Check if a session is valid
   */
  public isSessionValid(session: UserSession): boolean {
    return new Date() < session.expireAt;
  }

  /**
   * Update session state
   */
  public updateSessionState(chatId: number, state: SessionState): boolean {
    const session = sessions.get(chatId);
    if (!session) return false;

    session.state = state;
    session.lastActivity = new Date(); // Update activity time
    sessions.set(chatId, session);
    sessionEvents.emit("session:stateUpdated", chatId, state);

    // Schedule save for state changes
    this.scheduleSave();

    return true;
  }

  /**
   * Get session state
   */
  public getSessionState(chatId: number): SessionState | undefined {
    const session = this.getSession(chatId);
    return session?.state;
  }

  /**
   * Listen for session events
   */
  public onSessionEvent(
    event: string,
    callback: (...args: any[]) => void
  ): void {
    sessionEvents.on(event, callback);
  }

  /**
   * Scan and refresh all sessions that are close to expiring
   */
  public scanAndRefreshSessions(): void {
    const now = new Date();
    const sessionsToRefresh: [number, ExtendedSession][] = [];
    const expiredSessions: number[] = [];
    const inactiveSessions: number[] = [];

    // Collect all sessions that need refreshing and identify expired/inactive ones
    sessions.forEach((session, chatId) => {
      // Check for expired tokens
      if (now >= session.expireAt) {
        expiredSessions.push(chatId);
        return;
      }

      // Check for inactivity timeout
      const inactivityTime = now.getTime() - session.lastActivity.getTime();
      if (inactivityTime > SESSION_INACTIVITY_TIMEOUT) {
        inactiveSessions.push(chatId);
        return;
      }

      // Check for sessions that need refresh
      const timeUntilExpiry = session.expireAt.getTime() - now.getTime();
      if (timeUntilExpiry < TOKEN_REFRESH_THRESHOLD_MS) {
        sessionsToRefresh.push([chatId, session]);
      }
    });

    // Remove expired sessions
    if (expiredSessions.length > 0) {
      logger.info(`Removing ${expiredSessions.length} expired sessions`);
      expiredSessions.forEach((chatId) => {
        sessions.delete(chatId);
        sessionEvents.emit("session:expired", chatId);
      });
      sessionMetrics.totalExpired += expiredSessions.length;
    }

    // Remove inactive sessions
    if (inactiveSessions.length > 0) {
      logger.info(`Removing ${inactiveSessions.length} inactive sessions`);
      inactiveSessions.forEach((chatId) => {
        sessions.delete(chatId);
        sessionEvents.emit("session:inactive", chatId);
      });
      sessionMetrics.totalInactive += inactiveSessions.length;
    }

    // Refresh all collected sessions
    if (sessionsToRefresh.length > 0) {
      logger.info(`Refreshing ${sessionsToRefresh.length} sessions`);

      for (const [chatId, session] of sessionsToRefresh) {
        this.refreshSessionInBackground(chatId, session);
      }
    }

    // If any changes were made, schedule a save
    if (expiredSessions.length > 0 || inactiveSessions.length > 0) {
      this.scheduleSave();
    }

    // Also check session cache size periodically
    this.checkSessionCacheSize();
  }
}

// Export singleton instance
export const SessionService = new SessionServiceImpl();
