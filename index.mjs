import { Telegraf } from 'telegraf';
import axios from 'axios';
import * as cheerio from 'cheerio'; 
// URLSearchParams දැන් Cloudflare Worker environment එකෙන් auto-inject විය යුතුයි, 
// එසේ නොවුණොත්, 'url' import එක අවශ්‍යයි: import { URLSearchParams } from 'url';

// ⚠️ Bot Token එක
const BOT_TOKEN = '83827277460:AAEgKVISJN5TTuV4O-82sMGQDG3khwjiKR8'; 

let bot;

// 🎯 අවසාන යාවත්කාලීන කරන ලද Scraping Logic
async function getDownloadLink(url) {
    // fdown.net bot traffic block කරන නිසා, අපි සෘජුවම download.php URL එකට යමු.
    const scrapeUrl = `https://fdown.net/download.php?url=${encodeURIComponent(url)}`;
    
    try {
        const response = await axios.get(scrapeUrl, {
            headers: {
                // වඩාත් නිවැරදි User-Agent එකක්
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                // Referer Header එක අනිවාර්යයෙන්ම අවශ්‍යයි!
                'Referer': 'https://fdown.net/',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
            // fdown.net redirect වුවහොත් එය අනුගමනය කරන්න
            maxRedirects: 5 
        });
        
        const $ = cheerio.load(response.data);

        // 🎯 නවතම Web Scraping Logic (පිටුවේ ඇති පාඨය මත පදනම්ව)
        let linkElement;

        // 1. HD Link එක සොයා ගැනීම (පාඨය: "Download Video in HD Quality")
        linkElement = $('a:contains("Download Video in HD Quality")'); 
        
        if (linkElement.length === 0) {
             // 2. SD Link එක සොයා ගැනීම (පාඨය: "Download Video in Normal Quality")
            linkElement = $('a:contains("Download Video in Normal Quality")');
        }
        
        // 3. පැරණි Selector එකක් පරීක්ෂා කරමු (Fallback)
        if (linkElement.length === 0) {
            // බොත්තම් වලට btn ක්ලාස් එකක් තිබේ නම්, href එකක් සහිත පළමු A-tag එක සොයන්න
            linkElement = $('a.btn[href^="http"]'); 
        }

        if (linkElement.length > 0) {
            // පළමු වලංගු link එකේ href එක ලබා දෙමු
            return linkElement.first().attr('href');
        }

        return null; 
        
    } catch (error) {
        // දෝෂයක් Cloudflare Logs වෙත යවමු
        console.error("Fdown Scraping Error:", error.message);
        return null; 
    }
}

// Telegram Handlers define කරන function එක
function setupBotHandlers(botInstance) {
    botInstance.start((ctx) => {
        ctx.reply(`👋 හායි ${ctx.from.first_name}!\nමම fdown.net හරහා Facebook වීඩියෝ බාගත කරන Bot කෙනෙක්. කරුණාකර Facebook වීඩියෝ ලින්ක් එකක් (URL) මට එවන්න.`);
    });

    botInstance.help((ctx) => {
        ctx.reply('මට Facebook වීඩියෝවක ලින්ක් එක එවන්න. මම එය බාගත කරලා දෙන්නම්.');
    });

    botInstance.on('text', async (ctx) => {
        const url = ctx.message.text.trim();
        const messageId = ctx.message.message_id;

        if (url.startsWith('http')) {
            let loadingMsg;
            try {
                loadingMsg = await ctx.reply('⌛️ වීඩියෝ ලින්ක් එක සකසමින්...', { reply_to_message_id: messageId });
                
                const downloadLink = await getDownloadLink(url);

                if (downloadLink) {
                    await ctx.deleteMessage(loadingMsg.message_id).catch(e => console.log("Can't delete msg:", e.message));

                    await ctx.replyWithVideo(downloadLink, { 
                        caption: `ඔබ ඉල්ලූ වීඩියෝව මෙන්න.`,
                        reply_to_message_id: messageId 
                    });
                    
                } else {
                    await ctx.editMessageText('⚠️ වීඩියෝව සොයා ගැනීමට නොහැකි විය. කරුණාකර ලින්ක් එක නිවැරදිදැයි පරීක්ෂා කරන්න (Public වීඩියෝ පමණක් වැඩ කරයි).', {
                        chat_id: loadingMsg.chat.id,
                        message_id: loadingMsg.message_id
                    });
                }

            } catch (error) {
                console.error("Handler Error:", error.message);
                
                try {
                    if (loadingMsg) {
                         await ctx.editMessageText('❌ සමාවෙන්න! වීඩියෝව download කිරීමේදී දෝෂයක් ඇතිවිය. (internal server error).', {
                            chat_id: loadingMsg.chat.id,
                            message_id: loadingMsg.message_id
                        });
                    } else {
                         await ctx.reply('❌ සමාවෙන්න! දෝෂයක් ඇතිවිය.');
                    }
                } catch (editError) {
                     await ctx.reply('❌ සමාවෙන්න! දෝෂයක් ඇතිවිය.');
                }
            }
        } else {
            ctx.reply('කරුණාකර වලංගු Facebook වීඩියෝ ලින්ක් එකක් (URL) පමණක් එවන්න.');
        }
    });
}

// Cloudflare Worker's entry point: ES Module default export
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (!bot) {
        bot = new Telegraf(BOT_TOKEN);
        setupBotHandlers(bot);
    }
    
    // Telegram වෙතින් එන POST request එක හසුරුවයි
    if (request.method === 'POST') {
        try {
            const body = await request.json();
            await bot.handleUpdate(body);
            return new Response('OK', { status: 200 });

        } catch (error) {
            console.error('Webhook Handling Error:', error.message);
            return new Response('Error handling update', { status: 500 });
        }
    }

    return new Response('Fdown Telegram Bot Worker is running.', { status: 200 });
  },
};
