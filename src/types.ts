// User role types
export enum UserRole {
  OWNER = "owner",
  USER = "user",
  ADMIN = "admin",
  MEMBER = "member",
}

// User status types
export enum UserStatus {
  PENDING = "pending",
  ACTIVE = "active",
  SUSPENDED = "suspended ",
}

// User type
export enum CustomerProfileType {
  INDIVIDUAL = "individual",
  BUSINESS = "business",
}

// KYC status types
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

// KYC document types
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

// Transfer status types
export enum TransferStatus {
  PENDING = "pending",
  INITIATED = "initiated",
  PROCESSING = "processing",
  SUCCESS = "success",
  CANCELED = "canceled",
  FAILED = "failed",
  REFUNDED = "refunded",
}

// Base interface for timestamps
interface TimeStamps {
  createdAt: string;
  updatedAt: string;
}

// User interface
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

// Auth response interface
export interface AuthResponse {
  scheme: string;
  accessToken: string;
  accessTokenId: string;
  expireAt: string;
  user: User;
}

// KYC document interface
export interface KYCDocument extends TimeStamps {
  id: string;
  organizationId: string;
  kycDetailId: string;
  documentType: KYCDocumentType;
  status: KYCStatus;
  frontFileName: string;
  backFileName: string;
}

// KYC verification interface
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
// UBO Type enum
export type UBOType = "owner" | "signer" | "control";

// KYC detail interface
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

// Token balance Data Transfer Object
export interface BalanceResponse {
  decimals: number; // Number of decimal places
  balance: string; // Formatted balance with proper decimal places, example: 100.50
  symbol: "USDC" | "USDT" | "DAI" | "ETH" | "USDCE" | "STRK"; // Token symbol
  address: string; // Token contract address, example: 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174
}

// Wallet balance interface
export interface WalletBalance {
  walletId: string;
  isDefault: boolean;
  network: string;
  balances: BalanceResponse[];
}

// Deposit data interface for Pusher events
export interface DepositData {
  amount: string;
  network: string;
  transactionHash?: string;
  status: TransferStatus;
  timestamp: string;
}

// Session management interface
export interface UserSession {
  token: string;
  expireAt: Date;
  organizationId: string;
}
