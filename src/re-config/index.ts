import dotenv from "dotenv";

dotenv.config();

export const config = {
  botToken: process.env.BOT_TOKEN || "",
  apiBaseUrl: "https://income-api.copperx.io",
  pusher: {
    key: process.env.PUSHER_KEY || "",
    cluster: process.env.PUSHER_CLUSTER || "ap1",
  },
  supportLink: "https://t.me/copperxcommunity/2183",
  session: {
    encryptionKey:
      process.env.SESSION_ENCRYPTION_KEY ||
      "default-secure-key-for-local-development-only",
    inactivityTimeout: 5 * 24 * 60 * 60 * 1000, // 5 days in milliseconds
  },
};

// Validation
const required = ["botToken", "pusher.key", "pusher.cluster"];
required.forEach((key) => {
  const keys = key.split(".");
  let value: any = config;
  for (const k of keys) {
    value = value?.[k];
    if (value === undefined) break;
  }

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
});
