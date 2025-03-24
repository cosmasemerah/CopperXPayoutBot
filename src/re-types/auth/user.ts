import { TimeStamps } from "../common";

/**
 * User role types
 */
export enum UserRole {
  OWNER = "owner",
  USER = "user",
  ADMIN = "admin",
  MEMBER = "member",
}

/**
 * User status types
 */
export enum UserStatus {
  PENDING = "pending",
  ACTIVE = "active",
  SUSPENDED = "suspended ",
}

/**
 * User profile types
 */
export enum CustomerProfileType {
  INDIVIDUAL = "individual",
  BUSINESS = "business",
}

/**
 * Wallet account types
 */
export enum WalletAccountType {
  WEB3_AUTH_COPPERX = "web3_auth_copperx",
  SAFE = "safe",
  CIRCLE_DEV = "circle_dev",
  EOA = "eoa",
  OTHER = "other",
  QUANTUM = "quantum",
}

/**
 * User interface
 */
export interface User extends TimeStamps {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  profileImage: string;
  organizationId: string;
  role: UserRole;
  status: UserStatus;
  type: CustomerProfileType;
  relayerAddress: string;
  flags: string[];
  walletAddress?: string;
  walletId?: string;
  walletAccountType?: string;
}

/**
 * User session interface
 */
export interface UserSession {
  token: string;
  expireAt: Date;
  organizationId: string;
}
