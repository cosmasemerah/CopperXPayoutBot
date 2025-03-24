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
