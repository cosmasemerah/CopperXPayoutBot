# Copperx Payout Telegram Bot 🤖

A full-featured Telegram bot that integrates with Copperx Payout's API, allowing users to manage their stablecoin finances directly through Telegram.

## 📋 Project Overview

This Telegram bot serves as a mobile interface for Copperx Payout, a stablecoin banking platform for individuals and businesses. The bot enables users to perform a wide range of financial operations without having to visit the web application.

### Core Functionalities

- **🔐 Authentication**: Secure login with email OTP verification
- **👛 Wallet Management**: View balances, addresses, and set default wallets
- **💸 Fund Transfers**: Send USDC to emails or wallet addresses
- **🏦 Bank Withdrawals**: Withdraw funds to connected bank accounts
- **📋 Payee Management**: Add, list, and remove saved payees
- **📥 Deposits**: Generate wallet addresses and QR codes for deposits
- **🔔 Real-time Notifications**: Receive notifications for deposits
- **📊 Transaction History**: View recent transfer activity
- **👤 Profile Management**: View account details and KYC status

## 🏗️ Project Structure

The codebase is organized into a modular, maintainable structure:

```
copperx-telegram-bot/
├── data/                  # Data storage files (sessions)
├── src/
│   ├── commands/          # Bot command implementations
│   │   ├── auth/          # Authentication commands
│   │   ├── profile/       # Profile-related commands
│   │   ├── transfer/      # Transfer & payment commands
│   │   ├── wallet/        # Wallet management commands
│   │   └── ...
│   ├── core/              # Core components and services
│   │   ├── command.ts     # Command registry and base classes
│   │   ├── middleware.ts  # Bot middleware functions
│   │   └── session.service.ts # Session management
│   ├── services/          # API integration services
│   ├── types/             # TypeScript type definitions
│   ├── utils/             # Utility functions
│   ├── config.ts          # Configuration module
│   └── index.ts           # Application entry point
├── tests/                 # Test files
├── .env                   # Environment variables (gitignored)
├── package.json           # Project dependencies
└── tsconfig.json          # TypeScript configuration
```

## 🔧 Architecture and Design

The bot is built with a modular architecture that prioritizes:

### Command Pattern

Each bot feature is implemented as a standalone command class that extends the `BotCommand` interface, with methods for:

- Executing commands from direct user input (`/command`)
- Handling callback queries (button presses)
- Managing multi-step processes with state management

### Centralized Session Management

The `SessionService` provides a robust session management system:

- Secure token storage and refresh
- Persistent sessions with encryption
- State tracking for multi-step flows
- Automatic session cleanup and expiration

### Standardized Error Handling

The bot implements consistent error handling across all commands:

- API error responses are formatted into user-friendly messages
- Network errors show appropriate recovery options
- Rate limit handling with backoff strategies

### Type Safety

The codebase uses TypeScript throughout:

- Strongly typed API responses
- Interface definitions for all data structures
- Type guards for runtime safety

## 🚀 Setup Instructions

### Prerequisites

