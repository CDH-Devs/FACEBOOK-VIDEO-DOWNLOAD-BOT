/**
 * src/index.js
 * Final Fix V15 (Simulated Progress Bar for Video Fetch/Upload)
 */

// ** 1. MarkdownV2 හි සියලුම විශේෂ අක්ෂර Escape කිරීමේ Helper Function **
function escapeMarkdownV2(text) {
    if (!text) return "";
    return text.replace(/([_*[\]()~`>#+\-=|{}.!\\\\])/g, '\\$1');
}

// ** 2. Sanitize Text **
function sanitizeText(text) {
    if (!text) return "";
    let cleaned = text.replace(/<[^>]*>/g, '').trim();
    cleaned = cleaned.replace(/\s\s+/g, ' ');
    cleaned = cleaned.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    return escapeMarkdownV2(cleaned); 
}

// ** 3. Progress Bar Logic **
const PROGRESS_STATES = [
    { text: "𝙇𝙤𝙖𝙙𝙞𝙣𝙜…▒▒▒▒▒▒▒▒▒▒", percentage: "0%" },
    { text: "𝘿𝙤𝙬𝙣𝙡𝙤𝙖𝙙𝙞𝙣𝙜…█▒▒▒▒▒▒▒▒▒", percentage: "10%" },
    { text: "𝘿𝙤𝙬𝙣𝙡𝙤𝙖𝙙𝙞𝙣𝙜…██▒▒▒▒▒▒▒▒", percentage: "20%" },
    { text: "𝘿𝙤𝙬𝙣𝙡𝙤𝙖𝙙𝙞𝙣𝙜…███▒▒▒▒▒▒▒", percentage: "30%" },
    { text: "𝙐𝙥𝙡𝙤𝙖𝙙𝙞𝙣𝙜…████▒▒▒▒▒▒", percentage: "40%" },
    { text: "𝙐𝙥𝙡𝙤𝙖𝙙𝙞𝙣𝙜…█████▒▒▒▒▒", percentage: "50%" },
    { text: "𝙐𝙥𝙡𝙤𝙖𝙙𝙞𝙣𝙜…██████▒▒▒▒", percentage: "60%" },
    { text: "𝙐𝙥𝙡𝙤𝙖𝙙𝙞𝙣𝙜…███████▒▒▒", percentage: "70%" },
    { text: "𝙁𝙞𝙣𝙖𝙡𝙞𝙯𝙞𝙣𝙜…████████▒▒", percentage: "80%" },
    { text: "𝙁𝙞𝙣𝙖𝙡𝙞𝙯𝙞𝙣𝙜…█████████▒", percentage: "90%" },
    { text: "✅ 𝘿𝙤𝙣𝙚\\! ██████████", percentage: "100%" } 
];

// ** 4. Simulated Progress Function (Requires ctx.waitUntil) **
async function simulateProgress(api, chatId, messageId, originalReplyId) {
    const originalText = escapeMarkdownV2('⌛️ වීඩියෝව හඳුනා ගැනේ... කරුණාකර මොහොතක් රැඳී සිටින්න\\.');
    
    // Initial State - 0%
    const initialState = PROGRESS_STATES[0];
    const initialKeyboard = [
        [{ text: `${initialState.text} ${initialState.percentage}`, callback_data: 'ignore_progress' }]
    ];
    // First message is sent via sendMessage (in fetch), so we start with the first edit/state change.

    const statesToUpdate = PROGRESS_STATES.slice(1, 10); // 10% සිට 90% දක්වා

    for (let i = 0; i < statesToUpdate.length; i++) {
        // Cloudflare Worker එකකදී සැබෑ 'sleep' කළ නොහැක, නමුත් Promise එකකින් ප්‍රමාදයක් simulate කළ හැක.
        await new Promise(resolve => setTimeout(resolve, 800)); // 0.8 seconds delay
        
        const state = statesToUpdate[i];
        const newKeyboard = [
            [{ text: `${state.text} ${state.percentage}`, callback_data: 'ignore_progress' }]
        ];
        const newText = originalText + "\n" + escapeMarkdownV2(`\nStatus: ${state.text}`);
        
        try {
             // 0% Message එක Edit කරයි
            const editResponse = await fetch(`${api}/editMessageText`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    message_id: messageId,
                    text: newText,
                    parse_mode: 'MarkdownV2',
                    reply_markup: { inline_keyboard: newKeyboard }
                }),
            });
            if (!editResponse.ok) {
                console.error(`Progress Edit Failed:`, await editResponse.text());
                break; // Stop if editing fails
            }
        } catch (e) {
            console.error(`Progress Edit Fetch Error:`, e);
            break;
        }
    }
}


export default {
    
    // =======================================================
    // I. KV Database Access Functions
    // =======================================================

    // ... (saveUserId, getAllUsersCount, broadcastMessage - These functions remain the same) ...
    async saveUserId(env, userId) { /* ... */ },
    async getAllUsersCount(env) { /* ... */ },
    async broadcastMessage(env, telegramApi, fromChatId, messageId) { /* ... */ },


    // =======================================================
    // II. Telegram API Helper Functions (Logging Enhanced)
    // =======================================================

    // ** sendMessage - Now returns the message ID for editing **
    async sendMessage(api, chatId, text, replyToMessageId, inlineKeyboard = null) {
        try {
            const response = await fetch(`${api}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: text, 
                    parse_mode: 'MarkdownV2', 
                    ...(replyToMessageId && { reply_to_message_id: replyToMessageId }),
                    ...(inlineKeyboard && { reply_markup: { inline_keyboard: inlineKeyboard } }),
                }),
            });
            const result = await response.json();
            if (!response.ok) {
                console.error(`sendMessage API Failed (Chat ID: ${chatId}):`, result);
                return null;
            }
            return result.result.message_id; // Return new message ID
        } catch (e) { 
            console.error(`sendMessage Fetch Error (Chat ID: ${chatId}):`, e);
            return null;
        }
    },
    
    // ... (sendMessageWithKeyboard, editMessage, answerCallbackQuery - These functions remain the same) ...
    async sendMessageWithKeyboard(api, chatId, text, replyToMessageId, keyboard) { /* ... */ },
    async editMessage(api, chatId, messageId, text, inlineKeyboard = null) {
        try {
            const body = {
                chat_id: chatId,
                message_id: messageId,
                text: text,
                parse_mode: 'MarkdownV2',
                ...(inlineKeyboard && { reply_markup: { inline_keyboard: inlineKeyboard } }),
            };
            const response = await fetch(`${api}/editMessageText`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
             if (!response.ok) {
                console.error(`editMessage API Failed (Chat ID: ${chatId}):`, await response.text());
            }
        } catch (e) { 
             console.error(`editMessage Fetch Error (Chat ID: ${chatId}):`, e);
        }
    },
    async answerCallbackQuery(api, callbackQueryId, text) { /* ... */ },
    async sendVideo(api, chatId, videoUrl, caption = null, replyToMessageId, thumbnailLink = null, inlineKeyboard = null) { /* ... */ },


    // =======================================================
    // III. ප්‍රධාන fetch Handler (Link Handling Updated)
    // =======================================================

    async fetch(request, env, ctx) {
        if (request.method !== 'POST') {
            return new Response('Hello, I am your FDOWN Telegram Worker Bot.', { status: 200 });
        }
        
        // *****************************************************************
        // ********** [ ඔබගේ අගයන් මෙහි ඇතුළත් කර ඇත ] ********************
        // *****************************************************************
        const BOT_TOKEN = '8382727460:AAEgKVISJN5TTuV4O-82sMGQDG3khwjiKR8'; 
        const OWNER_ID = '1901997764'; 
        // *****************************************************************

        const telegramApi = `https://api.telegram.org/bot${BOT_TOKEN}`;

        const userInlineKeyboard = [
            [{ text: 'C D H Corporation © ✅', callback_data: 'ignore_c_d_h' }] 
        ];
        
        const initialProgressKeyboard = [
             [{ text: `${PROGRESS_STATES[0].text} ${PROGRESS_STATES[0].percentage}`, callback_data: 'ignore_progress' }]
        ];

        try {
            const update = await request.json();
            const message = update.message;
            const callbackQuery = update.callback_query;
            
            if (!message && !callbackQuery) {
                 return new Response('OK', { status: 200 });
            }
            ctx.waitUntil(new Promise(resolve => setTimeout(resolve, 0)));


            // ------------------------------------
            // 1. Message Handling
            // ------------------------------------
            if (message) { 
                const chatId = message.chat.id;
                const messageId = message.message_id;
                const text = message.text ? message.text.trim() : null; 
                const isOwner = OWNER_ID && chatId.toString() === OWNER_ID.toString();

                ctx.waitUntil(this.saveUserId(env, chatId));

                // ** C. Broadcast Message Logic **
                if (isOwner && message.reply_to_message) {
                    const repliedMessage = message.reply_to_message;
                    
                    if (repliedMessage.text && repliedMessage.text.includes("කරුණාකර දැන් ඔබ යැවීමට අවශ්‍ය පණිවිඩය එවන්න:")) {
                        
                        const originalMessageId = messageId;
                        const originalChatId = chatId;

                        await this.editMessage(telegramApi, chatId, repliedMessage.message_id, escapeMarkdownV2("📣 Broadcast කිරීම ආරම්භ විය\\. කරුණාකර රැඳී සිටින්න\\."));
                        
                        const results = await this.broadcastMessage(env, telegramApi, originalChatId, originalMessageId);
                        
                        const resultMessage = escapeMarkdownV2(`Message Send Successfully ✅`) + `\n\n` + escapeMarkdownV2(`🚀 Send: ${results.successfulSends}`) + `\n` + escapeMarkdownV2(`❗️ Faild: ${results.failedSends}`);
                        
                        await this.sendMessage(telegramApi, chatId, resultMessage, originalMessageId);
                        
                        return new Response('OK', { status: 200 });
                    }
                }
                
                // ** B. /start command Handling **
                if (text === '/start') {
                    // ... (Start command logic remains the same) ...
                    const userName = message.from.first_name || "ප්‍රියතම මිතුර"; 
                    const escapedUserName = escapeMarkdownV2(userName);

                    if (isOwner) {
                         const usersCount = await this.getAllUsersCount(env);
                         const ownerMessage = `👋 **පරිපාලක පැනලය**\n\nමෙමගින් ඔබගේ Bot එකේ දත්ත පරීක්ෂා කළ හැක\.`;
                         const ownerKeyboard = [
                             [{ text: `📊 දැනට සිටින Users: ${usersCount}`, callback_data: 'admin_users_count' }],
                             [{ text: '📣 සියලු Users වෙත පණිවිඩයක් යවන්න', callback_data: 'admin_broadcast' }]
                         ];
                         await this.sendMessageWithKeyboard(telegramApi, chatId, escapeMarkdownV2(ownerMessage), messageId, ownerKeyboard);
                    } else {
                         const userStartMessage = 
                             `👋 Hello Dear **${escapedUserName}**\\! \n\n` +
                             `💁‍♂️ මේ BOT ගෙන් පුළුවන් ඔයාට **Facebook Video** ලේසියෙන්ම **Download** කර ගන්න\\.\n\n` +
                             `🎯 මේ BOT පැය **24/7** ම Active එකේ තියෙනවා\\.\\🔔 \n\n` + 
                             `◇───────────────◇\n\n` +
                             `🚀 **Developer** : \\@chamoddeshan\n` + 
                             `🔥 **C D H Corporation** ©\n\n` +
                             `◇───────────────◇`;
                         await this.sendMessageWithKeyboard(
                             telegramApi, 
                             chatId, 
                             userStartMessage, 
                             messageId, 
                             userInlineKeyboard
                         );
                    }
                    return new Response('OK', { status: 200 });
                }

                
                // ** D. Facebook Link Handling (Progress Bar Implemented) **
                if (text) { 
                    const isLink = /^https?:\/\/(www\.)?(facebook\.com|fb\.watch|fb\.me)/i.test(text);
                    
                    if (isLink) {
                        
                        // 1. Initial Message Send (Progress 0%)
                        const initialText = escapeMarkdownV2('⌛️ වීඩියෝව හඳුනා ගැනේ... කරුණාකර මොහොතක් රැඳී සිටින්න\\.');
                        const progressMessageId = await this.sendMessage(
                            telegramApi, 
                            chatId, 
                            initialText, 
                            messageId, 
                            initialProgressKeyboard // 0% Keyboard
                        );
                        
                        // 2. Start Progress Simulation in background
                        if (progressMessageId) {
                            ctx.waitUntil(simulateProgress(telegramApi, chatId, progressMessageId, messageId));
                        }
                        
                        // 3. Start Scraping and Fetching
                        try {
                            const fdownUrl = "https://fdown.net/download.php";
                            const formData = new URLSearchParams();
                            formData.append('URLz', text); 
                            
                            const fdownResponse = await fetch(fdownUrl, { /* ... headers ... */ });
                            const resultHtml = await fdownResponse.text();
                            
                            let videoUrl = null;
                            let thumbnailLink = null;
                            // ... (Scraping logic remains the same) ...
                            const thumbnailRegex = /<img[^>]+class=["']?fb_img["']?[^>]*src=["']?([^"'\s]+)["']?/i;
                            let thumbnailMatch = resultHtml.match(thumbnailRegex);
                            if (thumbnailMatch && thumbnailMatch[1]) {
                                thumbnailLink = thumbnailMatch[1];
                            }

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
                            // ... (End of Scraping logic) ...
                            
                            // 4. Send Video or Error
                            if (videoUrl) {
                                let cleanedUrl = videoUrl.replace(/&amp;/g, '&');
                                
                                // Last Update to 100% (Done)
                                const doneState = PROGRESS_STATES[10];
                                const doneKeyboard = [
                                    [{ text: `${doneState.text} ${doneState.percentage}`, callback_data: 'ignore_progress' }]
                                ];
                                
                                // Edit the loading message one last time before sending video
                                if (progressMessageId) {
                                    const doneText = escapeMarkdownV2('✅ වීඩියෝව සකස් කර ඇත\\. දැන් යවනු ලැබේ\\.');
                                    await this.editMessage(telegramApi, chatId, progressMessageId, doneText, doneKeyboard);
                                }
                                
                                // Send the actual video
                                await this.sendVideo(
                                    telegramApi, 
                                    chatId, 
                                    cleanedUrl, 
                                    null, 
                                    messageId, 
                                    thumbnailLink, 
                                    userInlineKeyboard
                                ); 
                                
                            } else {
                                // Link Not Found Error
                                const errorText = escapeMarkdownV2('⚠️ සමාවෙන්න, වීඩියෝ Download Link එක සොයා ගැනීමට නොහැකි විය\\. වීඩියෝව Private \\(පුද්ගලික\\) විය හැක\\.');
                                if (progressMessageId) {
                                    await this.editMessage(telegramApi, chatId, progressMessageId, errorText);
                                } else {
                                    await this.sendMessage(telegramApi, chatId, errorText, messageId);
                                }
                            }
                            
                        } catch (fdownError) {
                            // Fetch/Scraping Error
                             console.error(`FDown Scraping Error (Chat ID: ${chatId}):`, fdownError);
                             const errorText = escapeMarkdownV2('❌ වීඩියෝ තොරතුරු ලබා ගැනීමේදී දෝෂයක් ඇති විය\\.');
                             if (progressMessageId) {
                                 await this.editMessage(telegramApi, chatId, progressMessageId, errorText);
                             } else {
                                 await this.sendMessage(telegramApi, chatId, errorText, messageId);
                             }
                        }
                        
                    } else {
                        // Not /start, not broadcast reply, not a link.
                        await this.sendMessage(telegramApi, chatId, escapeMarkdownV2('❌ කරුණාකර වලංගු Facebook වීඩියෝ Link එකක් එවන්න\\.'), messageId);
                    }
                } 
            }
            
            // ------------------------------------
            // 2. Callback Query Handling
            // ------------------------------------
            if (callbackQuery) {
                const data = callbackQuery.data;
                
                if (data === 'ignore_progress') {
                     await this.answerCallbackQuery(telegramApi, callbackQuery.id, "🎬 වීඩියෝව සකස් වෙමින් පවතී...");
                     return new Response('OK', { status: 200 });
                }
                
                // ... (Other callback logic remains the same) ...
                const chatId = callbackQuery.message.chat.id;
                const messageId = callbackQuery.message.message_id;
                
                if (OWNER_ID && chatId.toString() !== OWNER_ID.toString()) {
                     await this.answerCallbackQuery(telegramApi, callbackQuery.id, "❌ ඔබට මෙම විධානය භාවිතා කළ නොහැක\\.");
                     return new Response('OK', { status: 200 });
                }

                switch (data) {
                    case 'admin_users_count':
                        // ... (Admin logic remains the same) ...
                        break;
                    
                    case 'admin_broadcast':
                        // ... (Admin logic remains the same) ...
                        break;
                    
                    case 'ignore_c_d_h':
                        await this.answerCallbackQuery(telegramApi, callbackQuery.id, "මෙය තොරතුරු බොත්තමකි\\.");
                        break;
                }
                
                return new Response('OK', { status: 200 });
            }


            return new Response('OK', { status: 200 });

        } catch (e) {
            console.error("--- FATAL FETCH ERROR (Worker Logic Error) ---");
            console.error("The worker failed to process the update:", e);
            console.error("-------------------------------------------------");
            return new Response('OK', { status: 200 }); 
        }
    }
};
