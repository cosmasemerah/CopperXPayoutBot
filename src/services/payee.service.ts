import * as api from "../utils/api";
import { Payee, PayeeResponse, CreatePayeeRequest } from "../types";

/**
 * Get all payees
 * @param token The authentication token
 * @param page The page number (default: 1)
 * @param limit The number of items per page (default: 10)
 * @param searchText Optional search term to filter payees
 * @returns Promise with payee data
 */
export async function getPayees(
  token: string,
  page: number = 1,
  limit: number = 10,
  searchText?: string
): Promise<PayeeResponse> {
  let url = `/api/payees?page=${page}&limit=${limit}`;
  if (searchText) {
    url += `&searchText=${encodeURIComponent(searchText)}`;
  }
  return await api.get<PayeeResponse>(url, token);
}

/**
 * Get a specific payee by ID
 * @param token The authentication token
 * @param id The payee ID
 * @returns Promise with payee data
 */
export async function getPayeeById(token: string, id: string): Promise<Payee> {
  return await api.get<Payee>(`/api/payees/${id}`, token);
}

/**
 * Create a new payee
 * @param token The authentication token
 * @param payeeData The payee data to create
 * @returns Promise with the created payee
 */
export async function createPayee(
  token: string,
  payeeData: CreatePayeeRequest
): Promise<Payee> {
  return await api.post<Payee>("/api/payees", payeeData, token);
}

/**
 * Delete a payee
 * @param token The authentication token
 * @param id The payee ID to delete
 * @returns Promise with the response
 */
export async function deletePayee(
  token: string,
  id: string
): Promise<{ message: string; statusCode: number }> {
  return await api.del<{ message: string; statusCode: number }>(
    `/api/payees/${id}`,
    token
  );
}
