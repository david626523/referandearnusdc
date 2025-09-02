require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');
const express = require('express');
const https = require('https');

const token = process.env.TELEGRAM_BOT_TOKEN;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const channel1 = process.env.CHANNEL_1;
const channel2 = process.env.CHANNEL_2;
const url = process.env.RENDER_URL;
const port = process.env.PORT || 3000;

// Determine if we're in production (Render) or local development
const isProduction = process.env.NODE_ENV === 'production' || (url && url !== 'YOUR_RENDER_URL');

let bot;
if (isProduction) {
  // Production: Use webhooks
  bot = new TelegramBot(token);
  console.log('Running in production mode with webhooks');
} else {
  // Development: Use polling
  bot = new TelegramBot(token, { polling: true });
  console.log('Running in development mode with polling');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Create Express app (for production)
const app = express();
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.send('Bot is running!');
});

// Webhook endpoint (for production)
app.post('/webhook', (req, res) => {
  if (isProduction) {
    bot.processUpdate(req.body);
  }
  res.sendStatus(200);
});

// Start the server
app.listen(port, async () => {
  console.log(`Server running on port ${port}`);
  
  // Set webhook only in production
  if (isProduction && url && url !== 'YOUR_RENDER_URL') {
    try {
      await bot.setWebHook(`${url}/webhook`);
      console.log('Webhook set successfully');
    } catch (error) {
      console.error('Failed to set webhook:', error.message);
    }
  } else if (isProduction) {
    console.log('Warning: RENDER_URL not set properly for production');
  }

  // Keep-alive mechanism for free Render plan
  if (isProduction && url && url !== 'YOUR_RENDER_URL') {
    setInterval(() => {
      try {
        https.get(url, (res) => {
          console.log(`Keep-alive ping: ${res.statusCode}`);
        }).on('error', (error) => {
          console.error('Keep-alive ping failed:', error.message);
        });
      } catch (error) {
        console.error('Keep-alive ping failed:', error.message);
      }
    }, 14 * 60 * 1000); // Ping every 14 minutes
  }
});

const userState = {};

bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username;
    const referrerId = msg.text.split(' ')[1];


    let { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

    if (error && error.code === 'PGRST116') {
        // User does not exist, create new user
        let newUser = { id: userId, username: username, balance: 0 };
        if (referrerId) {
            newUser.referred_by = referrerId;
            newUser.balance = 20; // Bonus for the new user
        }
        const { data: createdUser, error: createError } = await supabase
            .from('users')
            .insert([newUser], { returning: 'minimal' });

        if (createError) {
            console.error('Error creating user:', createError);
            return bot.sendMessage(chatId, 'An error occurred while creating your account.');
        }
        // We need to fetch the user again to get the full user object
        const { data: freshUser } = await supabase.from('users').select('*').eq('id', userId).single();
        user = freshUser;

        if (referrerId) {
            const numericReferrerId = parseInt(referrerId, 10);
            if (isNaN(numericReferrerId)) {
                console.error('Invalid referrerId:', referrerId);
                return;
            }
            // Add referral record
            await supabase.from('referrals').insert([{ referrer_id: numericReferrerId, referred_id: userId }]);
            
            // Update referrer's balance
            const { error: rpcError } = await supabase.rpc('increment_balance', { amount: 20, user_id: numericReferrerId });

            if(rpcError) {
                console.error('Error updating referrer balance:', rpcError);
            }
        }
    } else if (error) {
        console.error('Error fetching user:', error);
        return bot.sendMessage(chatId, 'An error occurred while fetching your account.');
    }

    if (!user.joined_channels) {
        userState[userId] = 'awaiting_join_check';
        const opts = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Channel 1', url: `https://t.me/${channel1.substring(1)}` }],
                    [{ text: 'Channel 2', url: `https://t.me/${channel2.substring(1)}` }],
                    [{ text: 'Check', callback_data: 'check_join' }]
                ]
            }
        };
        bot.sendMessage(chatId, 'Please join our channels to start using the bot.', opts);
    } else {
        sendMainMenu(chatId);
    }
});

bot.on('callback_query', async (callbackQuery) => {
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;
    const userId = callbackQuery.from.id;

    if (callbackQuery.data === 'check_join') {
        try {
            const member1 = await bot.getChatMember(channel1, userId);
            const member2 = await bot.getChatMember(channel2, userId);

            if ((member1.status === 'member' || member1.status === 'administrator' || member1.status === 'creator') &&
                (member2.status === 'member' || member2.status === 'administrator' || member2.status === 'creator')) {
                
                await supabase
                    .from('users')
                    .update({ joined_channels: true })
                    .eq('id', userId);
                
                bot.answerCallbackQuery(callbackQuery.id, { text: 'Thank you for joining!' });
                bot.deleteMessage(chatId, msg.message_id);
                sendMainMenu(chatId);
            } else {
                bot.answerCallbackQuery(callbackQuery.id, { text: 'You have not joined all channels.', show_alert: true });
            }
        } catch (error) {
            console.error(error);
            bot.answerCallbackQuery(callbackQuery.id, { text: 'An error occurred. Make sure the bot is an admin in the channels.', show_alert: true });
        }
    }
});

function sendMainMenu(chatId) {
    const opts = {
        reply_markup: {
            keyboard: [
                ['💰 Balance', '👥 Refer'],
                ['💸 Withdraw', '📞 Contact'],
                ['🎁 Bonus', '💎 Earn More']
            ],
            resize_keyboard: true,
            one_time_keyboard: false
        }
    };
    bot.sendMessage(chatId, '🎉 Welcome to the main menu! Choose an option below:', opts);
}

