/**
 * src/index.js
 * Complete Code Hybrid V63 (Large Video Download Link Feature Added + Memory Error Fallback Fix)
 * Developer: @chamoddeshan
 */

// *****************************************************************
// ********** [ 1. Configurations and Constants ] ********************
// *****************************************************************
const BOT_TOKEN = '8382727460:AAEgKVISJN5TTuV4O-82sMGQDG3khwjiKR8'; 
const OWNER_ID = '1901997764'; 
const API_URL = "https://fdown.isuru.eu.org/info"; // JSON API for Metadata/Thumbnail

// --- NEW CONSTANT: Max file size for direct Telegram upload (50 MB in Bytes) ---
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB limit
// *****************************************************************

// Telegram API Base URL
const telegramApi = `https://api.telegram.org/bot${BOT_TOKEN}`;

// --- Helper Functions ---

function htmlBold(text) {
    return `<b>${text}</b>`;
}

/**
 * Seconds to H:MM:SS or M:SS format (Fixed to handle decimals and round off).
 */
function formatDuration(seconds) {
    if (typeof seconds !== 'number' || seconds < 0) return 'N/A';
    
    const totalSeconds = Math.round(seconds); 

    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    
    if (h > 0) {
        return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    } else {
        return `${m}:${String(s).padStart(2, '0')}`;
    }
}

/**
 * Creates the final formatted caption string based on API data.
 */
function formatCaption(data) {
    const { videoTitle, uploader, duration, views, uploadDate } = data;
    
    const formattedDuration = formatDuration(duration);
    const formattedViews = typeof views === 'number' ? views.toLocaleString('en-US') : views;
    
    // Format Upload Date from YYYYMMDD to YYYY-MM-DD
    let formattedDate = uploadDate;
    if (uploadDate && /^\d{8}$/.test(uploadDate)) {
        formattedDate = uploadDate.substring(0, 4) + '-' + uploadDate.substring(4, 6) + '-' + uploadDate.substring(6, 8);
    }
    
    // Main Title
    let caption = htmlBold(videoTitle);
    
    // Metadata block
    caption += `\n\n`;
    caption += `👤 ${htmlBold(uploader)}\n`;
    caption += `⏱️ Duration: ${htmlBold(formattedDuration)}\n`;
    caption += `👁️ Views: ${htmlBold(formattedViews)}\n`;
    caption += `📅 Uploaded: ${htmlBold(formattedDate)}`; 
    
    // Add developer/copyright info at the end for the final output
    caption += `\n\n◇───────────────◇\n`
    caption += `🚀 Developer: @chamoddeshan\n`
    caption += `🔥 C D H Corporation ©`;


    return caption;
}

// *** PROGRESS_STATES for progress bar ***
const PROGRESS_STATES = [
    { text: "⏳ <b>Loading</b>...▒▒▒▒▒▒▒▒▒▒", percentage: "0%" },
    { text: "📥 <b>Downloading</b>...█▒▒▒▒▒▒▒▒▒", percentage: "10%" },
    { text: "📥 <b>Downloading</b>...██▒▒▒▒▒▒▒▒", percentage: "20%" },
    { text: "📥 <b>Downloading</b>...███▒▒▒▒▒▒▒", percentage: "30%" },
    { text: "📤 <b>Uploading</b>...████▒▒▒▒▒▒", percentage: "40%" },
    { text: "📤 <b>Uploading</b>...█████▒▒▒▒▒", percentage: "50%" },
    { text: "📤 <b>Uploading</b>...██████▒▒▒▒", percentage: "60%" },
    { text: "📤 <b>Uploading</b>...███████▒▒▒", percentage: "70%" },
    { text: "✨ <b>Finalizing</b>...████████▒▒", percentage: "80%" },
    { text: "✨ <b>Finalizing</b>...█████████▒", percentage: "90%" },
    { text: "✅ <b>Done!</b> ██████████", percentage: "100%" } 
];


// *****************************************************************
// ********** [ 2. WorkerHandlers Class ] ****************************
// *****************************************************************

class WorkerHandlers {
    
