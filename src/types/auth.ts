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

import { TimeStamps } from "./common";

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
}

/**
 * User session interface
 */
export interface UserSession {
  token: string;
  expireAt: Date;
  organizationId: string;
}

/**
 * KYC status types
 */
export enum KYCStatus {
  PENDING = "pending",
  INITIATED = "initiated",
  INPROGRESS = "inprogress",
  REVIEW_PENDING = "review_pending",
  REVIEW = "review",
  PROVIDER_MANUAL_REVIEW = "provider_manual_review",
  MANUAL_REVIEW = "manual_review",
  PROVIDER_ON_HOLD = "provider_on_hold",
  ON_HOLD = "on_hold",
  EXPIRED = "expired",
  APPROVED = "approved",
  REJECTED = "rejected",
}

/**
 * KYC document types
 */
export enum KYCDocumentType {
  PASSPORT = "passport",
  AADHAR_CARD = "aadhar_card",
  PAN_CARD = "pan_card",
  DRIVING_LICENSE = "driving_license",
  NATIONAL_ID = "national_id",
  TAX_ID = "tax_id",
  VOTER_ID = "voter_id",
  UTILITY_BILL = "utility_bill",
  BANK_STATEMENT = "bank_statement",
  PROOF_OF_ADDRESS = "proof_of_address",
  OTHER = "other",
}

/**
 * KYC document interface
 */
export interface KYCDocument extends TimeStamps {
  id: string;
  organizationId: string;
  kycDetailId: string;
  documentType: KYCDocumentType;
  status: KYCStatus;
  frontFileName: string;
  backFileName: string;
}

/**
 * KYC verification interface
 */
export interface KYCVerification extends TimeStamps {
  id: string;
  organizationId: string;
  kycDetailId: string;
  kycProviderCode: string;
  externalCustomerId: string;
  externalKycId: string;
  status: KYCStatus;
  externalStatus: string;
  verifiedAt: string;
}

/**
 * UBO Type
 */
export type UBOType = "owner" | "signer" | "control";

/**
 * KYC detail interface
 */
export interface KYCDetail extends TimeStamps {
  id: string;
  organizationId: string;
  kybDetailId?: string;
  nationality: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  email: string;
  phoneNumber: string;
  dateOfBirth: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  positionAtCompany?: string;
  sourceOfFund?: string;
  currentKycVerificationId: string;
  currentKycVerification: KYCVerification;
  kycDocuments: KYCDocument[];
  kycUrl?: string;
  uboType?: UBOType;
  percentageOfShares?: number;
  joiningDate?: string;
}

/**
 * KYC response data interface
 */
export interface KYCData {
  id: string;
  organizationId: string;
  status: KYCStatus;
  type: CustomerProfileType;
  country: string;
  providerCode: string;
  kycProviderCode: string;
  kycDetailId: string;
  kybDetailId?: string;
  kycDetail: KYCDetail;
  statusUpdates: string;
}

/**
 * KYC response interface
 */
export interface KYCResponse {
  page: number;
  limit: number;
  count: number;
  hasMore: boolean;
  data: KYCData[];
}
