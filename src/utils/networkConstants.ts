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