bot.onText(/💰 Balance/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    let { data: user, error } = await supabase
        .from('users')
        .select('balance')
        .eq('id', userId)
        .single();
    
    if (user) {
        bot.sendMessage(chatId, `Your current balance is: ${user.balance} RP.`);
    } else {
        bot.sendMessage(chatId, 'Could not retrieve your balance. Please /start the bot again.');
    }
});

bot.onText(/👥 Refer/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    try {
        const botUser = await bot.getMe();
        const referralLink = `https://t.me/${botUser.username}?start=${userId}`;
        bot.sendMessage(chatId, `Share this link to refer your friends and earn 20 RP:\n${referralLink}`);
    } catch (e) {
        console.error('Error getting bot username:', e);
        bot.sendMessage(chatId, 'Could not generate a referral link at this time.');
    }
});

bot.onText(/💸 Withdraw/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    const { data: user, error } = await supabase
        .from('users')
        .select('balance')
        .eq('id', userId)
        .single();

    if (error || !user) {
        console.error('Error fetching user for withdrawal:', error);
        return bot.sendMessage(chatId, '😟 Could not fetch your details. Please try again.');
    }

    if (user.balance >= 1000) {
        userState[userId] = 'awaiting_withdrawal_amount';
        bot.sendMessage(chatId, 'Please enter the amount you would like to withdraw.');
    } else {
        bot.sendMessage(chatId, `😟 You need at least 1000 RP to make a withdrawal. Your current balance is ${user.balance} RP.`);
    }
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    // This handler is for capturing the withdrawal amount after the user has been prompted.
    if (userState[userId] === 'awaiting_withdrawal_amount') {
        const amount = parseFloat(msg.text);

        if (isNaN(amount) || amount <= 0) {
            return bot.sendMessage(chatId, 'Invalid amount. Please enter a positive number.');
        }

        const { data: user, error: fetchError } = await supabase
            .from('users')
            .select('balance, withdrawal_request_amount')
            .eq('id', userId)
            .single();

        if (fetchError || !user) {
            userState[userId] = null; // Clear state
            return bot.sendMessage(chatId, '😟 Could not verify your balance. Please try the withdrawal process again.');
        }

        if (amount > user.balance) {
            return bot.sendMessage(chatId, `You cannot withdraw more than your current balance of ${user.balance} RP.`);
        }

        const newBalance = user.balance - amount;
        const newTotalWithdrawalRequest = (user.withdrawal_request_amount || 0) + amount;

        const { error: updateError } = await supabase
            .from('users')
            .update({
                balance: newBalance,
                withdrawal_request_amount: newTotalWithdrawalRequest
            })
            .eq('id', userId);

        if (updateError) {
            console.error('Error updating balance for withdrawal:', updateError);
            userState[userId] = null; // Clear state
            return bot.sendMessage(chatId, '😟 There was an error processing your request. Please try again.');
        }

        userState[userId] = null; // Clear state
        bot.sendMessage(chatId, `✅ Your withdrawal request for ${amount} RP has been submitted. Your total pending withdrawal is now ${newTotalWithdrawalRequest} RP.`);
    }
});

bot.onText(/📞 Contact/, (msg) => {
    const chatId = msg.chat.id;
    const adminUsername = 'botcryptoadmin1';
    bot.sendMessage(chatId, `For any queries, you can contact the admin here: @${adminUsername}`);
});

bot.onText(/💎 Earn More/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Visit this amazing earning platform! 🚀', {
        reply_markup: {
            inline_keyboard: [[
                {
                    text: '💎 Start Earning Now',
                    url: 'https://cryptoquestpro.netlify.app/'
                }
            ]]
        }
    });
});

bot.onText(/🎁 Bonus/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    const { data: user, error } = await supabase
        .from('users')
        .select('last_bonus_claim')
        .eq('id', userId)
        .single();

    if (error) {
        console.error('Error fetching user for bonus:', error);
        return bot.sendMessage(chatId, 'Could not process your bonus claim right now. Please try again later.');
    }

    const twelveHours = 12 * 60 * 60 * 1000; // 12 hours in milliseconds
    const now = new Date();
    const lastClaim = user.last_bonus_claim ? new Date(user.last_bonus_claim) : null;

    if (!lastClaim || (now.getTime() - lastClaim.getTime()) > twelveHours) {
        // User is eligible for the bonus
        const { error: rpcError } = await supabase.rpc('increment_balance', { amount: 5, user_id: userId });

        if (rpcError) {
            console.error('Error incrementing balance for bonus:', rpcError);
            return bot.sendMessage(chatId, 'Failed to claim bonus. Please try again.');
        }

        await supabase
            .from('users')
            .update({ last_bonus_claim: now.toISOString() })
            .eq('id', userId);

        bot.sendMessage(chatId, '🎉 Congratulations! You have successfully claimed your 5 RP bonus.');

    } else {
        // User is not eligible yet, calculate remaining time
        const timeRemaining = twelveHours - (now.getTime() - lastClaim.getTime());
        const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
        const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
        
        bot.sendMessage(chatId, `You have already claimed your bonus. Please wait for ${hours}h and ${minutes}m to claim it again.`);
    }
});

bot.on('polling_error', (error) => {
    console.error(`Bot error: ${error.code} - ${error.message}`);
});

// Keep the process alive
process.on('SIGINT', () => {
    console.log('Received SIGINT. Graceful shutdown...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('Received SIGTERM. Graceful shutdown...');
    process.exit(0);
});
