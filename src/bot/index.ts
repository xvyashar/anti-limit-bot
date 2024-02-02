import { Bot, Context, InlineKeyboard, Keyboard } from 'grammy';
import { hydrateReply, parseMode } from '@grammyjs/parse-mode';
import type { ParseModeFlavor } from '@grammyjs/parse-mode';
import { autoQuote } from '@roziscoding/grammy-autoquote';

import { Config, Sponsor, Subscription, User } from '../db';

import Configs from '../config';
const config = new Configs();

export const bootstrap = () => {
  const bot = new Bot<ParseModeFlavor<Context>>(config.get('BOT_TOKEN'));

  //* Apply Plugins
  bot.use(autoQuote);
  bot.use(hydrateReply);
  bot.api.config.use(parseMode('MarkdownV2'));

  //? sponsorship middleware
  bot.use(async (ctx, next) => {
    try {
      const updates = await bot.api.getUpdates();

      for (const update of updates) {
        if (update.channel_post) {
          //? new sponsorship
          const sponsor = await Sponsor.findOne({
            chatId: update.channel_post.chat.id,
          });
          if (!sponsor) {
            await bot.api.sendMessage(
              config.get('ADMIN_NUM_ID'),
              `یک چنل درحال استفاده از بات است\\.\nبرای تایید به عنوان اسپانسر روی گزینه زیر کلیک کنید`,
              {
                reply_markup: new InlineKeyboard().text(
                  '✅ تایید',
                  `callback_data_sponsor-accept:${update.channel_post.chat.id}`,
                ),
              },
            );

            await Sponsor.create({
              chatId: update.channel_post.chat.id,
              channelName: update.channel_post.chat.title,
              channelUsername: update.channel_post.chat.username,
            });
          }
          return;
        } else if (update.message) {
          const sponsors = await Sponsor.find({ approved: true });
          const { id: userId } = update.message.from;

          const notJoinedSponsors: InlineKeyboard = new InlineKeyboard();
          let allowed = true;
          for (const sponsor of sponsors) {
            const membership = await bot.api.getChatMember(
              sponsor.chatId,
              userId,
            );
            if (
              membership.status !== 'member' &&
              membership.status !== 'administrator' &&
              membership.status !== 'creator'
            ) {
              allowed = false;
              notJoinedSponsors.row(
                InlineKeyboard.url(
                  sponsor.channelName,
                  `https://t.me/${sponsor.channelUsername}`,
                ),
              );
            }
          }

          if (!allowed) {
            return await ctx.reply(
              'برای استفاده از ربات باید در کانالامون جوین باشید\\.\nپس از عضویت روی /start کلیک کنید\\.',
              {
                reply_markup: notJoinedSponsors,
              },
            );
          }
        }
      }

      await next();
    } catch (error) {
      console.log(error);
      ctx.reply('مشکلی پیش آمده است').catch((err) => console.log(err));
    }
  });

  //* Markups
  const mainMenu = new InlineKeyboard()
    .row(InlineKeyboard.text('❓ آنتی لیمیت چیست', 'introduction_q'))
    .row(InlineKeyboard.text('🛍️ خرید سرویس', 'buy_q'))
    .row(InlineKeyboard.text('🛒 سرویس های من', 'my-services_q'));

  const adminMainMenu = new InlineKeyboard()
    .row(InlineKeyboard.text('📃 لیست کانفیگ ها', 'get_list'))
    .row(InlineKeyboard.text('➕ اضافه کردن به لیست', 'add_list'));

  const backToMainMenu = new InlineKeyboard().text(
    '🔙 بازگشت به منو اصلی',
    'back-to-main_q',
  );

  const adminBackToMainMenu = new InlineKeyboard().text(
    '🔙 بازگشت به منو اصلی',
    'admin-back-to-main_q',
  );

  const cancelPayment = new InlineKeyboard().text(
    '🔙 انصراف از خرید',
    'back-to-main_q',
  );

  const shopItems = new InlineKeyboard()
    .row(InlineKeyboard.text('⏳ 1 ماهه - 70 هزار تومان', '1-month-service'))
    .row(InlineKeyboard.text('⏳ 2 ماهه - 130 هزار تومان', '2-month-service'))
    .row(InlineKeyboard.text('⏳ 3 ماهه - 200 هزار تومان', '3-month-service'))
    .row(InlineKeyboard.text('🔙 بازگشت به منو اصلی', 'back-to-main_q'));

  //* Commands
  bot.command('start', async (ctx) => {
    try {
      let user = await User.findOne({ numericId: ctx.from?.id });

      if (user) {
        user.userName =
          ctx.from?.username ||
          ctx.from?.first_name ||
          `user-${Math.floor(Math.random() * 1000)}`;
        await user.save();
      } else {
        user = await User.create({
          numericId: ctx.from?.id,
          userName:
            ctx.from?.username || `user-${Math.floor(Math.random() * 1000)}`,
        });
      }

      if (isAdmin(user.numericId)) {
        return await ctx.reply('👨‍💻 به پنل ادمین خوش آمدید', {
          reply_markup: adminMainMenu,
        });
      }
      ctx.reply(
        `🙋‍♂ به *Anti\\-limit* خوش اومدین\\!\n💥 سرویسی به صرفه برای دور زدن محدودیت ها\nبرای استفاده از خدمات ربات دکمه های شیشه ای را لمس کنید\\.`,
        {
          reply_markup: mainMenu,
        },
      );
    } catch (error) {
      console.log(error);
      ctx.reply('مشکلی پیش آمده است').catch((err) => console.log(err));
    }
  });

  bot.command('edit', async (ctx) => {
    try {
      if (!isAdmin(ctx.from?.id)) return;

      const config = await Config.findById(ctx.match);
      if (!config) return await ctx.reply('کانفیگی با این آیدی یافت نشد');

      await User.findOneAndUpdate(
        { numericId: ctx.from?.id },
        { inProgressMenu: `edit: ${ctx.match}` },
      );

      ctx.reply(
        'کانفیگ را به فرمت زیر ارسال کنید:\n\n```plain\n[emoji]\n[isp short code]\n[config]```',
      );
    } catch (error) {
      console.log(error);
      ctx.reply('مشکلی پیش آمده است').catch((err) => console.log(err));
    }
  });

  bot.command('delete', async (ctx) => {
    try {
      if (!isAdmin(ctx.from?.id)) return;

      const config = await Config.findById(ctx.match);
      if (!config) return await ctx.reply('کانفیگی با این آیدی یافت نشد');

      await Config.findByIdAndDelete(ctx.match);

      ctx.reply('کانفیگ با موفقیت حذف شد');
    } catch (error) {
      console.log(error);
      ctx.reply('مشکلی پیش آمده است').catch((err) => console.log(err));
    }
  });

  //* Button Callbacks
  bot.callbackQuery('introduction_q', async (ctx) => {
    try {
      await disablePaymentMode(ctx.from?.id);

      await ctx.reply(
        '⁉️ آنتی لیمیت چیست؟\nآنتی لیمیت یک VPN نیست\\!\nبلکه سرویسی است که به طور هوشمند و خودکار با کاوش در فضای اینترنت بهترین کانفیگ ها و با پینگ ها پایین رو جمع آوری میکنه و در پایگاه داده خودش ذخیره میکنه و به شما اجازه دسترسی به آن ها به صورت خودکار از طریق برنامه v2rayNG و بقیه کلاینت ها فقط با یک لینک subscription رو میده تا به صورت اتوماتیک به با کیفیت ترین کانفیگ ها وصل بشید\n\nهدف ما دسترسی شما به اینترنت آزاد، بدون محدودیت و به صرفه است تا همزمان با تعرفه پایین کیفیت عالی را تجربه کنید\\.\n👨‍💻 Support: @anti\\_limit\\_support\n🤖 Bot: @anti\\_limit\\_bot',
        {
          reply_markup: backToMainMenu,
        },
      );

      ctx.answerCallbackQuery();
    } catch (error) {
      console.log(error);
      ctx.reply('مشکلی پیش آمده است').catch((err) => console.log(err));
    }
  });

  bot.callbackQuery('back-to-main_q', async (ctx) => {
    try {
      await disablePaymentMode(ctx.from?.id);

      await ctx.reply(
        '🤖 منوی اصلی\nبرای استفاده از خدمات ربات دکمه های شیشه ای را لمس کنید\\.',
        {
          reply_markup: mainMenu,
        },
      );

      ctx.answerCallbackQuery();
    } catch (error) {
      console.log(error);
      ctx.reply('مشکلی پیش آمده است').catch((err) => console.log(err));
    }
  });

  bot.callbackQuery('buy_q', async (ctx) => {
    try {
      await disablePaymentMode(ctx.from?.id);

      await ctx.reply(
        '🛍️ خرید سرویس\n❕تمامی سرویس ها بدون محدودیت حجم و کاربر میباشد',
        {
          reply_markup: shopItems,
        },
      );

      ctx.answerCallbackQuery();
    } catch (error) {
      console.log(error);
      ctx.reply('مشکلی پیش آمده است').catch((err) => console.log(err));
    }
  });

  //? service handlers
  bot.callbackQuery('1-month-service', getServiceHandler(70000, cancelPayment));
  bot.callbackQuery(
    '2-month-service',
    getServiceHandler(130000, cancelPayment),
  );
  bot.callbackQuery(
    '3-month-service',
    getServiceHandler(200000, cancelPayment),
  );

  bot.callbackQuery('my-services_q', async (ctx) => {
    try {
      await disablePaymentMode(ctx.from?.id);

      const user = await User.findOne({ numericId: ctx.from?.id });
      if (!user)
        return ctx.reply(
          `مشکلی پیش آمده لطفا مجددا ربات را استارت کنید\\.\n/start`,
        );

      const subscriptions = await Subscription.find({ customer: user.id });

      const Keyboard = new InlineKeyboard();
      let hasService = false;
      for (const subscription of subscriptions) {
        if (new Date(subscription.expiresIn) >= new Date()) {
          hasService = true;
          Keyboard.row(
            InlineKeyboard.text(
              subscription.serviceName || '',
              `callback_data_sub-view:${subscription.id}`,
            ),
          );
        } else {
          await Subscription.findByIdAndDelete(subscription.id);
        }
      }

      Keyboard.row(
        InlineKeyboard.text('🔙 بازگشت به منو اصلی', 'back-to-main_q'),
      );

      await ctx.answerCallbackQuery();

      if (hasService)
        ctx.reply('سرویس های فعال شما:', { reply_markup: Keyboard });
      else ctx.reply('سرویس فعالی ندارید', { reply_markup: Keyboard });
    } catch (error) {
      console.log(error);
      ctx.reply('مشکلی پیش آمده است').catch((err) => console.log(err));
    }
  });

  //? admin buttons
  bot.callbackQuery('get_list', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    await disablePaymentMode(ctx.from.id);

    const configs = await Config.find();

    let res = '';
    for (const { id, isp, countryEmoji, url } of configs) {
      res += `🚩 Country: ${countryEmoji}\n📶 ISP: ${escapeMarkdown(
        isp,
      )}\n⚙️ Config: \`${escapeMarkdown(
        url,
      )}\`\n✏️ Edit: \`/edit ${id}\`\n🗑️ Delete: \`/delete ${id}\`\n\n`;
    }
    if (res === '') res = 'کانفیگی موجود نیست';

    await ctx.answerCallbackQuery();

    ctx.reply(res, { reply_markup: adminBackToMainMenu });
  });

  bot.callbackQuery('add_list', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return;
    await disablePaymentMode(ctx.from.id);

    await User.findOneAndUpdate(
      { numericId: ctx.from.id },
      { inProgressMenu: 'add_list' },
    );

    await ctx.answerCallbackQuery();

    ctx.reply(
      'کانفیگ جدید را به این فرمت ارسال کنید\n\n```plain\n[emoji]\n[isp short code]\n[config]```',
      {
        reply_markup: adminBackToMainMenu,
      },
    );
  });

  bot.callbackQuery('admin-back-to-main_q', async (ctx) => {
    await disablePaymentMode(ctx.from.id);

    await ctx.reply('🤖 منوی اصلی', {
      reply_markup: adminMainMenu,
    });

    ctx.answerCallbackQuery();
  });

  //* Receipt Message
  bot.on(':photo', async (ctx) => {
    try {
      //? validate user payment
      const user = await User.findOne({ numericId: ctx.from?.id });
      if (!user)
        return ctx.reply(
          `مشکلی برای فرایند پرداخت پیش آمده لطفا مجددا ربات را استارت کنید\\.\n/start`,
        );

      if (user.payment_queue === 0)
        return ctx.reply(
          'شما در مرحله پرداخت نیستید\\.\nلطفا مجددا از منو سرویس خود را انتخاب کرده سپس اسکرین شات رسید را ارسال کنید\\!',
          { reply_markup: backToMainMenu },
        );

      if (!user.numericId)
        return ctx.reply(
          `مشکلی برای فرایند پرداخت پیش آمده لطفا مجددا ربات را استارت کنید\\.\n/start`,
        );

      //? send to admin
      const fileId = ctx.msg.photo[ctx.msg.photo.length - 1].file_id;
      await bot.api.sendPhoto(config.get('ADMIN_NUM_ID'), fileId, {
        caption: `\\#رسید\\_پرداخت\nکاربر: @${escapeMarkdown(
          user.userName,
        )}\nآیدی عددی: \`${user.numericId}\`\nملزم به پرداخت: ${
          user.payment_queue
        } تومان`,
        reply_markup: new InlineKeyboard()
          .text('✅ تایید', `callback_data_accept:${user.numericId}`)
          .text('❌ رد', `callback_data_reject:${user.numericId}`),
      });

      //? send response to customer
      ctx.reply(
        'رسید شما دریافت شد\\!\n\nلطفا منتظر ادمین برای تایید رسیدتون بمونید\\. پس از تایید، سرویس خریداری شده همینجا ارسال خواهد شد\\. از این لحظه تا تکمیل خرید لطفا عملی در ربات انجام *ندهید* یا پیامی ارسال نکنید تا به طور اتفاق خرید با اختلال مواجه نشود\n\nجهت ارتباط با ما با پشتیبانی در ارتباط باشید:\n👨‍💻 Support: @anti\\_limit\\_support',
      );
    } catch (error) {
      console.log(error);
      ctx.reply('مشکلی پیش آمده است').catch((err) => console.log(err));
    }
  });

  //* Admin Messages
  bot.on('message:text', async (ctx) => {
    try {
      if (!isAdmin(ctx.from.id)) return;

      const user = await User.findOne({ numericId: ctx.from.id });
      if (!user) return;
      if (user.inProgressMenu === 'add_list') {
        const [countryEmoji, isp, url] = ctx.message.text.split('\n');
        if (!countryEmoji || !isp || !url)
          return ctx.reply('به فرمت درخواستی دقت کنید');

        await Config.create({ countryEmoji, isp, url });

        await ctx.reply('کانفیگ با موفقیت اضافه شد', {
          reply_markup: adminBackToMainMenu,
        });
      } else if (user.inProgressMenu?.startsWith('edit: ')) {
        const id = user.inProgressMenu.split(' ')[1];

        const [countryEmoji, isp, url] = ctx.message.text.split('\n');
        if (!countryEmoji || !isp || !url)
          return ctx.reply('به فرمت درخواستی دقت کنید');

        await Config.findByIdAndUpdate(id, { countryEmoji, isp, url });

        await ctx.reply('کانفیگ با موفقیت ویرایش شد');
        await ctx.reply('🤖 منوی اصلی', {
          reply_markup: adminMainMenu,
        });
      } else return;
    } catch (error) {
      console.log(error);
      ctx.reply('مشکلی پیش آمده است').catch((err) => console.log(err));
    }
  });

  //? dynamic buttons
  bot.on('callback_query:data', async (ctx) => {
    try {
      const query = ctx.callbackQuery.data.substring(14);

      if (!query) return await ctx.answerCallbackQuery();

      //? validate admin user
      const user = await User.findOne({ numericId: ctx.from?.id });

      if (!user) return;

      //? check action
      if (query?.startsWith('accept:')) {
        if (!isAdmin(user.numericId)) return;
        const userNumericId = query.substring(query.indexOf(':') + 1);
        const customer = await User.findOne({ numericId: userNumericId });
        if (!customer) return;

        //? calculate expiration date
        const expirationDate = new Date();
        expirationDate.setDate(
          expirationDate.getDate() +
            detectMonthByPrice(customer.payment_queue) * 30,
        );

        let serviceName = '';
        if (customer.payment_queue === 70000)
          serviceName = '⏳ 1 ماهه - 70 هزار تومان';
        else if (customer.payment_queue === 130000)
          serviceName = '⏳ 2 ماهه - 130 هزار تومان';
        else if (customer.payment_queue === 200000)
          serviceName = '⏳ 2 ماهه - 200 هزار تومان';

        //? disable customer paying mode
        await User.findOneAndUpdate(
          { numericId: userNumericId },
          { payment_queue: 0 },
        );

        //? create sub
        const subscription = await Subscription.create({
          customer: customer.id,
          serviceName,
          expiresIn: expirationDate,
        });
        const link = `${config.get('SUB_BASE_URL')}/${subscription.id}`;

        //? send to customer
        await bot.api.sendMessage(
          userNumericId,
          `پرداخت شما با موفقیت تایید شد 🌟\nلینک سابسکریپشن:\n\`${escapeMarkdown(
            link,
          )}\``,
          {
            reply_markup: backToMainMenu,
          },
        );

        //? send to admin
        await ctx.answerCallbackQuery();
        ctx.reply('عملیات موفقیت آمیز بود');
      } else if (query?.startsWith('reject:')) {
        if (!isAdmin(user.numericId)) return;
        const userNumericId = query.substring(query.indexOf(':') + 1);

        //? disable customer paying mode
        await User.findOneAndUpdate(
          { numericId: userNumericId },
          { payment_queue: 0 },
        );

        //? send to customer
        await bot.api.sendMessage(
          userNumericId,
          'متاسفانه پرداخت شما توسط ادمین رد شد\\.😕\nبرای ارتباط با ادمین به آیدی زیر پیام بدید:\n👨‍💻 Support: @anti\\_limit\\_support',
          {
            reply_markup: backToMainMenu,
          },
        );

        //? send to admin
        await ctx.answerCallbackQuery();
        ctx.reply('عملیات موفقیت آمیز بود');
      } else if (query?.startsWith('sponsor-accept:')) {
        if (!isAdmin(user.numericId)) return;
        const chatId = query.substring(query.indexOf(':') + 1);
        await Sponsor.findOneAndUpdate({ chatId }, { approved: true });

        await ctx.answerCallbackQuery();
        ctx.reply('چنل با موفقیت تایید شد');
      } else if (query?.startsWith('sub-view:')) {
        const subId = query.substring(query.indexOf(':') + 1);
        const subscription = await Subscription.findById(subId);
        const link = `${config.get('SUB_BASE_URL')}/${subscription?.id}`;

        await ctx.answerCallbackQuery();
        ctx.reply(`لینک سابسکریپشن:\n\`${escapeMarkdown(link)}\``, {
          reply_markup: backToMainMenu,
        });
      } else return;
    } catch (error) {
      console.log(error);
      ctx.reply('مشکلی پیش آمده است').catch((err) => console.log(err));
    }
  });

  bot.start({ onStart: () => console.log('bot started!') });
};

