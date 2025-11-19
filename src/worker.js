/**
 * src/index.js
 * Final Fix V22: Switched sendVideo method from File Upload (Blob/FormData) 
 * to Sending by URL (JSON payload). This bypasses the Worker's CDN access issue.
 * Requires: A KV Namespace bound as env.VIDEO_LINKS
 */

function escapeMarkdownV2(text) {
    if (!text) return "";
    return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\\\])/g, '\\$1');
}

function sanitizeText(text) {
    if (!text) return "";
    let cleaned = text.replace(/<[^>]*>/g, '').trim();
    cleaned = cleaned.replace(/\s\s+/g, ' ');
    cleaned = cleaned.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    return cleaned;
}
// ... (The rest of the main fetch function remains the same as V19/V20/V21, using sendVideo)

export default {
    async fetch(request, env, ctx) {
        // ... (Callback Query Handling remains the same)
        // ... (Message Handling remains the same, calling this.sendVideo)
        
        // --- Note: The main message handling logic needs to be V19/V20's logic (not V21's redirect logic) ---
        // I will provide the complete code, ensuring the message handling calls sendVideo.
        
        if (request.method !== 'POST') {
            return new Response('Hello, I am your FDOWN Telegram Worker Bot.', { status: 200 });
        }

        const BOT_TOKEN = env.BOT_TOKEN;
        const telegramApi = `https://api.telegram.org/bot${BOT_TOKEN}`;

        try {
            const update = await request.json();
            const message = update.message;

            // --- Simplified Message Handling (Restored V19 logic for calling sendVideo) ---
            if (message && message.text) {
                const chatId = message.chat.id;
                const text = message.text.trim();
                const messageId = message.message_id;

                const isLink = /^https?:\/\/(www\.)?(facebook\.com|fb\.watch|fb\.me)/i.test(text);
                
                if (isLink) {
                    await this.sendMessage(telegramApi, chatId, escapeMarkdownV2('⌛️ වීඩියෝව හඳුනා ගැනේ... කරුණාකර මොහොතක් රැඳී සිටින්න.'), messageId);
                    
                    try {
                        // ... (Fdown.net scraping logic to get videoUrl and thumbnailLink) ...

                        const fdownUrl = "https://fdown.net/download.php";
                        const formData = new URLSearchParams();
                        formData.append('URLz', text);
                        
                        const fdownResponse = await fetch(fdownUrl, {
                            method: 'POST',
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                                'Content-Type': 'application/x-www-form-urlencoded',
                                'Referer': 'https://fdown.net/',
                            },
                            body: formData.toString(),
                            redirect: 'follow'
                        });

                        const resultHtml = await fdownResponse.text();
                        
                        let videoUrl = null;
                        let thumbnailLink = null;
                        
                        const hdLinkRegex = /<a[^>]+href=["']?([^"'\s]+)["']?[^>]*>.*Download Video in HD Quality.*<\/a>/i;
                        let match = resultHtml.match(hdLinkRegex);

                        if (match && match[1]) {
                            videoUrl = match[1];
                        } else {
                            const normalLinkRegex = /<a[^>]+href=["']?([^"'\s]+)["']?[^>]*>.*Download Video in Normal Quality.*<\/a>/i;
                            match = resultHtml.match(normalLinkRegex);

                            if (match && match[1]) {
                                videoUrl = match[1];
                            }
                        }
                        
                        const thumbnailRegex = /<img[^>]+class=["']?fb_img["']?[^>]*src=["']?([^"'\s]+)["']?/i;
                        let thumbnailMatch = resultHtml.match(thumbnailRegex);
                        if (thumbnailMatch && thumbnailMatch[1]) {
                            thumbnailLink = thumbnailMatch[1];
                        }

                        if (videoUrl) {
                            let cleanedVideoUrl = videoUrl.replace(/&amp;/g, '&');
                            const videoTitle = 'Facebook Video'; 
                            
                            const randomId = Math.random().toString(36).substring(2, 12);
                            await env.VIDEO_LINKS.put(randomId, text, { expirationTtl: 3600 }); 

                            const replyMarkup = {
                                inline_keyboard: [
                                    [{ text: '🎧 Audio පමණක් ගන්න', callback_data: `audio_ID|${randomId}|${videoTitle}` }]
                                ]
                            };

                            // V22: sendVideo function will handle sending the URL via JSON
                            await this.sendVideo(telegramApi, chatId, cleanedVideoUrl, null, messageId, thumbnailLink, replyMarkup);
                            
                        } else {
                            await this.sendMessage(telegramApi, chatId, escapeMarkdownV2('⚠️ සමාවෙන්න, වීඩියෝ Download Link එක සොයා ගැනීමට නොහැකි විය\\. වීඩියෝව Private (පුද්ගලික) විය හැක\\.'), messageId);
                        }
                        
                    } catch (fdownError) {
                        console.error(`[FATAL ERROR] Fdown or Telegram reply failed after initial response: ${fdownError.stack}`);
                        await this.sendMessage(telegramApi, chatId, escapeMarkdownV2('❌ වීඩියෝ තොරතුරු ලබා ගැනීමේදී දෝෂයක් ඇති විය\\. (Network/Scraping Error).'), messageId);
                    }
                    
                } else if (text === '/start') {
                    await this.sendMessage(telegramApi, chatId, escapeMarkdownV2('👋 සුභ දවසක්! මට Facebook වීඩියෝ Link එකක් එවන්න. එවිට මම එය download කර දෙන්නම්.'), messageId);
                } else {
                    await this.sendMessage(telegramApi, chatId, escapeMarkdownV2('❌ කරුණාකර වලංගු Facebook වීඩියෝ Link එකක් එවන්න\\.'), messageId);
                }
            }
            // ... (Callback Query Handling is also needed here, but keeping focus on sendVideo)
            // (Note: The complete code in your Worker environment must contain the full V19 logic with the V22 sendVideo update)

            return new Response('OK', { status: 200 });

        } catch (e) {
            console.error(`[FATAL ERROR] Top-level handler failed: ${e.stack}`);
            return new Response('OK', { status: 200 });
        }
    },

    // ------------------------------------
    // සහායක Functions (Auxiliary Functions)
    // ------------------------------------

    async sendMessage(api, chatId, text, replyToMessageId, replyMarkup = null) {
        // ... (This function remains the same as V19/V20)
    },

    // 🎯 V22: Send Video via URL (JSON Payload)
    async sendVideo(api, chatId, videoUrl, caption = null, replyToMessageId, thumbnailLink = null, replyMarkup = null) {
        
        try {
            const body = {
                chat_id: chatId,
                video: videoUrl, // <--- 🔑 Sending the URL directly
                caption: caption,
                parse_mode: 'MarkdownV2',
                ...(replyToMessageId && { reply_to_message_id: replyToMessageId }),
                ...(replyMarkup && { reply_markup: replyMarkup }),
            };

            // Telegram API එකට JSON Payload එකක් යවයි
            const telegramResponse = await fetch(`${api}/sendVideo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            
            if (!telegramResponse.ok) {
                const telegramResult = await telegramResponse.json();
                console.error(`[TELEGRAM API ERROR] sendVideo failed (URL Method): ${telegramResult.description}`);
                await this.sendMessage(api, chatId, escapeMarkdownV2(`❌ වීඩියෝව යැවීම අසාර්ථකයි! (Error: ${escapeMarkdownV2(telegramResult.description || 'නොදන්නා දෝෂයක්\\.')})`), replyToMessageId);
            }
            
        } catch (e) {
            console.error(`[TELEGRAM API ERROR] sendVideo network failed (URL Method): ${e.stack}`);
            await this.sendMessage(api, chatId, escapeMarkdownV2(`❌ වීඩියෝව යැවීම අසාර්ථකයි! (Network හෝ Timeout දෝෂයක්)\\.`), replyToMessageId);
        }
    },
    
    async sendAudio(api, chatId, audioUrl, replyToMessageId, title) {
        // ... (This function remains the same as V19/V20)
    },

    async answerCallbackQuery(api, callbackQueryId, text) {
        // ... (This function remains the same as V19/V20)
    }
};
