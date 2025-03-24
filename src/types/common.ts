/**
 * Common types shared across different modules
 */

// Base interface for timestamps
export interface TimeStamps {
  createdAt: string;
  updatedAt: string;
}

// API Error response
export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
}