    constructor(env) {
        this.env = env;
        this.progressActive = true; 
    }
    
    // ... (KV DB Management and Telegram API Helpers like sendMessage, editMessage, etc. remain the same) ...

    async sendMessage(chatId, text, replyToMessageId, inlineKeyboard = null) {
        // Implementation remains the same
        try {
            const response = await fetch(`${telegramApi}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: text, 
                    parse_mode: 'HTML',
                    ...(replyToMessageId && { reply_to_message_id: replyToMessageId }),
                    ...(inlineKeyboard && { reply_markup: { inline_keyboard: inlineKeyboard } }),
                }),
            });
            const result = await response.json();
            if (!response.ok) {
                console.error(`sendMessage API Failed (Chat ID: ${chatId}):`, result);
                return null;
            }
            return result.result.message_id;
        } catch (e) { 
            console.error(`sendMessage Fetch Error (Chat ID: ${chatId}):`, e);
            return null;
        }
    }
    
    async deleteMessage(chatId, messageId) {
        // Implementation remains the same
        try {
            const response = await fetch(`${telegramApi}/deleteMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    message_id: messageId,
                }),
            });
             if (!response.ok) {
                console.warn(`deleteMessage API Failed (Chat ID: ${chatId}, Msg ID: ${messageId}):`, await response.text());
            }
        } catch (e) { 
             console.error(`deleteMessage Fetch Error (Chat ID: ${chatId}):`, e);
        }
    }
    
    async editMessage(chatId, messageId, text, inlineKeyboard = null) {
        // Implementation remains the same
        try {
            const body = {
                chat_id: chatId,
                message_id: messageId,
                text: text,
                parse_mode: 'HTML', 
                ...(inlineKeyboard && { reply_markup: { inline_keyboard: inlineKeyboard } }),
            };
            const response = await fetch(`${telegramApi}/editMessageText`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            
            const result = await response.json(); 

             if (!response.ok) {
                if (result.error_code === 400 && result.description && result.description.includes("message to edit not found")) {
                     return;
                } else {
                     console.error(`editMessage API Failed (Chat ID: ${chatId}):`, result);
                }
            }
        } catch (e) { 
             console.error(`editMessage Fetch Error (Chat ID: ${chatId}):`, e);
        }
    }


    // --- NEW: Send Download Link for Large Videos (V63 Addition) ---
    async sendLinkMessage(chatId, videoUrl, caption, replyToMessageId) {
        // Implementation remains the same
        const inlineKeyboard = [
            [{ text: '🔽 වීඩියෝව බාගත කරන්න (Download Video)', url: videoUrl }],
            [{ text: 'C D H Corporation © ✅', callback_data: 'ignore_c_d_h' }] 
        ];

        const titleMatch = caption.match(/<b>(.*?)<\/b>/);
        const videoTitle = titleMatch ? titleMatch[1] : 'Video File';
        
        const largeFileMessage = htmlBold("⚠️ විශාල ගොනුවක් හඳුනා ගැනේ.") + `\n\n`
                               + `දැනට පවතින සීමාවන් (${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB) නිසා වීඩියෝව කෙලින්ම යැවිය නොහැක. ඒ වෙනුවට, පහත බොත්තම භාවිතා කර බාගත කරන්න.\n\n`
                               + htmlBold("Title:") + ` ${videoTitle}`; 

        await this.sendMessage(
            chatId, 
            largeFileMessage, 
            replyToMessageId, 
            inlineKeyboard
        );
    }

    // --- sendVideo (MODIFIED: Now Throws on Fatal Error) ---
    async sendVideo(chatId, videoUrl, caption = null, replyToMessageId, thumbnailLink = null, inlineKeyboard = null) {
        
        console.log(`[DEBUG] Attempting to send video. URL: ${videoUrl.substring(0, 50)}...`);
        
        try {
            // FIX: 403 Forbidden Error මඟහැරීමට User-Agent සහ Referer Headers එකතු කිරීම.
            const videoResponse = await fetch(videoUrl, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Referer': 'https://fdown.net/',
                },
            });
            
            if (videoResponse.status !== 200) {
                console.error(`[DEBUG] Video Fetch Failed! Status: ${videoResponse.status} for URL: ${videoUrl}`);
                if (videoResponse.body) { await videoResponse.body.cancel(); }
                // 🛑 Throw an error instead of sending a message
                throw new Error(`Video Fetch Failed (HTTP ${videoResponse.status})`); 
            }
            
            const videoBlob = await videoResponse.blob();
            
            const formData = new FormData();
            formData.append('chat_id', chatId);
            
            if (caption) {
                formData.append('caption', caption);
                formData.append('parse_mode', 'HTML'); 
            }
            
            if (replyToMessageId) {
                formData.append('reply_to_message_id', replyToMessageId);
            }
            
            console.log(`[DEBUG] Video Blob size: ${videoBlob.size} bytes`);
            formData.append('video', videoBlob, 'video.mp4'); 

            if (thumbnailLink) {
                try {
                    const thumbResponse = await fetch(thumbnailLink);
                    if (thumbResponse.ok) {
                        const thumbBlob = await thumbResponse.blob();
                        formData.append('thumb', thumbBlob, 'thumbnail.jpg');
                    } else {
                        if (thumbResponse.body) { await thumbResponse.body.cancel(); }
                    } 
                } catch (e) { 
                    console.warn("Thumbnail fetch failed:", e);
                }
            }
            
            if (inlineKeyboard) {
                formData.append('reply_markup', JSON.stringify({
                    inline_keyboard: inlineKeyboard
                }));
            }

            const telegramResponse = await fetch(`${telegramApi}/sendVideo`, {
                method: 'POST',
                body: formData, 
            });
            
            const telegramResult = await telegramResponse.json();
            
            if (!telegramResponse.ok) {
                console.error(`[DEBUG] sendVideo API Failed! Result:`, telegramResult);
                 // 🛑 Throw an error instead of sending a message
                throw new Error(`Telegram API Error: ${telegramResult.description || 'Unknown Telegram Error.'}`);
            } else {
                 console.log(`[DEBUG] sendVideo successful.`);
            }
            
        } catch (e) {
            // Memory limit error (TypeError: Memory limit would be exceeded before EOF.) will be caught here
            console.error(`[DEBUG] sendVideo Fatal Error:`, e);
            throw e; // 🛑 Re-throw the error to the main handler
        }
    }
    // ... (rest of the WorkerHandlers class, like simulateProgress and broadcastMessage, remains the same)
}


