import { Bot, webhookCallback } from 'grammy';
import { getFbVideoInfo } from './services/facebook.js';

export default {
  async fetch(request, env, ctx) {
    const bot = new Bot(env.BOT_TOKEN);

    bot.command('start', async (ctx) => {
      await ctx.reply(
        "👋 *ආයුබෝවන්\\!* මම Facebook වීඩියෝ බාගත කරන්නා\\. මට Facebook වීඩියෝ සබැඳියක් \\(link\\) එවන්න\\.",
        { parse_mode: 'MarkdownV2' }
      );
    });

    bot.command('help', async (ctx) => {
      await ctx.reply(
        "👋 *ආයුබෝවන්\\!* මම Facebook වීඩියෝ බාගත කරන්නා\\. මට Facebook වීඩියෝ සබැඳියක් \\(link\\) එවන්න\\.",
        { parse_mode: 'MarkdownV2' }
      );
    });

    bot.on('message:text', async (ctx) => {
      const text = ctx.message.text.trim();
      
      if (text.startsWith('/')) {
        return;
      }

      const fbUrlMatch = text.match(/https?:\/\/(?:www\.|m\.|fb\.)?facebook\.com\/\S+|https?:\/\/fb\.watch\/\S+/i);
      
      if (!fbUrlMatch) {
        await ctx.reply(
          "💡 කරුණාකර වලංගු Facebook වීඩියෝ සබැඳියක් පමණක් එවන්න\\.\n\n" +
          "සහාය දක්වන URL ආකෘති:\n" +
          "\\- facebook\\.com/username/videos/\\.\\.\\.\n" +
          "\\- fb\\.watch/\\.\\.\\.\n" +
          "\\- facebook\\.com/watch/\\.\\.\\.",
          { parse_mode: 'MarkdownV2' }
        );
        return;
      }
      
      const fbUrl = fbUrlMatch[0];
      
      await ctx.reply("⏳ වීඩියෝ සබැඳිය විශ්ලේෂණය කරමින්\\.\\.\\. කරුණාකර මොහොතක් රැඳී සිටින්න\\.", { parse_mode: 'MarkdownV2' });
      
      try {
        const result = await getFbVideoInfo(fbUrl);
        
        if (result.error) {
          await ctx.reply(
            `❌ දෝෂය: ${result.error}\n\n` +
            `💡 කරුණාකර පරීක්ෂා කරන්න:\n` +
            `- වීඩියෝ URL නිවැරදි දැයි\n` +
            `- වීඩියෝව ප්‍රසිද්ධ (public) දැයි\n` +
            `- වීඩියෝව තවමත් ලබා ගත හැකි දැයි`
          );
          return;
        }
        
        if (result.url) {
          await ctx.reply(
            `✅ වීඩියෝ බාගත කිරීමේ සබැඳිය:\n${result.url}\n\n📝 ${result.title || 'Facebook Video'}`
          );
        } else {
          await ctx.reply("❌ වීඩියෝ සබැඳිය ලබා ගැනීමට නොහැකි විය\\. සබැඳිය නිවැරදි දැයි පරීක්ෂා කරන්න\\.", { parse_mode: 'MarkdownV2' });
        }
      } catch (error) {
        console.error('Facebook video fetch error:', error);
        await ctx.reply(`❌ දෝෂයක් සිදු විය: ${error.message}`);
      }
    });

    return webhookCallback(bot, 'cloudflare-mod')(request);
  },
};
