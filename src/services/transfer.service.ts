import * as api from "../utils/api";
import {
  TransferResponse,
  TransferHistoryResponse,
  PurposeCode,
} from "../types/transfer";
import { SourceOfFunds, WalletBalancesResponse } from "../types/wallet";
import * as walletService from "./wallet.service";

/**
 * Send funds to an email address
 * @param token The authentication token
 * @param email The recipient's email
 * @param amount The amount to send
 * @param currency The currency code (default: "USDC")
 * @param purposeCode The purpose code (default: "send")
 * @returns Promise with the response
 */
export async function sendToEmail(
  token: string,
  email: string,
  amount: string,
  currency: string = "USDC",
  purposeCode: string = PurposeCode.SELF
): Promise<TransferResponse> {
  // Validate the amount before sending
  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    throw new Error("Amount must be a positive number");
  }

  // Check if amount is within allowed range (1 USDC to 50,000 USDC)
  if (parsedAmount < 1) {
    throw new Error("Minimum transfer amount is 1 USDC");
  }
  if (parsedAmount > 50000) {
    throw new Error("Maximum transfer amount is 50,000 USDC");
  }

  // Convert decimal amount (e.g., "1.5" USDC) to API required format (integer string with 8 decimal places)
  // For example, 1.5 USDC -> "150000000"
  const scaledAmount = (parsedAmount * 100000000).toFixed(0);

  // Debug log to verify the conversion
  console.log(`Converting ${amount} USDC to API format: ${scaledAmount}`);

  return await api.post(
    "/api/transfers/send",
    {
      email,
      amount: scaledAmount, // Scaled amount as string
      currency,
      purposeCode,
    },
    token
  );
}

/**
 * Send funds to a wallet address
 * @param token The authentication token
 * @param walletAddress The recipient's wallet address
 * @param amount The amount to send
 * @param currency The currency code (default: "USDC")
 * @param network The network to use
 * @param purposeCode The purpose code (default: "self")
 * @returns Promise with the response
 */
export async function sendToWallet(
  token: string,
  walletAddress: string,
  amount: string,
  currency: string = "USDC",
  network: string,
  purposeCode: string = PurposeCode.SELF
): Promise<TransferResponse> {
  // Validate the amount before sending
  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    throw new Error("Amount must be a positive number");
  }

  // Check if amount is within allowed range (1 USDC to 50,000 USDC)
  if (parsedAmount < 1) {
    throw new Error("Minimum transfer amount is 1 USDC");
  }
  if (parsedAmount > 50000) {
    throw new Error("Maximum transfer amount is 50,000 USDC");
  }

  // Convert decimal amount to API required format (integer string with 8 decimal places)
  const scaledAmount = (parsedAmount * 100000000).toFixed(0);

  return await api.post(
    "/api/transfers/wallet-withdraw",
    {
      walletAddress,
      amount: scaledAmount, // Scaled amount as string
      currency,
      network,
      purposeCode,
    },
    token
  );
}

/**
 * Initiate a deposit to user's wallet
 * @param token The authentication token
 * @param amount The amount to deposit
 * @param chainId The chain ID (network) for the deposit
 * @param sourceOfFunds The source of funds (default: "salary")
 * @param currency The currency code (default: "USDC")
 * @returns Promise with deposit information
 */
export async function initiateDeposit(
  token: string,
  amount: string,
  chainId: string,
  sourceOfFunds: string = SourceOfFunds.SALARY,
  currency: string = "USDC"
): Promise<TransferResponse> {
  // Validate the amount before sending
  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    throw new Error("Amount must be a positive number");
  }

  // Check if amount is within allowed range (1 USDC to 50,000 USDC)
  if (parsedAmount < 1) {
    throw new Error("Minimum deposit amount is 1 USDC");
  }
  if (parsedAmount > 50000) {
    throw new Error("Maximum deposit amount is 50,000 USDC");
  }

  // Convert decimal amount to API required format (integer string with 8 decimal places)
  const scaledAmount = (parsedAmount * 100000000).toFixed(0);

  return await api.post(
    "/api/transfers/deposit",
    {
      amount: scaledAmount, // Scaled amount as string
      sourceOfFunds,
      depositChainId: parseInt(chainId, 10),
      currency,
    },
    token
  );
}

/**
 * Get transfer history
 * @param token The authentication token
 * @param page The page number (default: 1)
 * @param limit The number of transfers per page (default: 10)
 * @returns Promise with transfer history
 */
export async function getTransferHistory(
  token: string,
  page: number = 1,
  limit: number = 10
): Promise<TransferHistoryResponse> {
  return await api.get(`/api/transfers?page=${page}&limit=${limit}`, token);
}

/**
 * Withdraw funds to a bank account
 * @param token The authentication token
 * @param amount The amount to withdraw
 * @param currency The currency code (default: "USD")
 * @param purposeCode The purpose code (default: "withdrawal")
 * @returns Promise with the response
 */
export async function withdrawToBank(
  token: string,
  amount: string,
  currency: string = "USD",
  purposeCode: string = PurposeCode.WITHDRAWAL
): Promise<TransferResponse> {
  // Convert decimal amount to API required format (integer string with 8 decimal places)
  const scaledAmount = (parseFloat(amount) * 100000000).toFixed(0);

  return await api.post(
    "/api/transfers/offramp",
    {
      amount: scaledAmount, // Scaled amount as string
      currency,
      purposeCode,
    },
    token
  );
}

/**
 * Get balances across different networks
 * @param token The authentication token
 * @returns Promise with balances information
 */
export async function getWalletBalances(
  token: string
): Promise<WalletBalancesResponse> {
  return await api.get("/api/transfers/balances", token);
}

/**
 * Check if user has sufficient balance for a transaction
 * @param token The authentication token
 * @param amount The amount to transfer as a string
 * @returns Promise with balance check result
 */
export async function checkSufficientBalance(
  token: string,
  amount: string
): Promise<{
  hasSufficientBalance: boolean;
  balance: string;
  walletId?: string;
}> {
  try {
    // Get default wallet
    const defaultWallet = await walletService.getDefaultWallet(token);

    // Get wallet balance
    const balanceInfo = await walletService.getDefaultWalletBalance(token);

    // Parse amounts
    const parsedAmount = parseFloat(amount);
    const currentBalance = parseFloat(balanceInfo.balance);

    return {
      hasSufficientBalance: currentBalance >= parsedAmount,
      balance: balanceInfo.balance,
      walletId: defaultWallet.id,
    };
  } catch (error) {
    console.error("Error checking balance:", error);
    throw new Error("Failed to check wallet balance");
  }
}

/**
 * Send batch transfers to multiple recipients
 * @param token The authentication token
 * @param requests The batch transfer requests
 * @returns Promise with the response
 */
export async function sendBatchTransfers(
  token: string,
  requests: Array<{
    requestId: string;
    request: {
      email: string;
      payeeId?: string;
      amount: string;
      purposeCode: string;
      currency: string;
    };
  }>
): Promise<any> {
  return await api.post("/api/transfers/send-batch", { requests }, token);
}
