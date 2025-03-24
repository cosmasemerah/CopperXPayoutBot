/**
 * Format a wallet address for display
 * @param address The wallet address to format
 * @param length The number of characters to show from start and end
 * @returns The formatted address
 */
export function formatAddress(address: string, length: number = 6): string {
  if (!address || address.length <= length * 2) return address;
  return `${address.substring(0, length)}...${address.substring(
    address.length - length
  )}`;
}

/**
 * Format a currency amount for display
 * @param amount The amount to format
 * @param decimals The number of decimal places to show
 * @returns The formatted amount
 */
export function formatAmount(
  amount: string | number,
  decimals: number = 2
): string {
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(numAmount)) return "0.00";
  return numAmount.toFixed(decimals);
}

/**
 * Format a currency amount with the currency symbol
 * @param amount The amount to format
 * @param currency The currency code (e.g., "USDC")
 * @param decimals The number of decimal places to show
 * @returns The formatted currency amount
 */
export function formatCurrency(
  amount: string | number,
  currency: string = "USDC",
  decimals: number = 2
): string {
  const formattedAmount = formatAmount(amount, decimals);
  return `${formattedAmount} ${currency}`;
}

/**
 * Format a date to a human-readable string
 * @param date The date to format
 * @returns The formatted date string
 */
export function formatDate(date: Date): string {
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Import the getNetworkName function
import { getNetworkName } from "./constants";

/**
 * Create a Markdown formatted message for wallet balances
 * @param walletBalances The wallet balances array
 * @param walletData The wallet data array with wallet addresses
 * @returns The formatted message
 */
export function formatWalletBalances(
  walletBalances: any[],
  walletData: any[]
): string {
  if (!walletBalances || walletBalances.length === 0) {
    return "You don't have any wallets yet.";
  }

  let message = "💰 *Wallet Balances*\n\n";

  walletBalances.forEach((wallet) => {
    const networkName = getNetworkName(wallet.network);
    message += `💎 *${networkName}*${wallet.isDefault ? " (Default)" : ""}\n`;

    // Find the corresponding wallet data with the address
    const walletInfo = walletData.find((w) => w.id === wallet.walletId);
    if (walletInfo && walletInfo.walletAddress) {
      message += `Wallet: \`${walletInfo.walletAddress}\`\n`;
    }

    if (!wallet.balances || wallet.balances.length === 0) {
      message += "No balances found\n\n";
    } else {
      wallet.balances.forEach((balance: any) => {
        message += `• *${formatAmount(balance.balance)} ${balance.symbol}*\n`;
      });
      message += "\n";
    }
  });

  return message;
}
