/**
 * Utility functions for the application
 */

/**
 * Get user-friendly label for a purpose code
 * @param purposeCode The purpose code value
 * @returns User-friendly label
 */
export function getPurposeCodeLabel(purposeCode: string): string {
  switch (purposeCode) {
    case "self":
      return "Self Transfer";
    case "salary":
      return "Salary Payment";
    case "gift":
      return "Gift";
    case "income":
      return "Income";
    case "saving":
      return "Saving";
    case "education_support":
      return "Education Support";
    case "family":
      return "Family Support";
    case "home_improvement":
      return "Home Improvement";
    case "reimbursement":
      return "Reimbursement";
    default:
      return purposeCode;
  }
}

/**
 * Get list of all valid purpose codes with their labels
 * @returns Array of purpose code objects with code and label properties
 */
export function getPurposeCodes(): Array<{ code: string; label: string }> {
  return [
    { code: "self", label: "Self Transfer" },
    { code: "salary", label: "Salary Payment" },
    { code: "gift", label: "Gift" },
    { code: "income", label: "Income" },
    { code: "saving", label: "Saving" },
    { code: "education_support", label: "Education Support" },
    { code: "family", label: "Family Support" },
    { code: "home_improvement", label: "Home Improvement" },
    { code: "reimbursement", label: "Reimbursement" },
  ];
}

/**
 * Get user-friendly label for a source of funds code
 * @param sourceOfFunds The source of funds code
 * @returns User-friendly label
 */
export function getSourceOfFundsLabel(sourceOfFunds: string): string {
  switch (sourceOfFunds) {
    case "salary":
      return "Salary";
    case "savings":
      return "Savings";
    case "investment":
      return "Investment";
    case "business_income":
      return "Business Income";
    case "loan":
      return "Loan";
    case "lottery":
      return "Lottery";
    case "external":
      return "External Source";
    case "others":
      return "Other Sources";
    default:
      return sourceOfFunds
        .replace(/_/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase());
  }
}
