import { Telegraf, session, Context, Markup } from 'telegraf';
import { Database, BatikInvoice } from '../db/database';
import { InvoicePdfService, PdfTheme } from './invoice-pdf.service';
import fs from 'fs';

interface BotSession {
  step: string;
  data: Partial<BatikInvoice>;
  tempFabric?: string;
  pdfTheme?: PdfTheme;
}

export interface BotContext extends Context {
  session?: BotSession;
}

export class TelegramBotService {
  private bot: Telegraf<BotContext>;
  private db: Database;
  private pdfService: InvoicePdfService;

  constructor(token: string, db: Database, pdfService: InvoicePdfService) {
    this.bot = new Telegraf<BotContext>(token);
    this.db = db;
    this.pdfService = pdfService;

    this.bot.use(session());

    this.bot.command('start', this.handleStart.bind(this));
    this.bot.command('new', this.handleStart.bind(this));
    this.bot.command('cancel', this.handleCancel.bind(this));

    this.bot.on('text', this.handleText.bind(this));
    this.bot.on('callback_query', this.handleCallback.bind(this));
  }

  public async start(): Promise<void> {
    try {
      await this.bot.launch();
      console.log('Telegram Bot engine started successfully in Electron!');
    } catch (err) {
      console.error('Failed to start Telegram Bot engine:', err);
    }
  }

  public stop(): void {
    this.bot.stop();
  }

  private async handleStart(ctx: BotContext) {
    ctx.session = {
      step: 'awaiting_name',
      data: {
        items: [],
        discount_type: 'none',
        discount_value: 0,
        discount_amount: 0,
        subtotal: 0,
        total: 0
      }
    };
    await ctx.reply("👋 Welcome to Antara Batik!\nLet's create your document.\n\nWhat is the customer's full name?");
  }

  private async handleCancel(ctx: BotContext) {
    ctx.session = undefined;
    await ctx.reply("❌ Session cancelled. Type /new to start over.");
  }

  private calculateUnitPrice(meters: number): number {
    if (meters >= 1000) return 35;
    if (meters >= 500) return 37;
    if (meters >= 100) return 38;
    return 40;
  }

  private recalculateTotals(data: Partial<BatikInvoice>) {
    let subtotal = 0;
    for (const item of (data.items || [])) {
      subtotal += item.quantity_meters * item.price_per_meter;
    }
    data.subtotal = subtotal;

    if (data.discount_type === 'percentage') {
      data.discount_amount = subtotal * ((data.discount_value || 0) / 100);
    } else if (data.discount_type === 'fixed') {
      data.discount_amount = data.discount_value || 0;
    } else {
      data.discount_amount = 0;
    }
    data.total = Math.max(0, subtotal - data.discount_amount);
  }

  private generateReferenceId(status: string): string {
    const prefix = status === 'paid' ? 'REC-' : 'INV-';
    const existing = this.db.getInvoices().filter(i => i.id.startsWith(prefix));
    let maxId = 0;
    for (const inv of existing) {
      const num = parseInt(inv.id.substring(prefix.length + 5), 10);
      if (!isNaN(num) && num > maxId) maxId = num;
    }
    const nextId = (maxId + 1).toString().padStart(6, '0');
    const year = new Date().getFullYear();
    return `${prefix}${year}-${nextId}`;
  }

  private async handleText(ctx: BotContext) {
    if (!ctx.session || !ctx.session.step) {
      return ctx.reply('Please type /new to start a document session.');
    }
    
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : '';
    const { step, data } = ctx.session;

    switch (step) {
      case 'awaiting_name':
        if (text.trim().length < 2) {
          return ctx.reply("❌ Name cannot be empty or too short. Please enter the customer's full name:");
        }
        data.customer_name = text.trim();
        ctx.session.step = 'awaiting_phone';
        await ctx.reply('📞 Contact phone number?');
        break;

      case 'awaiting_phone':
        const phone = text.replace(/[^0-9+]/g, '');
        if (phone.length < 9 || phone.length > 15) {
          return ctx.reply('❌ Invalid phone number. Please enter a valid contact number (9-15 digits):');
        }
        data.customer_phone = text.trim();
        ctx.session.step = 'awaiting_billing';
        await ctx.reply('🏠 Billing address?');
        break;

      case 'awaiting_billing':
        if (text.trim().length < 5) {
          return ctx.reply('❌ Address cannot be empty. Please enter the billing address:');
        }
        data.billing_address = text.trim();
        ctx.session.step = 'awaiting_delivery';
        await ctx.reply('📦 Delivery address?\n(Type "same" to use billing address)');
        break;

      case 'awaiting_delivery':
        if (text.trim().length < 4) {
           return ctx.reply('❌ Address cannot be empty. Please enter the delivery address:');
        }
        data.delivery_address = text.toLowerCase().trim() === 'same' ? data.billing_address : text.trim();
        ctx.session.step = 'awaiting_email';
        await ctx.reply('📧 Email address? (Type "skip" if none)');
        break;

      case 'awaiting_email':
        const email = text.trim();
        if (email.toLowerCase() !== 'skip' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return ctx.reply('❌ Invalid email format. Please enter a valid email or type "skip":');
        }
        data.customer_email = email.toLowerCase() === 'skip' ? '' : email;
        ctx.session.step = 'awaiting_doc_type';
        await ctx.reply('Select document type:', Markup.inlineKeyboard([
          Markup.button.callback('Invoice', 'type_pending'),
          Markup.button.callback('Receipt', 'type_paid')
        ]));
        break;

      case 'awaiting_quantity':
        const qty = parseFloat(text);
        if (isNaN(qty) || qty <= 0) {
          return ctx.reply('❌ Invalid quantity. Please enter a number greater than 0.');
        }
        
        const price = this.calculateUnitPrice(qty);
        data.items!.push({
          fabric_type: ctx.session.tempFabric || 'Unknown',
          pattern_name: '',
          quantity_meters: qty,
          price_per_meter: price,
          total: qty * price
        } as any);
        this.recalculateTotals(data);
        
        ctx.session.step = 'awaiting_more_fabric';
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
        if (isNaN(val) || val < 0) {
          return ctx.reply('❌ Invalid value. Please enter a positive number.');
        }
        if (data.discount_type === 'fixed' && val >= (data.subtotal || 0)) {
          return ctx.reply('❌ Discount cannot exceed the total amount. Please enter a lower value.');
        }
        if (data.discount_type === 'percentage' && val > 100) {
          return ctx.reply('❌ Discount percentage cannot exceed 100. Please enter a lower value.');
        }
        data.discount_value = val;
        this.recalculateTotals(data);
        
        ctx.session.step = 'awaiting_confirmation';
        this.sendConfirmation(ctx);
        break;
        
      default:
        await ctx.reply('Please use the inline buttons or type /cancel.');
    }
  }

