import { User, AuthResponse, KYCResponse } from "../types";
import * as api from "../utils/api";

/**
 * Request an email OTP
 * @param email The email address to send the OTP to
 * @returns Promise with the response data
 */
export async function requestEmailOTP(
  email: string
): Promise<{ email: string; sid: string }> {
  return await api.post<{ email: string; sid: string }>(
    "/api/auth/email-otp/request",
    { email }
  );
}

/**
 * Authenticate with an email OTP
 * @param email The email address
 * @param otp The OTP code
 * @param sid The session ID from the OTP request
 * @returns Promise with the authentication response
 */
export async function authenticateWithOTP(
  email: string,
  otp: string,
  sid: string
): Promise<AuthResponse> {
  return await api.post<AuthResponse>("/api/auth/email-otp/authenticate", {
    email,
    otp,
    sid,
  });
}

/**
 * Get the user profile
 * @param token The authentication token
 * @returns Promise with the user data
 */
export async function getUserProfile(token: string): Promise<User> {
  return await api.get<User>("/api/auth/me", token);
}

/**
 * Get the user's KYC status
 * @param token The authentication token
 * @returns Promise with the KYC response
 */
export async function getKYCStatus(token: string): Promise<KYCResponse> {
  return await api.get<KYCResponse>("/api/kycs", token);
}
