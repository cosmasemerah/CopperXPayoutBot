export const SESSION_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
export const PORT = process.env.PORT || 3000;

// Session Management Constants
export const SESSION_FILE_PATH = process.cwd() + "/data/sessions.json";
export const TOKEN_REFRESH_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes
export const SESSION_MIN_EXPIRY_HOURS = 1; // Minimum session lifetime
export const SESSION_EXTENSION_HOURS = 24; // How long to extend sessions
export const SESSION_SAVE_PROBABILITY = 0.1; // 10% chance to save on activity
export const SESSION_VERSION = 1; // Current version of session storage format
export const MAX_SESSIONS = 10000; // Maximum number of sessions to keep in memory
export const MAX_RETRIES = 3; // Maximum number of retries for file operations
export const SESSION_SALT = "copperx-telegram-bot-salt-v1"; // Static salt for key derivation
export const SESSION_SAVE_DEBOUNCE_MS = 5000; // 5 seconds debounce for saving sessions

/**
 * Network-related constants
 */

// Network ID to name mapping with short names (without "Mainnet")
export const NETWORK_NAMES: Record<string, string> = {
  "1": "Ethereum",
  "10": "Optimism",
  "56": "Binance Smart Chain",
  "137": "Polygon",
  "8453": "Base",
  "42161": "Arbitrum One",
  "23434": "Starknet",
};

// Network ID to name mapping with full names (including "Mainnet")
export const NETWORK_NAMES_FULL: Record<string, string> = {
  "1": "Ethereum Mainnet",
  "10": "Optimism Mainnet",
  "56": "Binance Smart Chain Mainnet",
  "137": "Polygon Mainnet",
  "8453": "Base Mainnet",
  "42161": "Arbitrum One Mainnet",
  "23434": "Starknet",
};

/**
 * Format a network ID to a human-readable name
 * @param networkId The network ID to format
 * @param useFull Whether to use the full network names (with "Mainnet")
 * @returns Formatted network name
 */
export function getNetworkName(
  networkId: string | undefined,
  useFull = false
): string {
  if (!networkId) {
    return "Unknown Network";
  }

  const nameMap = useFull ? NETWORK_NAMES_FULL : NETWORK_NAMES;
  return nameMap[networkId] || `Network ${networkId}`;
}