const getServiceHandler =
  (cost: number, cancelMarkup: InlineKeyboard) => async (ctx: Context) => {
    try {
      const user = await User.findOne({ numericId: ctx.from?.id });
      if (!user)
        return ctx.reply(
          `مشکلی برای فرایند پرداخت پیش آمده لطفا مجددا ربات را استارت کنید\\.\n/start`,
        );

      user.payment_queue = cost;
      await user.save();

      await ctx.reply(
        `متاسفانه در حال حاضر امکان پرداخت از طریق درگاه پرداخت وجود ندارد\\.\n\nجهت ادامه مراحل خرید مبلغ ${cost} هزار تومان را به کارت با مشخصات زیر واریز کنید و اسکرین شات رسید را در همینجا ارسال کنید:\n\nشماره کارت: \`6037697688812038\`\nیاشار طالبیان`,
        {
          reply_markup: cancelMarkup,
        },
      );

      ctx.answerCallbackQuery();
    } catch (error) {
      console.log(error);
      ctx.reply('مشکلی پیش آمده است').catch((err) => console.log(err));
    }
  };

const isAdmin = (id?: number | null | undefined) => {
  return parseInt(config.get('ADMIN_NUM_ID')) === id;
};

const escapeMarkdown = (text: string | null | undefined) => {
  if (!text) return text;

  const SPECIAL_CHARS = [
    '\\',
    '_',
    '*',
    '[',
    ']',
    '(',
    ')',
    '~',
    '`',
    '>',
    '<',
    '&',
    '#',
    '+',
    '-',
    '=',
    '|',
    '{',
    '}',
    '.',
    '!',
  ];
  SPECIAL_CHARS.forEach(
    (char) => (text = text?.replace(new RegExp('\\' + char, 'g'), `\\${char}`)),
  );
  return text;
};

const disablePaymentMode = async (id?: number) => {
  if (!id) return;
  await User.findOneAndUpdate(
    { numericId: id },
    { payment_queue: 0, $unset: { inProgressMenu: 1 } },
  );
};

const detectMonthByPrice = (price: number): number => {
  switch (price) {
    case 70000:
      return 1;

    case 130000:
      return 2;

    case 200000:
      return 3;

    default:
      return 0;
  }
};