  private async handleCallback(ctx: BotContext) {
    if (!ctx.session || !ctx.session.step) return;
    const data = ctx.session.data;
    const action = (ctx.callbackQuery as any).data;

    // Document Type
    if (action === 'type_pending' || action === 'type_paid') {
      data.status = action === 'type_paid' ? 'paid' : 'pending';
      ctx.session.step = 'awaiting_fabric';
      await ctx.editMessageText('Select fabric type:', Markup.inlineKeyboard([
        Markup.button.callback('Dubai Cotton', 'fabric_dubai'),
        Markup.button.callback('Cotton Viscose', 'fabric_viscose')
      ]));
      return;
    }

    // Fabric Type
    if (action.startsWith('fabric_')) {
      ctx.session.tempFabric = action === 'fabric_dubai' ? 'Dubai Cotton' : 'Cotton Viscose';
      ctx.session.step = 'awaiting_quantity';
      await ctx.editMessageText(`You selected ${ctx.session.tempFabric}.\nHow many meters?`);
      return;
    }
    
    // Add More Fabric
    if (action === 'add_fabric') {
      ctx.session.step = 'awaiting_fabric';
      await ctx.editMessageText('Select next fabric type:', Markup.inlineKeyboard([
        Markup.button.callback('Dubai Cotton', 'fabric_dubai'),
        Markup.button.callback('Cotton Viscose', 'fabric_viscose')
      ]));
      return;
    }

    // Proceed to Discount
    if (action === 'proceed_discount') {
      ctx.session.step = 'awaiting_discount_type';
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
        this.recalculateTotals(data);
        ctx.session.step = 'awaiting_confirmation';
        this.sendConfirmation(ctx);
      } else {
        data.discount_type = action === 'disc_percent' ? 'percentage' : 'fixed';
        ctx.session.step = 'awaiting_discount_val';
        await ctx.editMessageText(`Enter ${data.discount_type} discount value (e.g. 10):`);
      }
      return;
    }

    // Confirmation
    if (action === 'confirm_order') {
      // Ask for PDF theme before generating
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
      ctx.session!.pdfTheme = action === 'theme_normal' ? 'normal' : 'white';
      await ctx.editMessageText('⏳ Generating your document in Electron...');
      await this.processOrder(ctx);
    } else if (action === 'edit_order') {
      ctx.session.step = 'awaiting_name';
      await ctx.editMessageText('Let us start over. What is the customer name?');
    }
  }

  private async sendConfirmation(ctx: BotContext) {
    const d = ctx.session!.data;
    const text = `
─────────────────────
📊 Final Summary
─────────────────────
👤 Customer:  ${d.customer_name}
📞 Phone:     ${d.customer_phone}
🏠 Billing:   ${d.billing_address}
📄 Type:      ${d.status === 'paid' ? 'Receipt' : 'Invoice'}
💰 Subtotal:  RM ${d.subtotal?.toFixed(2)}
📉 Discount:  - RM ${d.discount_amount?.toFixed(2)}
✅ Total:     RM ${d.total?.toFixed(2)}
─────────────────────
Please confirm your order details:`;

    await ctx.reply(text, Markup.inlineKeyboard([
      Markup.button.callback('✅ Confirm', 'confirm_order'),
      Markup.button.callback('✏️ Edit', 'edit_order')
    ]));
  }

  private async processOrder(ctx: BotContext) {
    const d = ctx.session!.data as BatikInvoice;
    const theme: PdfTheme = ctx.session!.pdfTheme || 'normal';
    d.id = this.generateReferenceId(d.status);
    d.created_at = new Date().toISOString();
    d.updated_at = d.created_at;

    try {
      // 1. Save strictly to local DB
      this.db.saveInvoice(d);

      // 2. Headless PDF generation with selected theme
      const result = await this.pdfService.generateAndOpenInvoicePdf(d, false, theme);
      
      if (result.success && result.filePath) {
        const themeLabel = theme === 'white' ? '☀️ White' : '🌙 Normal';
        await ctx.reply(
          `✅ Done! Here is your ${d.status === 'paid' ? 'Receipt' : 'Invoice'} ${d.id}\n` +
          `📄 Theme: ${themeLabel}`
        );
        await ctx.replyWithDocument({
          source: fs.createReadStream(result.filePath),
          filename: `${d.id}.pdf`
        });
      } else {
        throw new Error(result.error);
      }
    } catch (err: any) {
      await ctx.reply(`⚠️ Failed to generate document: ${err.message}`);
    } finally {
      ctx.session = undefined; // clear session
    }
  }
}
