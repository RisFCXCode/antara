import { Telegraf, Context, Markup } from 'telegraf';
// @ts-ignore
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Telegram Bot
const botToken = process.env.TELEGRAM_BOT_TOKEN || '';
const bot = new Telegraf(botToken);

// Helper to manage session state in Supabase
async function getSession(chatId: number) {
  const { data, error } = await supabase.from('bot_sessions').select('*').eq('id', chatId).single();
  if (error && error.code !== 'PGRST116') {
    throw new Error(`DB Get Error: ${error.message}`);
  }
  return data ? data : null;
}

async function saveSession(chatId: number, sessionData: any) {
  const { data, error } = await supabase.from('bot_sessions')
    .upsert({ id: chatId, ...sessionData, updated_at: new Date().toISOString() })
    .select();
  if (error) {
    throw new Error(`DB Save Error: ${error.message}`);
  }
  return data;
}

async function clearSession(chatId: number) {
  await supabase.from('bot_sessions').delete().eq('id', chatId);
}

// Bot Conversational Logic
bot.command('start', async (ctx) => {
  if (!ctx.chat) return;
  await saveSession(ctx.chat.id, { 
    step: 'awaiting_name', 
    data: { items: [], discount_type: 'none', discount_value: 0, discount_amount: 0, subtotal: 0, total: 0 } 
  });
  await ctx.reply("👋 Welcome to Antara Batik (Offline Cloud Mode)!\nLet's create your document.\n\nWhat is the customer's full name?");
});

bot.command('new', async (ctx) => {
  if (!ctx.chat) return;
  await saveSession(ctx.chat.id, { 
    step: 'awaiting_name', 
    data: { items: [], discount_type: 'none', discount_value: 0, discount_amount: 0, subtotal: 0, total: 0 } 
  });
  await ctx.reply("👋 Welcome to Antara Batik (Offline Cloud Mode)!\nLet's create your document.\n\nWhat is the customer's full name?");
});

bot.command('cancel', async (ctx) => {
  if (!ctx.chat) return;
  await clearSession(ctx.chat.id);
  await ctx.reply("❌ Session cancelled. Type /new to start over.");
});

bot.command('debug', async (ctx) => {
  if (!ctx.chat) return;
  try {
    const session = await getSession(ctx.chat.id);
    if (!session) {
      await ctx.reply(`🔧 Debug: No session found for ID ${ctx.chat.id} in Supabase.`);
    } else {
      await ctx.reply(`🔧 Debug Session: ${JSON.stringify(session, null, 2)}`);
    }
  } catch (err: any) {
    await ctx.reply(`🔧 Debug Error: ${err.message}`);
  }
});

bot.catch((err, ctx) => {
  console.error('Telegraf Error:', err);
  if (ctx && ctx.reply) {
    ctx.reply(`⚠️ Internal Bot Error: ${String(err)}`).catch(() => {});
  }
});

bot.on('text', async (ctx) => {
  if (!ctx.chat) return;
  const session = await getSession(ctx.chat.id);
  if (!session || !session.step) {
    return ctx.reply('Please type /new to start a document session.');
  }

  const text = ctx.message.text || '';
  const { step, data } = session;

  switch (step) {
    case 'awaiting_name':
      if (text.trim().length < 2) return ctx.reply("❌ Name too short. Enter the customer's full name:");
      data.customer_name = text.trim();
      session.step = 'awaiting_phone';
      await saveSession(ctx.chat.id, session);
      await ctx.reply('📞 Contact phone number?');
      break;

    case 'awaiting_phone':
      const phone = text.replace(/[^0-9+]/g, '');
      if (phone.length < 9) return ctx.reply('❌ Invalid phone number. (9-15 digits):');
      data.customer_phone = phone;
      session.step = 'awaiting_billing';
      await saveSession(ctx.chat.id, session);
      await ctx.reply('🏠 Billing address?');
      break;

    case 'awaiting_billing':
      data.billing_address = text.trim();
      session.step = 'awaiting_delivery';
      await saveSession(ctx.chat.id, session);
      await ctx.reply('📦 Delivery address?\n(Type "same" to use billing address)');
      break;

    case 'awaiting_delivery':
      data.delivery_address = text.toLowerCase().trim() === 'same' ? data.billing_address : text.trim();
      session.step = 'awaiting_email';
      await saveSession(ctx.chat.id, session);
      await ctx.reply('📧 Email address? (Type "skip" if none)');
      break;

    case 'awaiting_email':
      data.customer_email = text.toLowerCase() === 'skip' ? '' : text.trim();
      session.step = 'awaiting_doc_type';
      await saveSession(ctx.chat.id, session);
      await ctx.reply('Select document type:', Markup.inlineKeyboard([
        Markup.button.callback('Invoice', 'type_pending'),
        Markup.button.callback('Receipt', 'type_paid')
      ]));
      break;
      
    case 'awaiting_doc_type':
      break;
  }
});

bot.on('callback_query', async (ctx) => {
  if (!ctx.chat) return;
  const session = await getSession(ctx.chat.id);
  if (!session) return;
  
  const cbQuery = ctx.callbackQuery as any;
  const action = cbQuery.data;

  if (action === 'type_pending' || action === 'type_paid') {
    const status = action === 'type_pending' ? 'pending' : 'paid';
    
    // Finalize invoice and push to Supabase
    const newInvoice = {
      id: `INV-${Date.now()}`,
      ...session.data,
      status: status,
      created_at: new Date().toISOString()
    };
    
    await supabase.from('invoices').insert(newInvoice);
    await clearSession(ctx.chat.id);
    
    await ctx.editMessageText(`✅ Document finalized and saved to Cloud Database!\n\nID: ${newInvoice.id}\nCustomer: ${newInvoice.customer_name}\n\nWeb Link: https://example.com/view/${newInvoice.id}`);
  }
});

// Vercel Serverless HTTP Handler
export default async function handler(req: any, res: any) {
  if (!botToken) {
    return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN missing' });
  }

  // Handle Telegram Webhook POST requests
  if (req.method === 'POST') {
    try {
      await bot.handleUpdate(req.body, res);
      if (!res.headersSent) {
        res.status(200).send('OK');
      }
    } catch (error: any) {
      console.error('Webhook error:', error);
      // Reply to telegram with the exact error so the user can see it
      if (req.body && req.body.message && req.body.message.chat) {
         try {
           await bot.telegram.sendMessage(req.body.message.chat.id, `⚠️ System Error: ${error.message}`);
         } catch(e) {}
      }
      res.status(500).send('Internal Server Error');
    }
  } else {
    res.status(200).json({ status: 'Online', engine: 'Vercel Serverless', bot: 'Antara Batik' });
  }
}
