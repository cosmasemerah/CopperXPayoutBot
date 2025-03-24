import { User } from "./user";

/**
 * OTP Request response interface
 */
export interface OTPRequestResponse {
  email: string;
  sid: string;
}

/**
 * OTP state interface for managing OTP verification flow
 */
export interface OTPState {
  email: string;
  sid: string;
}

/**
 * Auth response interface
 */
export interface AuthResponse {
  scheme: string;
  accessToken: string;
  accessTokenId: string;
  expireAt: string;
  user: User;
}

/**
 * API message response
 */
export interface ApiMessageResponse {
  message: string;
  statusCode: number;
}
