/**
 * A utility script to debug and view API error messages
 * Run with: node scripts/debug-error.js
 */

// Recreate a sample error response structure from the logs
const errorResponse = {
  status: 422,
  data: {
    statusCode: 422,
    error: "Validation failed",
    message: [
      // The [Array] contents will be visible here
      // You can manually copy the actual array content here after running your bot
      // This is just a placeholder
      {
        property: "amount",
        constraints: {
          min: "amount must be greater than or equal to 100000000",
        },
      },
    ],
  },
};

// Pretty print the full error details
console.log("=== API Error Details ===");
console.log(JSON.stringify(errorResponse.data, null, 2));

// Extract validation error messages in a user-friendly format
let errorMessage = "Validation failed";

if (Array.isArray(errorResponse.data.message)) {
  errorMessage = errorResponse.data.message
    .map((err) => {
      // Handle different error formats
      if (typeof err === "string") return err;
      if (err.message) return err.message;
      if (err.property && err.constraints) {
        return `${err.property}: ${Object.values(err.constraints).join(", ")}`;
      }
      return JSON.stringify(err);
    })
    .join("; ");
}

console.log("\n=== User-Friendly Error Message ===");
console.log(errorMessage);

// Also show what the Copperx requirements are based on the documentation
console.log("\n=== Copperx API Requirements ===");
console.log("Amount validation:");
console.log("- Must be a string representation of an integer");
console.log("- Minimum value: 100000000 (1 USDC)");
console.log("- Maximum value: 5000000000000 (50,000 USDC)");
console.log('- Example: To send 10 USDC, use the value "1000000000"');
