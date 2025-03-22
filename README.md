# CopperX Telegram Bot

A Telegram bot for the CopperX Payout API that enables users to deposit, withdraw, and transfer USDC directly from Telegram.

## Features

- User authentication with email OTP
- Wallet management
- Fund transfers to email addresses and external wallets
- Bank withdrawals
- Real-time deposit notifications
- Secure session management with encryption and auto-expiry

## Setup Instructions

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```
BOT_TOKEN=your_telegram_bot_token
PUSHER_KEY=your_pusher_key
PUSHER_CLUSTER=ap1
SESSION_ENCRYPTION_KEY=your_secure_random_key
```

For production, generate a secure random key for `SESSION_ENCRYPTION_KEY`. For example:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/copperx-telegram-bot.git
cd copperx-telegram-bot
```

2. Install dependencies:

```bash
npm install
```

3. Create a `data` directory for session storage:

```bash
mkdir -p data
```

4. Start the bot:

```bash
npm start
```

For development:

```bash
npm run dev
```

## Session Management

The bot includes a secure session management system with the following features:

- **Persistent Storage**: Sessions are stored encrypted on disk in `data/sessions.json`
- **Automatic Expiry**: Sessions expire after their token expires
- **Inactivity Timeout**: Users are automatically logged out after 30 minutes of inactivity
- **Encrypted Storage**: All session data is encrypted using AES-256-CBC

## Command Reference

Here are the available bot commands:

- `/start` - Start the bot
- `/login` - Log in to your CopperX account
- `/menu` - Display the main menu
- `/balance` - Check your wallet balance
- `/sendemail` - Send funds to an email address
- `/sendwallet` - Send funds to a wallet address
- `/withdrawbank` - Withdraw funds to your bank account
- `/history` - View your transaction history
- `/setdefaultwallet` - Set your default wallet
- `/deposit` - View deposit instructions
- `/profile` - View your profile information
- `/kyc` - Check your KYC/KYB status
- `/help` - Display help information
- `/logout` - Log out from your account

## Support

For support, please visit: [CopperX Community](https://t.me/copperxcommunity/2183)
