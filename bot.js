const { Telegraf, Scenes, session } = require('telegraf');
const admin = require('firebase-admin');

// 1. Firebase Admin - Professional va Xavfsiz Inizializatsiya
const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT;

if (!serviceAccountRaw) {
  console.error("XATO: FIREBASE_SERVICE_ACCOUNT environment variable topilmadi!");
  process.exit(1);
}

const serviceAccount = JSON.parse(serviceAccountRaw);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://grwm-store-default-rtdb.firebaseio.com"
});

const db = admin.database();

// 2. Telegram Bot o'zgaruvchilari
const BOT_TOKEN = process.env.BOT_TOKEN || '8969361738:AAHmkkbhPvSzxVZqXrO8QitGRhNIywR-M5k';
const ADMIN_ID = process.env.ADMIN_ID || '8173787792';
const MY_CARD_NUMBER = '4023 0605 1767 0781';

const bot = new Telegraf(BOT_TOKEN);

// --- SCENE / WIZARD (MA'LUMOT YIG'ISH BOSQICHLARI) ---
const sellerWizard = new Scenes.WizardScene(
  'SELLER_WIZARD',

  // 1-bosqich: Vaqt va tarifni tanlash
  async (ctx) => {
    ctx.wizard.state.postData = { items: [] };
    await ctx.reply(
      `🌟 **GRWM Premium Joy Sotib Olish**\n\nQancha vaqtga e'lon joylamoqchisiz? Tanlang:`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '1.5 Soat - 19,999 UZS', callback_data: '1.5_19999' }],
            [{ text: '2.5 Soat - 27,777 UZS', callback_data: '2.5_27777' }],
            [{ text: '5.0 Soat - 75,555 UZS', callback_data: '5.0_75555' }],
            [{ text: '7.0 Soat - 87,777 UZS', callback_data: '7.0_87777' }],
            [{ text: '9.0 Soat - 99,999 UZS', callback_data: '9.0_99999' }],
            [{ text: '12.0 Soat - 133,333 UZS', callback_data: '12.0_133333' }],
            [{ text: '24.0 Soat - 235,532 UZS', callback_data: '24.0_235532' }]
          ]
        }
      }
    );
    return ctx.wizard.next();
  },

  // 2-bosqich: To'lov ma'lumotlarini ko'rsatish
  async (ctx) => {
    if (!ctx.callbackQuery) return;
    const [hours, price] = ctx.callbackQuery.data.split('_');
    ctx.wizard.state.postData.hours = parseFloat(hours);
    ctx.wizard.state.postData.price = parseInt(price);

    await ctx.answerCbQuery();
    await ctx.reply(
      `💳 **To'lov tafsilotlari:**\n\n` +
      `Summa: **${parseInt(price).toLocaleString()} UZS**\n` +
      `Karta: \`${MY_CARD_NUMBER}\`\n\n` +
      `To'lovni amalga oshirgach, chek rasmini yoki matnini shu yerga yuboring!`,
      { parse_mode: 'Markdown' }
    );
    return ctx.wizard.next();
  },

  // 3-bosqich: Chekni adminga yuborish
  async (ctx) => {
    ctx.wizard.state.postData.sellerUsername = ctx.from.username || ctx.from.first_name;
    
    await ctx.telegram.sendMessage(
      ADMIN_ID,
      `🚨 **YANGI TO'LOV KELDI!**\nFoydalanuvchi: @${ctx.wizard.state.postData.sellerUsername}\nSumma: ${ctx.wizard.state.postData.price.toLocaleString()} UZS`
    );

    await ctx.reply(`✅ To'lov cheki qabul qilindi va admin tekshiruviga yuborildi.\n\nEndi Premium e'lon uchun **Rasm yoki Video** yuboring:`);
    return ctx.wizard.next();
  },

  // 4-bosqich: Media faylni qabul qilish
  async (ctx) => {
    let fileId = '';
    if (ctx.message.photo) {
      fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
    } else if (ctx.message.video) {
      fileId = ctx.message.video.file_id;
    } else {
      return ctx.reply(`Iltimos, faqat rasm yoki video yuboring!`);
    }

    const fileUrl = await ctx.telegram.getFileLink(fileId);
    ctx.wizard.state.postData.mediaUrl = fileUrl.href;

    await ctx.reply(`📦 Videoda nechta turdagi kiyim bor? (Masalan: Kofta, Shim, Sumka deb vergul bilan yozing):`);
    return ctx.wizard.next();
  },

  // 5-bosqich: Turlarni ajratib olish
  async (ctx) => {
    const rawTypes = ctx.message.text.split(',').map(t => t.trim());
    ctx.wizard.state.typesQueue = rawTypes;
    ctx.wizard.state.currentTypeIndex = 0;

    await ctx.reply(`Rahmat! Endi **"${rawTypes[0]}"** uchun o'lchamlarni kiriting (masalan: S, M, L):`);
    return ctx.wizard.next();
  },

  // 6-bosqich: Razmer, rang va narxlarni yig'ish (Loop)
  async (ctx) => {
    const currentType = ctx.wizard.state.typesQueue[ctx.wizard.state.currentTypeIndex];
    
    if (!ctx.wizard.state.currentItem) {
      ctx.wizard.state.currentItem = {
        typeName: currentType,
        sizes: ctx.message.text.split(',').map(s => s.trim())
      };
      await ctx.reply(`**"${currentType}"** uchun ranglarni kiriting (masalan: Qora, Oq):`);
      return;
    } 
    
    if (!ctx.wizard.state.currentItem.colors) {
      ctx.wizard.state.currentItem.colors = ctx.message.text.split(',').map(c => c.trim());
      await ctx.reply(`**"${currentType}"** narxini kiriting (UZS, faqat raqam):`);
      return;
    }

    if (!ctx.wizard.state.currentItem.price) {
      ctx.wizard.state.currentItem.price = parseInt(ctx.message.text);
      
      ctx.wizard.state.postData.items.push(ctx.wizard.state.currentItem);
      ctx.wizard.state.currentItem = null;
      
      ctx.wizard.state.currentTypeIndex++;

      if (ctx.wizard.state.currentTypeIndex < ctx.wizard.state.typesQueue.length) {
        const nextType = ctx.wizard.state.typesQueue[ctx.wizard.state.currentTypeIndex];
        await ctx.reply(`Endi **"${nextType}"** uchun o'lchamlarni kiriting:`);
        return;
      } else {
        return await finishAndSavePost(ctx);
      }
    }
  }
);

