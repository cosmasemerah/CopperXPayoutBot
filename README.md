# Copperx Payout Telegram Bot

A Telegram bot for managing Copperx payment operations directly from Telegram. This bot allows users to check balances, transfer funds, deposit, withdraw to bank accounts, and more.

## Features

- 🔑 User authentication with email and OTP
- 💰 Check wallet balances across multiple networks
- 📤 Send funds to email addresses and wallet addresses
- 🏧 Withdraw funds to bank accounts
- 📥 Generate deposit addresses with QR codes
- 📋 View transaction history
- 🔔 Real-time deposit notifications
- 📱 Interactive menus for easy navigation

## Setup Instructions

### Prerequisites

- Node.js (v14+)
- npm or yarn
- Telegram Bot Token (from BotFather)
- Pusher credentials (for real-time notifications)

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd copperx-telegram-bot
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:

   ```
   BOT_TOKEN=<your-telegram-bot-token>
   PUSHER_KEY=e089376087cac1a62785
   PUSHER_CLUSTER=ap1
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

### Deployment

The bot can be deployed to various platforms. Here's how to deploy it to Render.com:

1. Create a new Web Service on Render.com
2. Connect your GitHub repository
3. Set the build command: `npm install`
4. Set the start command: `npm run start`
5. Add the environment variables from the `.env` file

## Command Reference

The bot supports the following commands:

| Command             | Description                            |
| ------------------- | -------------------------------------- |
| `/start`            | Welcome message and introduction       |
| `/login`            | Authenticate with your Copperx account |
| `/logout`           | Sign out from the bot                  |
| `/profile`          | View your account details              |
| `/kyc`              | Check your KYC verification status     |
| `/balance`          | View your wallet balances              |
| `/setdefaultwallet` | Change your default wallet             |
| `/deposit`          | Get instructions for depositing USDC   |
| `/sendemail`        | Send funds to an email address         |
| `/sendwallet`       | Send funds to a wallet address         |
| `/withdrawbank`     | Withdraw funds to your bank account    |
| `/history`          | View your recent transactions          |
| `/menu`             | Show interactive menu with all options |
| `/unsubscribe`      | Disable deposit notifications          |
| `/help`             | Display all available commands         |

## User Flow Examples

### Withdraw to Bank Account

1. User sends `/withdrawbank` command
2. Bot prompts for amount (predefined options or custom)
3. User selects or enters amount
4. Bot asks for confirmation
5. User confirms the withdrawal
6. Bot processes the request and shows confirmation

### Send to Email

1. User sends `/sendemail` command
2. Bot prompts for recipient email
3. User provides email address
4. Bot prompts for amount
5. User selects or enters amount
6. Bot asks for confirmation
7. User confirms the transfer
8. Bot processes the request and shows confirmation

## Troubleshooting

### Common Issues

- **Login Failure**: Ensure you're using the correct email address registered with Copperx. Check your inbox for the OTP and enter it correctly.

- **Transfer Failures**:

  - Check if you have sufficient balance
  - Verify recipient details are correct
  - Ensure your KYC is approved for larger transfers

- **Withdrawal Issues**:

  - Bank account must be set up on the Copperx platform first
  - KYC verification must be completed
  - Minimum withdrawal amount may apply

- **API Connection Issues**:
  - Verify your internet connection
  - Check if the Copperx API is operational
  - Your session may have expired; try logging in again

### Support

If you encounter persistent issues, please contact Copperx support at:

- Telegram Community: https://t.me/copperxcommunity/2183
- Email: support@copperx.io

## Development

### Project Structure

- `src/index.ts` - Main entry point and bot initialization
- `src/handlers/` - Command and callback handlers
- `src/services/` - API service functions
- `src/utils/` - Utility functions
- `src/types.ts` - TypeScript interfaces
- `src/session.ts` - Session management
- `src/config/index.ts` - Configuration

### Adding New Commands

1. Create handler functions in the appropriate handler file
2. Register the handlers in the main `index.ts` file
3. Update the `/help` command with the new command
4. Add to the interactive menu if applicable

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Copperx team for the API
- Telegram Bot API for enabling bot functionality