- Node.js v16+
- npm or yarn
- A Telegram Bot Token (obtained from [@BotFather](https://t.me/botfather))
- Copperx API credentials

### Environment Variables

The project includes a `.env.example` file with all the required environment variables. To set up your environment:

1. Copy the example file to create your own `.env` file:

   ```bash
   cp .env.example .env
   ```

2. Edit the `.env` file and replace the placeholder values with your actual credentials:

   ```
   # Bot Configuration
   BOT_TOKEN=your_telegram_bot_token
   # BOT_WEBHOOK_URL=your_webhook_url_for_production

   # API Configuration
   API_BASE_URL=https://income-api.copperx.io
   API_TIMEOUT=30000

   # Pusher Configuration (for real-time notifications)
   PUSHER_KEY=e089376087cac1a62785
   PUSHER_CLUSTER=ap1

   # Session Configuration
   SESSION_ENCRYPTION_KEY=generate_a_secure_random_key
   # SESSION_SAVE_PATH=./data/sessions.json

   # Logging (options: error, warn, info, debug)
   LOG_LEVEL=info

   # Server Configuration
   PORT=3000
   ```

3. At minimum, you must set:
   - `BOT_TOKEN`: Obtain from [@BotFather](https://t.me/botfather)
   - `SESSION_ENCRYPTION_KEY`: Generate a secure random string

To generate a secure random key for `SESSION_ENCRYPTION_KEY`, you can use:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/copperx-telegram-bot.git
cd copperx-telegram-bot

# Install dependencies
npm install

# Build the project
npm run build

# Start the bot
npm start
```

### Development Mode

```bash
# Run in development mode with hot reloading
npm run dev
```

## 📝 Command Reference

### Authentication Commands

- `/start` - Begin interaction with the bot
- `/login` - Start the login process
- `/logout` - End your current session

### Wallet Commands

- `/balance` - Check your wallet balances
- `/wallets` - View your wallet addresses
- `/deposit` - Get deposit instructions

### Transfer Commands

- `/send` - Start a new transfer
- `/addpayee` - Add a new payee
- `/listpayees` - List saved payees
- `/removepayee` - Remove a saved payee

### Bank Withdrawal

- Initiated through the main menu
- Multi-step process with amount entry and confirmation

### Profile Commands

- `/profile` - View your account details
- `/kyc` - Check your KYC status

### Other Commands

- `/menu` - Show the main menu
- `/help` - Get usage instructions
- `/history` - View recent transactions
- `/notifications` - Toggle deposit notifications

## 🔌 API Integration

### Authentication Flow

The bot implements a secure authentication flow using Copperx's email OTP system:

1. User initiates login with email
2. System sends a one-time password to the email
3. User enters the OTP in the bot
4. Bot validates the OTP and establishes a session

### Session Management

- Sessions are encrypted and stored locally
- Access tokens are refreshed automatically when needed
- Idle sessions expire after configurable timeouts

### Security Considerations

- No passwords are ever stored
- Tokens are encrypted at rest
- Sensitive data is never logged
- Rate limiting is implemented for authentication attempts
- Session state is preserved securely between restarts

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- --grep "Authentication"

# Generate test coverage report
npm run test:coverage
```

### Test Structure

- Unit tests for utilities and services
- Integration tests for API services
- Command tests with mocked bot instances

## 📦 Deployment

### Health Check Endpoint

The application includes a built-in HTTP server that serves as a health check endpoint. This is particularly useful for hosting platforms that require health checks to determine if the application is running properly.

- The health check server runs on port 3000 by default (configurable via the `PORT` environment variable)
- It responds to all HTTP requests with a 200 status code and the message "CopperX Telegram Bot is running!"
- The server is automatically started when the application starts

When deploying to platforms like Render.com or Heroku, you can configure their health check to point to this endpoint to ensure the application is properly monitored.

### Deploying on Render.com

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Set the build command: `npm install && npm run build`
4. Set the start command: `npm start`
5. Add all required environment variables
6. Set the health check path to `/` on port 3000
7. Deploy the service

### Setting Up Webhook (Production)

For production environments, configure the bot to use webhooks:

```bash
# Set webhook URL (replace with your actual deployed URL)
curl -F "url=https://your-app.onrender.com/bot-webhook" https://api.telegram.org/bot<BOT_TOKEN>/setWebhook
```

## 📋 Additional Information

### Maintenance Tips

- Check the logs regularly for error patterns
- Monitor API response times and error rates
- Update dependencies periodically for security fixes
- Test thoroughly after any API changes

### Contributing Guidelines

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Future Improvements

- Implement automated testing pipelines
- Add support for multiple languages
- Enhance error reporting and monitoring
- Implement caching for frequently accessed data
- Add support for additional transfer methods

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgements

- [Copperx](https://copperx.io/) for their API and support
- [node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api) library
- [Pusher](https://pusher.com/) for real-time notifications

---

Built with ❤️ for [Superteam Earn](https://superteam.fun/)
