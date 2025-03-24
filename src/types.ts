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
export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
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

// Transfer type enum
export enum TransferType {
  SEND = "send",
  RECEIVE = "receive",
  WITHDRAW = "withdraw",
  DEPOSIT = "deposit",
  BRIDGE = "bridge",
  BANK_DEPOSIT = "bank_deposit",
}

// Account type enum
export enum AccountType {
  WEB3_WALLET = "web3_wallet",
  BANK = "bank_account",
}

// Purpose code enum
export enum PurposeCode {
  SELF = "self",
  WITHDRAWAL = "withdrawal",
  SALARY = "salary",
  GIFT = "gift",
  INCOME = "income",
  SAVING = "saving",
  EDUCATION_SUPPORT = "education_support",
  FAMILY = "family",
  HOME_IMPROVEMENT = "home_improvement",
  REIMBURSEMENT = "reimbursement",
}

// Source of funds enum
export enum SourceOfFunds {
  SALARY = "salary",
  EXTERNAL = "external",
  SAVINGS = "savings",
  LOTTERY = "lottery",
  INVESTMENT = "investment",
  LOAN = "loan",
  BUSINESS_INCOME = "business_income",
  OTHERS = "others",
}

// Mode enum
export enum TransferMode {
  ON_RAMP = "on_ramp",
  OFF_RAMP = "off_ramp",
  REMITTANCE = "remittance",
  ON_CHAIN = "on_chain",
}

// Wallet type enum
export enum WalletAccountType {
  WEB3_AUTH_COPPERX = "web3_auth_copperx",
  SAFE = "safe",
  CIRCLE_DEV = "circle_dev",
  EOA = "eoa",
  OTHER = "other",
  QUANTUM = "quantum",
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

// KYC response interface
export interface KYCResponse {
  page: number;
  limit: number;
  count: number;
  hasMore: boolean;
  data: Array<{
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
  }>;
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

// ============== Transfer API interfaces ==============

// Customer interface
export interface Customer extends TimeStamps {
  id: string;
  name: string;
  businessName: string;
  email: string;
  country: string;
}

// Account status types
export enum AccountStatus {
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

export enum BankAccountType {
  SAVINGS = "savings",
  CHECKING = "checking",
}

export interface BankAccount {
  bankName: string;
  bankAddress: string;
  bankAccountType: BankAccountType;
  bankRoutingNumber: string;
  bankAccountNumber: string;
  bankBeneficiaryName: string;
  swiftCode?: string;
}

// Account interface
export interface Account extends TimeStamps {
  id: string;
  organizationId: string;
  type: AccountType;
  walletAccountType: WalletAccountType;
  country: string;
  network: string;
  walletAddress: string;
  isDefault: boolean;
  bankAccount: BankAccount;
  status: AccountStatus;
}

// Transaction interface
export interface Transaction extends TimeStamps {
  id: string;
  organizationId: string;
  type: TransferType;
  providerCode: string;
  kycId: string;
  transferId: string;
  status: TransferStatus;
  externalStatus: string;
  fromAccountId: string;
  toAccountId: string;
  fromAmount: string;
  fromCurrency: string;
  toAmount: string;
  toCurrency: string;
  totalFee: string;
  feeCurrency: string;
  transactionHash: string;
  depositAccount?: Account;
  externalTransactionId: string;
  externalCustomerId: string;
  depositUrl: string;
}

// Transfer response interface
export interface TransferResponse extends TimeStamps {
  id: string;
  organizationId: string;
  status: TransferStatus;
  customerId: string;
  customer?: Customer;
  type: TransferType;
  sourceCountry: string;
  destinationCountry: string;
  destinationCurrency: string;
  amount: string;
  currency: string;
  amountSubtotal: string;
  totalFee: string;
  feePercentage: string;
  feeCurrency: string;
  invoiceNumber?: string;
  invoiceUrl?: string;
  sourceOfFundsFile?: string;
  note?: string;
  purposeCode: string;
  sourceOfFunds: string;
  recipientRelationship: string;
  sourceAccountId: string;
  destinationAccountId: string;
  paymentUrl?: string;
  mode: TransferMode;
  isThirdPartyPayment: boolean;
  transactions?: Transaction[];
  sourceAccount?: Account;
  destinationAccount?: Account;
  senderDisplayName?: string;
}

// Transfer history response interface
export interface TransferHistoryResponse {
  page: number;
  limit: number;
  count: number;
  hasMore: boolean;
  data: TransferResponse[];
}

// Wallet balance response
export interface WalletBalancesResponse {
  balances: Array<{
    chainId: string;
    balance: string;
  }>;
}

// ============== Wallet API interfaces ==============

// Wallet interface
export interface Wallet extends TimeStamps {
  id: string;
  organizationId: string;
  walletType: WalletAccountType;
  network: string;
  walletAddress: string;
  isDefault: boolean;
}

// Set default wallet request
export interface SetDefaultWalletRequest {
  walletId: string;
}

// Generate wallet request
export interface GenerateWalletRequest {
  network: string;
}

// Payee Types
export interface Payee {
  id: string;
  createdAt: string;
  updatedAt: string;
  organizationId: string;
  nickName?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phoneNumber?: string;
  displayName?: string;
  bankAccount?: {
    country: string;
    bankName?: string;
    bankAddress?: string;
    type: string;
    bankAccountType?: string;
    bankRoutingNumber?: string;
    bankAccountNumber?: string;
    bankBeneficiaryName?: string;
    bankBeneficiaryAddress?: string;
    swiftCode?: string;
  };
  isGuest?: boolean;
  hasBankAccount?: boolean;
}

export interface PayeeResponse {
  page: number;
  limit: number;
  count: number;
  hasMore: boolean;
  data: Payee[];
}

export interface CreatePayeeRequest {
  nickName?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phoneNumber?: string;
  bankAccount?: {
    country: string;
    bankName?: string;
    bankAddress?: string;
    type: string;
    bankAccountType?: string;
    bankRoutingNumber?: string;
    bankAccountNumber?: string;
    bankBeneficiaryName?: string;
    bankBeneficiaryAddress?: string;
    swiftCode?: string;
  };
}

// Batch Transfer Request and Response types
export interface BatchTransferRequest {
  requestId: string;
  request: {
    email: string;
    amount: string;
    purposeCode: string;
    currency: string;
  };
}

export interface BatchTransferResponse {
  responses: Array<{
    requestId: string;
    request: {
      email: string;
      amount: string;
      purposeCode: string;
      currency: string;
    };
    response?: TransferResponse;
    error?: ApiError;
  }>;
}
