import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";
import { config } from "../config";

// Create axios instance with base URL
const apiClient = axios.create({
  baseURL: config.apiBaseUrl,
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * Log API error details with full validation messages
 * @param error The error object
 * @param config The request configuration
 */
function logApiError(error: any, config: any) {
  console.error("API Error Response:", {
    status: error.response?.status,
    headers: error.response?.headers,
    data: error.response?.data,
  });

  // Log the full validation messages
  if (
    error.response?.data?.message &&
    Array.isArray(error.response.data.message)
  ) {
    console.log(
      "Validation Errors (Full Details):",
      JSON.stringify(error.response.data.message, null, 2)
    );
  }

  console.log("API Request Config:", {
    method: config.method,
    url: config.url,
    data: config.data,
  });
}

/**
 * Make a GET request to the API
 * @param url The API endpoint
 * @param token Optional authentication token
 * @param options Additional axios options
 * @returns Promise with the response data
 */
export async function get<T>(
  url: string,
  token?: string,
  options?: AxiosRequestConfig
): Promise<T> {
  try {
    const config: AxiosRequestConfig = {
      ...options,
      headers: {
        ...(options?.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };

    const response: AxiosResponse<T> = await apiClient.get(url, config);
    return response.data;
  } catch (error) {
    logApiError(error, { method: "get", url });
    handleApiError(error as AxiosError);
    throw error;
  }
}

/**
 * Make a POST request to the API
 * @param url The API endpoint
 * @param data The data to send
 * @param token Optional authentication token
 * @param options Additional axios options
 * @returns Promise with the response data
 */
export async function post<T>(
  url: string,
  data: any,
  token?: string,
  options?: AxiosRequestConfig
): Promise<T> {
  try {
    const config: AxiosRequestConfig = {
      ...options,
      headers: {
        ...(options?.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };

    const response: AxiosResponse<T> = await apiClient.post(url, data, config);
    return response.data;
  } catch (error) {
    logApiError(error, { method: "post", url, data });
    handleApiError(error as AxiosError);
    throw error;
  }
}

/**
 * Make a DELETE request to the API
 * @param url The API endpoint
 * @param token Optional authentication token
 * @param options Additional axios options
 * @returns Promise with the response data
 */
export async function del<T>(
  url: string,
  token?: string,
  options?: AxiosRequestConfig
): Promise<T> {
  try {
    const config: AxiosRequestConfig = {
      ...options,
      headers: {
        ...(options?.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };

    const response: AxiosResponse<T> = await apiClient.delete(url, config);
    return response.data;
  } catch (error) {
    logApiError(error, { method: "delete", url });
    handleApiError(error as AxiosError);
    throw error;
  }
}

/**
 * Handle API errors with detailed logging
 * @param error The axios error
 */
function handleApiError(error: AxiosError): void {
  if (error.response) {
    // The request was made and the server responded with a status code
    // that falls out of the range of 2xx
    console.error("API Error Response:", {
      status: error.response.status,
      headers: error.response.headers,
      data: error.response.data,
    });
  } else if (error.request) {
    // The request was made but no response was received
    console.error("API No Response:", error.request);
  } else {
    // Something happened in setting up the request that triggered an Error
    console.error("API Request Error:", error.message);
  }

  if (error.config) {
    console.error("API Request Config:", {
      method: error.config.method,
      url: error.config.url,
    });
  }
}
