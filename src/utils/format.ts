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
 * Format network IDs to human-readable names
 * @param networkId The network ID to format
 * @param networkNames Map of network IDs to names
 * @returns The formatted network name
 */
export function formatNetworkName(
  networkId: string,
  networkNames: Record<string, string>
): string {
  return networkNames[networkId] || `Network ${networkId}`;
}

/**
 * Create a Markdown formatted message for wallet balances
 * @param wallets The wallet balances to format
 * @param networkNames Map of network IDs to names
 * @returns The formatted message
 */
export function formatWalletBalances(
  wallets: any[],
  networkNames: Record<string, string>
): string {
  if (!wallets || wallets.length === 0) {
    return "You don't have any wallets yet.";
  }

  let message = "💰 *Wallet Balances*\n\n";

  wallets.forEach((wallet) => {
    const networkName = formatNetworkName(wallet.network, networkNames);
    message += `*Network*: ${networkName} (${wallet.network})\n`;
    message += `*Default*: ${wallet.isDefault ? "Yes" : "No"}\n`;
    message += `*Wallet ID*: \`${wallet.walletId}\`\n`;

    if (!wallet.balances || wallet.balances.length === 0) {
      message += "*Balances*: No balances found\n\n";
    } else {
      message += "*Balances*:\n";
      wallet.balances.forEach((balance: any) => {
        message += `  • ${formatAmount(balance.balance, balance.decimals)} ${
          balance.symbol
        }\n`;
        message += `    Address: \`${balance.address}\`\n`;
      });
      message += "\n";
    }
  });

  return message;
}
