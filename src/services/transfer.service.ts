import * as api from "../utils/api";

/**
 * Send funds to an email address
 * @param token The authentication token
 * @param email The recipient's email
 * @param amount The amount to send
 * @param currency The currency code (default: "USD")
 * @param purposeCode The purpose code (default: "send")
 * @returns Promise with the response
 */
export async function sendToEmail(
  token: string,
  email: string,
  amount: string,
  currency: string = "USD",
  purposeCode: string = "send"
): Promise<any> {
  return await api.post(
    "/api/transfers/send",
    {
      email,
      amount,
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
 * @param currency The currency code (default: "USD")
 * @param network The network to use
 * @returns Promise with the response
 */
export async function sendToWallet(
  token: string,
  walletAddress: string,
  amount: string,
  currency: string = "USD",
  network: string
): Promise<any> {
  return await api.post(
    "/api/transfers/wallet-withdraw",
    {
      walletAddress,
      amount,
      currency,
      network,
    },
    token
  );
}

/**
 * Initiate a deposit to user's wallet
 * @param token The authentication token
 * @param amount The amount to deposit
 * @param chainId The chain ID (network) for the deposit
 * @param sourceOfFunds The source of funds (default: "external")
 * @returns Promise with deposit information
 */
export async function initiateDeposit(
  token: string,
  amount: string,
  chainId: string,
  sourceOfFunds: string = "external"
): Promise<any> {
  return await api.post(
    "/api/transfers/deposit",
    {
      amount,
      sourceOfFunds,
      depositChainId: chainId,
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
): Promise<any> {
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
  purposeCode: string = "withdrawal"
): Promise<any> {
  return await api.post(
    "/api/transfers/offramp",
    {
      amount,
      currency,
      purposeCode,
    },
    token
  );
}