// Firebase Realtime Database'ga saqlash
async function finishAndSavePost(ctx) {
  const postData = ctx.wizard.state.postData;
  const now = Date.now();
  const expiresAt = now + (postData.hours * 60 * 60 * 1000);

  const newPostRef = db.ref('premium_posts').push();
  await newPostRef.set({
    id: newPostRef.key,
    sellerUsername: postData.sellerUsername,
    mediaUrl: postData.mediaUrl,
    items: postData.items,
    status: 'approved',
    createdAt: now,
    expiresAt: expiresAt
  });

  await ctx.reply(
    `🎉 **Tabriklaymiz!** Sizning e'loningiz Premium joyga muvaffaqiyatli joylandi.\n\n` +
    `⏳ Amal qilish vaqti: **${postData.hours} soat**.`
  );

  return ctx.scene.leave();
}

// Botni ishga tushirish
const stage = new Scenes.Stage([sellerWizard]);
bot.use(session());
bot.use(stage.middleware());

bot.start((ctx) => {
  ctx.reply(`GRWM Premium Botiga xush kelibsiz! E'lon berish uchun /premium buyrug'ini bosing.`);
});

bot.command('premium', (ctx) => ctx.scene.enter('SELLER_WIZARD'));

bot.launch();
console.log(`🤖 Telegram Bot xavfsiz rejimda ishga tushdi!`);
