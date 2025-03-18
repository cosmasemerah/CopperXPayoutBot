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
