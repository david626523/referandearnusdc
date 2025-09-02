# Telegram Refer and Earn Bot

A fully functional Telegram bot for refer and earn system with withdrawal functionality.

## Features

- 👥 Referral system with rewards
- 💰 Balance checking
- 🎁 Daily bonus (12-hour cooldown)
- 💸 Withdrawal system (minimum 100 RP)
- 📞 Contact admin functionality
- 🔗 Channel joining verification

## Setup Instructions

### 1. Database Setup (Supabase)

1. Create a new project on [Supabase](https://supabase.com)
2. Go to SQL Editor and run the contents of `supabase.sql`
3. Get your project URL and anon key from Project Settings > API

### 2. Local Development

1. Clone this repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and fill in your values:
   ```
   TELEGRAM_BOT_TOKEN=your_bot_token
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   CHANNEL_1=@your_channel1
   CHANNEL_2=@your_channel2
   RENDER_URL=your_render_url_when_deployed
   ```
4. Run locally: `npm start`

### 3. Deploy to Render

1. Push your code to GitHub/GitLab
2. Create a new Web Service on [Render](https://render.com)
3. Connect your repository
4. Render will automatically detect the `render.yaml` configuration
5. Set the following environment variables in Render dashboard:
   - `TELEGRAM_BOT_TOKEN`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `CHANNEL_1`
   - `CHANNEL_2`
   - `RENDER_URL` (your deployed service URL)
6. Deploy!

### 4. Set Bot Webhook

After deployment, your bot webhook will be automatically set to:
`https://your-service-name.onrender.com/webhook`

## Bot Commands

- `/start` - Start the bot and join channels
- `💰 Balance` - Check current balance
- `👥 Refer` - Get referral link
- `💸 Withdraw` - Request withdrawal (min 100 RP)
- `🎁 Bonus` - Claim daily bonus (5 RP every 12 hours)
- `📞 Contact` - Contact admin

## Reward System

- **New user referral**: Both referrer and referee get 20 RP
- **Daily bonus**: 5 RP every 12 hours
- **Minimum withdrawal**: 100 RP

## Tech Stack

- Node.js
- Express.js
- node-telegram-bot-api
- Supabase (PostgreSQL)
- Render (Hosting)

## License

ISC
