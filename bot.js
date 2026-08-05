const { Telegraf, Scenes, session } = require('telegraf');
const admin = require('firebase-admin');
const express = require('express');

// Express server (Render.com port scan timeout bermasligi uchun)
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Bot is running successfully!');
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// 1. Firebase Admin Inizializatsiyasi
const serviceAccount = require('./serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://BUYERGA_O_ZINGIZNI_FIREBASE_URL_NGIZNI_YOZING.firebaseio.com"
});
const db = admin.database();

// 2. Telegram Botni ishga tushirish
const BOT_TOKEN = process.env.BOT_TOKEN || '8969361738:AAHmkkbhPvSzxVZqXrO8QitGRhNIywR-M5k';
const ADMIN_ID = process.env.ADMIN_ID || '8173787792';
const MY_CARD_NUMBER = '4023 0605 1767 0781';

const bot = new Telegraf(BOT_TOKEN);

// --- BOSQICHMA-BOSQICH MA'LUMOT YIG'ISH (SCENE / WIZARD) ---
const sellerWizard = new Scenes.WizardScene(
  'SELLER_WIZARD',

  // 1-bosqich: Soat va narxni tanlash (Yangi soatlar va narxlar bilan)
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

  // 2-bosqich: To'lovni ko'rsatish
  async (ctx) => {
    if (!ctx.callbackQuery) return;
    const [hours, price] = ctx.callbackQuery.data.split('_');
    ctx.wizard.state.postData.hours = parseFloat(hours);
    ctx.wizard.state.postData.price = parseInt(price);

    await ctx.answerCbQuery();
    await ctx.reply(
      `💳 **To'lov bering:**\n\n` +
      `Summa: **${parseInt(price).toLocaleString()} UZS**\n` +
      `Karta: \`${MY_CARD_NUMBER}\`\n\n` +
      `To'lovni amalga oshirgach, to'lov **Chek rasmini (скриншот)** yoki chek tekstini shu yerga yuboring!`,
      { parse_mode: 'Markdown' }
    );
    return ctx.wizard.next();
  },

  // 3-bosqich: Chekni tekshirish
  async (ctx) => {
    ctx.wizard.state.postData.sellerUsername = ctx.from.username || ctx.from.first_name;
    
    await ctx.telegram.sendMessage(
      ADMIN_ID,
      `🚨 **YANGI TO'LOV KELDI!**\nFoydalanuvchi: @${ctx.wizard.state.postData.sellerUsername}\nSumma: ${ctx.wizard.state.postData.price.toLocaleString()} UZS`
    );

    await ctx.reply(`✅ To'lov cheki qabul qilindi va admin tekshiruviga yuborildi.\n\nEndi Premium joyga qo'yiladigan **Rasm yoki Video** yuboring:`);
    return ctx.wizard.next();
  },

  // 4-bosqich: Rasm yoki Videoni qabul qilish
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

  // 5-bosqich: Turlarni qabul qilish va 1-turga o'tish
  async (ctx) => {
    const rawTypes = ctx.message.text.split(',').map(t => t.trim());
    ctx.wizard.state.typesQueue = rawTypes;
    ctx.wizard.state.currentTypeIndex = 0;

    await ctx.reply(`Rahmat! Endi **"${rawTypes[0]}"** uchun o'lchamlarni kiriting (masalan: S, M, L yoki 39, 40):`);
    return ctx.wizard.next();
  },

  // 6-bosqich: Har bir tur uchun Razmer, Rang va Narx yig'ish (Loop)
  async (ctx) => {
    const currentType = ctx.wizard.state.typesQueue[ctx.wizard.state.currentTypeIndex];
    
    if (!ctx.wizard.state.currentItem) {
      ctx.wizard.state.currentItem = {
        typeName: currentType,
        sizes: ctx.message.text.split(',').map(s => s.trim())
      };
      await ctx.reply(`**"${currentType}"** uchun ranglarni kiriting (masalan: Qora, Oq, Qizil):`);
      return;
    } 
    
    if (!ctx.wizard.state.currentItem.colors) {
      ctx.wizard.state.currentItem.colors = ctx.message.text.split(',').map(c => c.trim());
      await ctx.reply(`**"${currentType}"** narxini kiriting (UZS da, faqat raqam):`);
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

// Firebase'ga saqlash va Taymer o'rnatish funksiyasi
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

// Stage & Bot Sozlamalari
const stage = new Scenes.Stage([sellerWizard]);
bot.use(session());
bot.use(stage.middleware());

bot.start((ctx) => {
  ctx.reply(`GRWM Premium Botiga xush kelibsiz! E'lon berish uchun /premium buyrug'ini bosing.`);
});

bot.command('premium', (ctx) => ctx.scene.enter('SELLER_WIZARD'));

// Botni ishga tushirish
bot.launch();
console.log(`🤖 Telegram Bot muvaffaqiyatli ishga tushdi!`);
