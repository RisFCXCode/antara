import { Telegraf, Context, Markup } from 'telegraf';
// @ts-ignore
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client
const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
const supabaseKey = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize Telegram Bot
const botToken = process.env.TELEGRAM_BOT_TOKEN || '';
const bot = new Telegraf(botToken);

import { generatePdfBuffer } from './pdf-generator';

export const maxDuration = 60; // Set max duration for Vercel Hobby tier

function calculateUnitPrice(qty: number): number {
  if (qty >= 1000) return 35;
  if (qty >= 500) return 37;
  if (qty >= 100) return 38;
  return 40;
}

function recalculateTotals(data: any) {
  let sub = 0;
  for (const item of (data.items || [])) {
    sub += item.total || 0;
  }
  data.subtotal = sub;

  let disc = 0;
  if (data.discount_type === 'percentage') {
    disc = sub * ((data.discount_value || 0) / 100);
  } else if (data.discount_type === 'fixed') {
    disc = data.discount_value || 0;
  }
  data.discount_amount = disc;
  data.total = Math.max(0, sub - disc);
}

function generateReferenceId(status: string) {
  const prefix = status === 'paid' ? 'REC' : 'INV';
  const timestamp = Date.now().toString().slice(-6);
  const randomStr = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}-${timestamp}-${randomStr}`;
}

// Helper to manage session state in Supabase
async function getSession(chatId: number) {
  const { data, error } = await supabase.from('bot_sessions').select('*').eq('id', chatId).single();
  if (error && error.code !== 'PGRST116') {
    throw new Error(`DB Get Error: ${error.message}`);
  }
  return data ? data : null;
}

async function saveSession(chatId: number, sessionData: any) {
  const { step, data } = sessionData;
  const { error } = await supabase.from('bot_sessions')
    .upsert({ id: chatId, step, data, updated_at: new Date().toISOString() })
    .select();
  if (error) {
    throw new Error(`DB Save Error: ${error.message}`);
  }
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
      
    case 'awaiting_quantity':
      const qty = parseFloat(text);
      if (isNaN(qty) || qty <= 0) return ctx.reply('❌ Invalid quantity. Please enter a number greater than 0.');
      
      const price = calculateUnitPrice(qty);
      if (!data.items) data.items = [];
      data.items.push({
        fabric_type: data.tempFabric || 'Unknown',
        pattern_name: '',
        quantity_meters: qty,
        price_per_meter: price,
        total: qty * price
      });
      recalculateTotals(data);
      
      session.step = 'awaiting_more_fabric';
      await saveSession(ctx.chat.id, session);
      await ctx.reply(
        `📊 Current Subtotal: RM ${data.subtotal?.toFixed(2)}\nWould you like to add another fabric?`,
        Markup.inlineKeyboard([
          Markup.button.callback('Yes, add more', 'add_fabric'),
          Markup.button.callback('No, proceed to discount', 'proceed_discount')
        ])
      );
      break;

    case 'awaiting_discount_val':
      const val = parseFloat(text);
      if (isNaN(val) || val < 0) return ctx.reply('❌ Invalid value. Please enter a positive number.');
      if (data.discount_type === 'fixed' && val >= (data.subtotal || 0)) return ctx.reply('❌ Discount cannot exceed the total amount.');
      if (data.discount_type === 'percentage' && val > 100) return ctx.reply('❌ Discount percentage cannot exceed 100.');
      
      data.discount_value = val;
      recalculateTotals(data);
      
      session.step = 'awaiting_confirmation';
      await saveSession(ctx.chat.id, session);
      
      const summaryText = `
