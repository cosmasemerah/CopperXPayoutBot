import {
  WalletBalance,
  Wallet,
  SetDefaultWalletRequest,
  GenerateWalletRequest,
  BalanceResponse,
} from "../types";
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
 * @returns Promise with the updated wallet data
 */
export async function setDefaultWallet(
  token: string,
  walletId: string
): Promise<Wallet> {
  const request: SetDefaultWalletRequest = { walletId };
  return await api.post<Wallet>("/api/wallets/default", request, token);
}

/**
 * Get all wallets (without balances)
 * @param token The authentication token
 * @returns Promise with wallet data
 */
export async function getWallets(token: string): Promise<Wallet[]> {
  return await api.get<Wallet[]>("/api/wallets", token);
}

/**
 * Get the default wallet
 * @param token The authentication token
 * @returns Promise with default wallet information
 */
export async function getDefaultWallet(token: string): Promise<Wallet> {
  return await api.get<Wallet>("/api/wallets/default", token);
}

/**
 * Generate a new wallet or get existing wallet for a network
 * @param token The authentication token
 * @param network The network identifier (chain ID)
 * @returns Promise with the wallet data
 */
export async function generateWallet(
  token: string,
  network: string
): Promise<Wallet> {
  const request: GenerateWalletRequest = { network };
  return await api.post<Wallet>("/api/wallets", request, token);
}

/**
 * Get specific token balance for default wallet
 * @param token The authentication token
 * @returns Promise with token balance
 */
export async function getDefaultWalletBalance(
  token: string
): Promise<BalanceResponse> {
  return await api.get<BalanceResponse>("/api/wallets/balance", token);
}

/**
 * Get supported blockchain networks
 * @param token The authentication token
 * @returns Promise with list of supported chain IDs
 */
export async function getSupportedNetworks(token: string): Promise<string[]> {
  return await api.get<string[]>("/api/wallets/networks", token);
}

/**
 * Get token balance for a specific chain
 * @param token The authentication token
 * @param chainId The chain ID to check balance for
 * @param tokenSymbol The token symbol to check balance for
 * @returns Promise with token balance
 */
export async function getTokenBalanceForChain(
  token: string,
  chainId: string,
  tokenSymbol: string
): Promise<BalanceResponse> {
  return await api.get<BalanceResponse>(
    `/api/wallets/${chainId}/tokens/${tokenSymbol}/balance`,
    token
  );
}
