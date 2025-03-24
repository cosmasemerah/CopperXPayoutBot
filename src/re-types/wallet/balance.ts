/**
 * Token balance Data Transfer Object
 */
export interface BalanceResponse {
  decimals: number;
  balance: string;
  symbol: "USDC" | "USDT" | "DAI" | "ETH" | "USDCE" | "STRK";
  address: string;
}

/**
 * Wallet balance interface
 */
export interface WalletBalance {
  walletId: string;
  isDefault: boolean;
  network: string;
  balances: BalanceResponse[];
}

/**
 * Wallet balances response
 */
export interface WalletBalancesResponse {
  balances: Array<{
    chainId: string;
    balance: string;
  }>;
}