─────────────────────
📊 Final Summary
─────────────────────
👤 Customer:  ${data.customer_name}
📞 Phone:     ${data.customer_phone}
📄 Type:      ${data.status === 'paid' ? 'Receipt' : 'Invoice'}
💰 Subtotal:  RM ${data.subtotal?.toFixed(2)}
📉 Discount:  - RM ${data.discount_amount?.toFixed(2)}
✅ Total:     RM ${data.total?.toFixed(2)}
─────────────────────
Please confirm your order details:`;
      await ctx.reply(summaryText, Markup.inlineKeyboard([
        Markup.button.callback('✅ Confirm', 'confirm_order'),
        Markup.button.callback('✏️ Edit', 'edit_order')
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
  const data = session.data;

  // Document Type
  if (action === 'type_pending' || action === 'type_paid') {
    data.status = action === 'type_paid' ? 'paid' : 'pending';
    session.step = 'awaiting_fabric';
    await saveSession(ctx.chat.id, session);
    await ctx.editMessageText('Select fabric type:', Markup.inlineKeyboard([
      Markup.button.callback('Dubai Cotton', 'fabric_dubai'),
      Markup.button.callback('Cotton Viscose', 'fabric_viscose')
    ]));
    return;
  }

  // Fabric Type
  if (action.startsWith('fabric_')) {
    data.tempFabric = action === 'fabric_dubai' ? 'Dubai Cotton' : 'Cotton Viscose';
    session.step = 'awaiting_quantity';
    await saveSession(ctx.chat.id, session);
    await ctx.editMessageText(`You selected ${data.tempFabric}.\nHow many meters?`);
    return;
  }
  
  // Add More Fabric
  if (action === 'add_fabric') {
    session.step = 'awaiting_fabric';
    await saveSession(ctx.chat.id, session);
    await ctx.editMessageText('Select next fabric type:', Markup.inlineKeyboard([
      Markup.button.callback('Dubai Cotton', 'fabric_dubai'),
      Markup.button.callback('Cotton Viscose', 'fabric_viscose')
    ]));
    return;
  }

  // Proceed to Discount
  if (action === 'proceed_discount') {
    session.step = 'awaiting_discount_type';
    await saveSession(ctx.chat.id, session);
    await ctx.editMessageText('Apply an adjustment?', Markup.inlineKeyboard([
      Markup.button.callback('% Discount', 'disc_percent'),
      Markup.button.callback('RM Discount', 'disc_fixed'),
      Markup.button.callback('No Discount', 'disc_none')
    ]));
    return;
  }

  // Discount Options
  if (action.startsWith('disc_')) {
    if (action === 'disc_none') {
      data.discount_type = 'none';
      recalculateTotals(data);
      session.step = 'awaiting_confirmation';
      await saveSession(ctx.chat.id, session);
      
      const summaryText = `
─────────────────────
📊 Final Summary
─────────────────────
👤 Customer:  ${data.customer_name}
📞 Phone:     ${data.customer_phone}
📄 Type:      ${data.status === 'paid' ? 'Receipt' : 'Invoice'}
💰 Subtotal:  RM ${data.subtotal?.toFixed(2)}
📉 Discount:  - RM ${data.discount_amount?.toFixed(2)}
✅ Total:     RM ${data.total?.toFixed(2)}
─────────────────────
Please confirm your order details:`;
      await ctx.editMessageText(summaryText, Markup.inlineKeyboard([
        Markup.button.callback('✅ Confirm', 'confirm_order'),
        Markup.button.callback('✏️ Edit', 'edit_order')
      ]));
    } else {
      data.discount_type = action === 'disc_percent' ? 'percentage' : 'fixed';
      session.step = 'awaiting_discount_val';
      await saveSession(ctx.chat.id, session);
      await ctx.editMessageText(`Enter ${data.discount_type} discount value (e.g. 10):`);
    }
    return;
  }

  // Confirmation
  if (action === 'confirm_order') {
    await ctx.editMessageText(
      '🎨 *Choose your PDF theme:*\n\n' +
      '• *Normal* — Dark luxury, liquid glass, branded Antara Batik style\n' +
      '• *White* — Clean corporate, minimal, print-optimised',
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          Markup.button.callback('🌙 Normal (Dark)', 'theme_normal'),
          Markup.button.callback('☀️ White (Corporate)', 'theme_white'),
        ])
      }
    );
  } else if (action === 'theme_normal' || action === 'theme_white') {
    const theme = action === 'theme_normal' ? 'normal' : 'white';
    await ctx.editMessageText('⏳ Generating your PDF in the Cloud... (This takes about 5 seconds)');
    
    // Finalize invoice and push to Supabase
    const newInvoice = {
      id: generateReferenceId(data.status),
      ...data,
      created_at: new Date().toISOString()
    };
    delete newInvoice.tempFabric;
    
    // Save to Database
    const { error: insertError } = await supabase.from('invoices').insert(newInvoice);
    if (insertError) {
      throw new Error(`Invoice Insert Error: ${insertError.message}`);
    }
    
    // Generate PDF via Sparticuz Chromium
    try {
      const pdfBuffer = await generatePdfBuffer(newInvoice as any, theme);
      const themeLabel = theme === 'white' ? '☀️ White' : '🌙 Normal';
      
      await ctx.reply(
        `✅ Done! Here is your ${newInvoice.status === 'paid' ? 'Receipt' : 'Invoice'} ${newInvoice.id}\n` +
        `📄 Theme: ${themeLabel}`
      );
      
      await ctx.replyWithDocument({
        source: pdfBuffer,
        filename: `${newInvoice.id}.pdf`
      });
      
      await clearSession(ctx.chat.id);
    } catch (err: any) {
      await ctx.reply(`⚠️ Failed to generate PDF: ${err.message}`);
    }

  } else if (action === 'edit_order') {
    session.step = 'awaiting_name';
    await saveSession(ctx.chat.id, session);
    await ctx.editMessageText('Let us start over. What is the customer name?');
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
