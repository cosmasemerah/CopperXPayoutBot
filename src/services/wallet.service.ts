import { WalletBalance } from "../types";
import * as api from "../utils/api";

/**
 * Get wallet balances
 * @param token The authentication token
 * @returns Promise with wallet balances
 */
export async function getWalletBalances(
  token: string
): Promise<WalletBalance[]> {
  return await api.get<WalletBalance[]>("/api/wallets/balances", token);
}

/**
 * Set the default wallet
 * @param token The authentication token
 * @param walletId The wallet ID to set as default
 * @returns Promise with the response
 */
export async function setDefaultWallet(
  token: string,
  walletId: string
): Promise<any> {
  return await api.post("/api/wallets/default", { walletId }, token);
}

/**
 * Get all wallets (without balances)
 * @param token The authentication token
 * @returns Promise with wallet data
 */
export async function getWallets(token: string): Promise<any[]> {
  return await api.get<any[]>("/api/wallets", token);
}

/**
 * Get the default wallet
 * @param token The authentication token
 * @returns Promise with default wallet information
 */
export async function getDefaultWallet(token: string): Promise<any> {
  return await api.get<any>("/api/wallets/default", token);
}
