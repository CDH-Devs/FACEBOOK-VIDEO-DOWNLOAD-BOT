
export default {
    async fetch(request, env, ctx) {
        if (request.method !== 'POST') {
            return new Response('Hello, I am your FDOWN Telegram Worker Bot.');
        }

        // 1. Environment Variable එකෙන් Bot Token එක ලබාගැනීම
        const BOT_TOKEN = env.BOT_TOKEN;
        const telegramApi = `https://api.telegram.org/bot${BOT_TOKEN}`;

        try {
            const update = await request.json();
            const message = update.message;

            if (message && message.text) {
                const chatId = message.chat.id;
                const text = message.text.trim();
                
                // Start command එකට ප්‍රතිචාරය
                if (text === '/start') {
                    await this.sendMessage(telegramApi, chatId, '👋 සුභ දවසක්! මට Facebook වීඩියෝ Link එකක් එවන්න. එවිට මම එය download කර දෙන්නම්.', null);
                    return new Response('OK', { status: 200 });
                }

                // 2. Facebook Link එකක් දැයි පරීක්ෂා කිරීම (https://fb.watch/...)
                const isFacebookLink = /(?:https?:\/\/)?(?:www\.)?(?:facebook\.com|fb\.watch)\/.*videos\/(\d+)/i.test(text);
                
                if (isFacebookLink) {
                    await this.sendMessage(telegramApi, chatId, '⌛️ වීඩියෝව හඳුනා ගැනේ... කරුණාකර මොහොතක් රැඳී සිටින්න.', message.message_id);
                    
                    try {
                        // 3. fdown.net වෙත POST ඉල්ලීම යැවීම
                        const fdownUrl = "https://fdown.net/download.php";
                        
                        const formData = new URLSearchParams();
                        formData.append('URLz', text); // පරිශීලකයාගේ Link එක URLz ලෙස යැවීම

                        const fdownResponse = await fetch(fdownUrl, {
                            method: 'POST',
                            headers: {
                                // Spam ලෙස නොසැලකීම සඳහා User-Agent එකක් යැවීම
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                                'Content-Type': 'application/x-www-form-urlencoded',
                            },
                            body: formData.toString()
                        });

                        const resultHtml = await fdownResponse.text();

                        // 4. HTML ප්‍රතිචාරයෙන් HD Video Link එක Scrap කිරීම (RegEx භාවිතා කර)
                        // අපි සොයන්නේ HD Quality button එකේ ඇති href එකයි.
                        const hdLinkRegex = /<a href="([^"]+)" target="_blank" class="btn btn-success btn-lg" rel="nofollow">Download Video in HD Quality<\/a>/i;
                        const match = resultHtml.match(hdLinkRegex);
                        
                        if (match && match[1]) {
                            const hdVideoUrl = match[1];
                            
                            // 5. Telegram වෙත වීඩියෝව යැවීම (sendVideo)
                            await this.sendVideo(telegramApi, chatId, hdVideoUrl, 'මෙන්න ඔබගේ වීඩියෝව! HD Quality එකෙන් download කර ඇත.', message.message_id);
                            
                        } else {
                            // HD Link එක සොයා ගැනීමට නොහැකි නම්
                            await this.sendMessage(telegramApi, chatId, '⚠️ සමාවෙන්න, වීඩියෝ Download Link එක සොයා ගැනීමට නොහැකි විය. වීඩියෝව Private (පුද්ගලික) විය හැක, නැතිනම් fdown.net හි ගැටළුවක් තිබේ.', message.message_id);
                        }
                        
                    } catch (fdownError) {
                        console.error("fdown.net error:", fdownError);
                        await this.sendMessage(telegramApi, chatId, '❌ වීඩියෝව ලබා ගැනීමේදී තාක්ෂණික දෝෂයක් ඇති විය.', message.message_id);
                    }
                    
                } else {
                    // Facebook Link එකක් නොවේ නම්
                    await this.sendMessage(telegramApi, chatId, '❌ කරුණාකර වලංගු Facebook වීඩියෝ Link එකක් එවන්න.', message.message_id);
                }
            }

            return new Response('OK', { status: 200 });

        } catch (e) {
            console.error("General error:", e);
            return new Response('Error processing request', { status: 500 });
        }
    },

    // Telegram API වෙත Message යැවීම සඳහා වන සහායක function
    async sendMessage(api, chatId, text, replyToMessageId) {
        await fetch(`${api}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: text,
                parse_mode: 'HTML',
                ...(replyToMessageId && { reply_to_message_id: replyToMessageId }),
            }),
        });
    },

    // Telegram API වෙත Video යැවීම සඳහා වන සහායක function
    async sendVideo(api, chatId, videoUrl, caption, replyToMessageId) {
        await fetch(`${api}/sendVideo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                video: videoUrl,
                caption: caption,
                parse_mode: 'HTML',
                ...(replyToMessageId && { reply_to_message_id: replyToMessageId }),
            }),
        });
    }
};
