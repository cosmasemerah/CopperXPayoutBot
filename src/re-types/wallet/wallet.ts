import { TimeStamps } from "../common";

/**
 * Wallet account types
 */
export enum WalletAccountType {
  WEB3_AUTH_COPPERX = "web3_auth_copperx",
  SAFE = "safe",
  CIRCLE_DEV = "circle_dev",
  EOA = "eoa",
  OTHER = "other",
  QUANTUM = "quantum",
}

/**
 * Wallet interface
 */
export interface Wallet extends TimeStamps {
  id: string;
  organizationId: string;
  walletType: WalletAccountType;
  network: string;
  walletAddress: string;
  isDefault: boolean;
}

/**
 * Set default wallet request
 */
export interface SetDefaultWalletRequest {
  walletId: string;
}

/**
 * Generate wallet request
 */
export interface GenerateWalletRequest {
  network: string;
}

/**
 * Possible wallet-related errors
 */
export enum WalletErrorType {
  FETCH_ERROR = "fetch_error",
  NOT_FOUND = "not_found",
  PERMISSION_DENIED = "permission_denied",
  INVALID_REQUEST = "invalid_request",
  SERVICE_UNAVAILABLE = "service_unavailable",
}

/**
 * Wallet-related error
 */
export interface WalletError extends Error {
  type: WalletErrorType;
  statusCode?: number;
  details?: Record<string, unknown>;
}
