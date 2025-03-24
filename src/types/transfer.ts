import { TimeStamps } from "./common";

/**
 * Common transfer-related type definitions
 */

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

// Transfer mode enum
export enum TransferMode {
  ON_RAMP = "on_ramp",
  OFF_RAMP = "off_ramp",
  REMITTANCE = "remittance",
  ON_CHAIN = "on_chain",
}

// Bank account type enum
export enum BankAccountType {
  SAVINGS = "savings",
  CHECKING = "checking",
}

// Bank account interface
export interface BankAccount {
  bankName: string;
  bankAddress: string;
  bankAccountType: BankAccountType;
  bankRoutingNumber: string;
  bankAccountNumber: string;
  bankBeneficiaryName: string;
  swiftCode?: string;
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

// Customer interface
export interface Customer extends TimeStamps {
  id: string;
  name: string;
  businessName: string;
  email: string;
  country: string;
}

// Account interface
export interface Account extends TimeStamps {
  id: string;
  organizationId: string;
  type: AccountType;
  walletAccountType: string;
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

// Balance check response
export interface BalanceCheckResponse {
  hasSufficientBalance: boolean;
  balance: number;
}

// Transfer to email request
export interface EmailTransferRequest {
  email: string;
  amount: string;
  currency: string;
  purposeCode: PurposeCode;
}

// Transfer to wallet request
export interface WalletTransferRequest {
  walletAddress: string;
  amount: string;
  currency: string;
  network: string;
  purposeCode: PurposeCode;
}

// Bank withdrawal request
export interface BankWithdrawalRequest {
  amount: string;
  currency: string;
}

// Batch transfer request and response
export interface BatchTransferRequest {
  requestId: string;
  request: {
    email: string;
    payeeId?: string;
    amount: string;
    purposeCode: string;
    currency: string;
  };
}

export interface BatchTransferResponseItem {
  requestId: string;
  success: boolean;
  email: string;
  amount: string;
  message?: string;
}