// *****************************************************************
// ********** [ 3. Hybrid Data Retrieval Functions ] *****************
// *****************************************************************

/**
 * Function 1: Get Thumbnail/Title/Metadata from JSON API (V63: Filesize added)
 */
async function getApiMetadata(link) {
    // Implementation remains the same (fetches filesize)
    try {
        const apiResponse = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'CloudflareWorker/1.0'
            },
            body: JSON.stringify({ url: link })
        });
        
        if (!apiResponse.ok) {
            throw new Error(`API request failed with status ${apiResponse.status}`);
        }
        
        const videoData = await apiResponse.json();
        
        const info = videoData.video_info || videoData.data || videoData;
        
        let rawThumbnailLink = null;
        let videoTitle = 'Facebook Video';
        let uploader = 'Unknown Uploader';
        let duration = 0;
        let views = 0;
        let uploadDate = 'N/A';
        let filesize = 0; // <<< Filesize Variable Added
        
        if (info) {
            if (info.thumbnail) {
                rawThumbnailLink = info.thumbnail.replace(/&amp;/g, '&');
            }
            if (info.title) {
                videoTitle = info.title;
            }
            uploader = info.uploader || info.page_name || 'Unknown Uploader';
            duration = info.duration || 0;
            views = info.view_count || info.views || 0;
            uploadDate = info.upload_date || 'N/A';
            filesize = info.filesize || 0; // <<< Retrieve filesize (in bytes)
        }

        return {
            thumbnailLink: rawThumbnailLink,
            videoTitle: videoTitle,
            uploader: uploader,
            duration: duration,
            views: views,
            uploadDate: uploadDate,
            filesize: filesize // <<< Return Filesize
        };

    } catch (e) {
        console.warn("[WARN] API Metadata fetch failed:", e.message);
        return { 
            thumbnailLink: null, 
            videoTitle: "Facebook Video", 
            uploader: 'Unknown Uploader',
            duration: 0,
            views: 0,
            uploadDate: 'N/A',
            filesize: 0 
        };
    }
}


/**
 * Function 2: Get Working Video Link from HTML Scraper
 */
async function scrapeVideoLinkAndThumbnail(link) {
    // Implementation remains the same
    const fdownUrl = "https://fdown.net/download.php";
    
    const formData = new URLSearchParams();
    formData.append('URLz', link); 

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

    if (!fdownResponse.ok) {
        throw new Error(`Scraper request failed with status ${fdownResponse.status}`);
    }

    const resultHtml = await fdownResponse.text();
    let videoUrl = null;
    let fallbackThumbnail = null;

    // Download Links Scraping (Prioritize HD)
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
    
    // Get Fallback Thumbnail Link from scraper
    const thumbnailRegex = /<img[^>]+class=["']?fb_img["']?[^>]*src=["']?([^"'\s]+)["']?/i;
    let thumbnailMatch = resultHtml.match(thumbnailRegex);
    if (thumbnailMatch && thumbnailMatch[1]) {
         fallbackThumbnail = thumbnailMatch[1];
    }


    return {
        videoUrl: videoUrl ? videoUrl.replace(/&amp;/g, '&') : null,
        fallbackThumbnail: fallbackThumbnail ? fallbackThumbnail.replace(/&amp;/g, '&') : null
    };
}


// *****************************************************************
// ********** [ 4. Main Fetch Handler (FIXED LOGIC) ] ****************
// *****************************************************************

export default {
    
    async fetch(request, env, ctx) {
        if (request.method !== 'POST') {
            return new Response('Hello, I am your FDOWN Telegram Worker Bot.', { status: 200 });
        }
        
        const handlers = new WorkerHandlers(env);
        
        // --- Inline Keyboards ---
        const userInlineKeyboard = [
            [{ text: 'C D H Corporation © ✅', callback_data: 'ignore_c_d_h' }] 
        ];
        
        const initialProgressKeyboard = [
             [{ text: PROGRESS_STATES[0].text.replace(/<[^>]*>/g, ''), callback_data: 'ignore_progress' }]
        ];
        // ------------------------

        try {
            const update = await request.json();
            const message = update.message;
            const callbackQuery = update.callback_query;
            
            if (!message && !callbackQuery) {
                 return new Response('OK', { status: 200 });
            }
            
            ctx.waitUntil(new Promise(resolve => setTimeout(resolve, 0)));


            // --- 1. Message Handling ---
            if (message) { 
                const chatId = message.chat.id;
                const messageId = message.message_id;
                const text = message.text ? message.text.trim() : null; 
                const isOwner = OWNER_ID && chatId.toString() === OWNER_ID.toString();
                
                // ... (start command, broadcast logic are unchanged) ...

                // C. Facebook Link Handling (FIXED Hybrid Logic - V63)
                if (text) { 
                    const isLink = /^https?:\/\/(www\.)?(facebook\.com|fb\.watch|fb\.me)/i.test(text);
                    
                    if (isLink) {
                        
                        // 1. Initial Message Send & Progress Start
                        const initialText = htmlBold('⌛️ වීඩියෝව හඳුනා ගැනේ... කරුණාකර මොහොතක් රැඳී සිටින්න.'); 
                        const progressMessageId = await handlers.sendMessage(
                            chatId, 
                            initialText, 
                            messageId, 
                            initialProgressKeyboard
                        );
                        
                        if (progressMessageId) {
                            ctx.waitUntil(handlers.simulateProgress(chatId, progressMessageId, messageId));
                        }
                        
                        // 2. Start Scraping and Fetching
                        try {
                            const apiData = await getApiMetadata(text);
                            const finalCaption = formatCaption(apiData);
                            
                            const scraperData = await scrapeVideoLinkAndThumbnail(text);
                            const videoUrl = scraperData.videoUrl;
                            
                            const finalThumbnailLink = apiData.thumbnailLink || scraperData.fallbackThumbnail;

                            
                            // 3. Send Video or Error (FIXED V63 Logic)
                            if (videoUrl) {
                                handlers.progressActive = false; 
                                
                                // A. Check against the API reported size
                                if (apiData.filesize > MAX_FILE_SIZE_BYTES) {
                                    // 3.1. Send Download Link (If too large by API report)
                                    if (progressMessageId) {
                                        await handlers.deleteMessage(chatId, progressMessageId);
                                    }
                                    
                                    await handlers.sendLinkMessage(
                                        chatId,
                                        videoUrl, 
                                        finalCaption, 
                                        messageId
                                    );
                                    
                                } else {
                                    // B. Attempt Direct Upload with Fallback (If API reported small or 0)
                                    if (progressMessageId) {
                                        await handlers.deleteMessage(chatId, progressMessageId);
                                    }
                                    
                                    try {
                                        // Try to upload directly (This will fail for large files)
                                        await handlers.sendVideo(
                                            chatId, 
                                            videoUrl, 
                                            finalCaption, 
                                            messageId, 
                                            finalThumbnailLink, 
                                            userInlineKeyboard
                                        ); 
                                    } catch (e) {
                                        // 3.2. FALLBACK: If sendVideo fails (e.g., Memory Limit or large file that API missed)
                                        console.warn(`[FALLBACK] Direct upload failed: ${e.message}. Sending download link.`);
                                        
                                        // Send a warning message about the failure
                                        await handlers.sendMessage(chatId, htmlBold(`⚠️ වීඩියෝව Upload කිරීමට අසාර්ථක විය.`) + `\n\nමෙය විශාල ගොනුවක් නිසා විය හැක. ඒ වෙනුවට Download Link එකක් යවනු ලැබේ.`, messageId);
                                        
                                        // Send the Download Link
                                        await handlers.sendLinkMessage(
                                            chatId,
                                            videoUrl, 
                                            finalCaption, 
                                            null // No reply to reply_to_message_id, reply to the new warning message
                                        );
                                    }
                                }
                                
                            } else {
                                console.error(`[DEBUG] Video Link not found for: ${text}`);
                                handlers.progressActive = false;
                                const errorText = htmlBold('⚠️ සමාවෙන්න, වීඩියෝ Download Link එක සොයා ගැනීමට නොහැකි විය. වීඩියෝව Private (පුද්ගලික) විය හැක.');
                                if (progressMessageId) {
                                    await handlers.editMessage(chatId, progressMessageId, errorText); 
                                } else {
                                    await handlers.sendMessage(chatId, errorText, messageId);
                                }
                            }
                            
                        } catch (fdownError) {
                            console.error(`[DEBUG] FDown Scraping/API Error (Chat ID: ${chatId}):`, fdownError);
                            handlers.progressActive = false;
                            const errorText = htmlBold('❌ වීඩියෝ තොරතුරු ලබා ගැනීමේදී දෝෂයක් ඇති විය.');
                            if (progressMessageId) {
                                await handlers.editMessage(chatId, progressMessageId, errorText);
                            } else {
                                await handlers.sendMessage(chatId, errorText, messageId);
                            }
                        }
                        
                    } else {
                        await handlers.sendMessage(chatId, htmlBold('❌ කරුණාකර වලංගු Facebook වීඩියෝ Link එකක් එවන්න.'), messageId);
                    }
                } 
            }
            
            // --- 2. Callback Query Handling (Unchanged) ---
            if (callbackQuery) {
                 // ... (Callback logic unchanged)
                 return new Response('OK', { status: 200 });
            }

            return new Response('OK', { status: 200 });

        } catch (e) {
            console.error("--- FATAL FETCH ERROR (Worker Logic Error) ---");
            console.error("The worker failed to process the update: " + e.message);
            console.error("-------------------------------------------------");
            return new Response('OK', { status: 200 }); 
        }
    }
};
