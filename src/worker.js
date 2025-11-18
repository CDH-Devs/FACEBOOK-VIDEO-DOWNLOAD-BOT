/**
 * src/index.js
 * Final Fix V15: Combining ThumbDownloader (Thumbnail) and Fdown.net (Video)
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
    cleaned = cleaned.replace(/([_\[\]()~`>#+\-=|{}.!\\\\])/g, '\\$1'); 
    return cleaned;
}

export default {
    async fetch(request, env, ctx) {
        if (request.method !== 'POST') {
            return new Response('Hello, I am your FDOWN Telegram Worker Bot.', { status: 200 });
        }

        const BOT_TOKEN = env.BOT_TOKEN;
        const telegramApi = `https://api.telegram.org/bot${BOT_TOKEN}`;

        try {
            const update = await request.json();
            const message = update.message;

            if (message && message.text) {
                const chatId = message.chat.id;
                const text = message.text.trim();
                const messageId = message.message_id;
                
                if (text === '/start') {
                    await this.sendMessage(telegramApi, chatId, escapeMarkdownV2('👋 සුභ දවසක්! මට Facebook වීඩියෝ Link එකක් එවන්න\\. එවිට මම එය download කර දෙන්නම්\\.'), messageId);
                    return new Response('OK', { status: 200 });
                }

                const isLink = /^https?:\/\/(www\.)?(facebook\.com|fb\.watch|fb\.me)/i.test(text);
                
                if (isLink) {
                    // Two-Step process Message
                    await this.sendMessage(telegramApi, chatId, escapeMarkdownV2('⌛️ Thumbnail (ThumbDownloader) සහ Video (FDown\\.net) Links සොයා ගැනේ... කරුණාකර මොහොතක් රැඳී සිටින්න\\.'), messageId);
                    
                    let videoUrl = null;
                    let thumbnailLink = null;
                    let videoTitle = "මාතෘකාවක් නොමැත";
                    let videoStats = "";
                    let quality = "Normal";

                    // --- 1. ThumbDownloader Scraping for Thumbnail ---
                    try {
                        const encodedLink = encodeURIComponent(text);
                        const thumbdownloaderUrl = `https://www.thumbdownloader.com/facebook-thumbnail?u=${encodedLink}`;

                        const thumbResponse = await fetch(thumbdownloaderUrl, {
                            method: 'GET',
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                                'Referer': 'https://www.thumbdownloader.com/', 
                            },
                        });

                        const thumbResultHtml = await thumbResponse.text();
                        
                        // Scrape Thumbnail Link (Searching for the download button link or an image tag)
                        const downloadLinkRegex = /<a[^>]+href=["']?([^"'\s]+)["']?[^>]*>\s*<button[^>]*>Download Image<\/button>/i;
                        let downloadMatch = thumbResultHtml.match(downloadLinkRegex);

                        if (downloadMatch && downloadMatch[1]) {
                            thumbnailLink = downloadMatch[1];
                        } else {
                            // Fallback: search for a high-res image link
                            const imageTagRegex = /<img[^>]+src=["']?([^"'\s]+)["']?[^>]*alt=["']?Download Facebook Thumbnail/i;
                            let imageMatch = thumbResultHtml.match(imageTagRegex);

                            if (imageMatch && imageMatch[1]) {
                                thumbnailLink = imageMatch[1];
                            }
                        }

                        if (thumbnailLink) {
                            thumbnailLink = thumbnailLink.replace(/&amp;/g, '&');
                        }

                    } catch (thumbError) {
                        console.error("Thumbnail scraping failed, proceeding with video download:", thumbError);
                    }


                    // --- 2. Fdown.net Scraping for Video Link and Metadata ---
                    try {
                        const fdownUrl = "https://fdown.net/download.php";
                        
                        const formData = new URLSearchParams();
                        formData.append('url', text); 
                        formData.append('submit', 'Download'); 

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

                        const fdownResultHtml = await fdownResponse.text();
                        
                        // HD Link සොයා ගැනීම
                        const hdLinkRegex = /<a href="([^"]+)" target="_blank" class="[^"]*btn-download[^"]*"[^>]*>\s*HD Video\s*<\/a>/i;
                        let hdMatch = fdownResultHtml.match(hdLinkRegex);

                        if (hdMatch && hdMatch[1]) {
                            videoUrl = hdMatch[1];
                            quality = "HD"; 
                        } else {
                            // SD Link සොයා ගැනීම
                            const sdLinkRegex = /<a href="([^"]+)" target="_blank" class="[^"]*btn-download[^"]*"[^>]*>\s*SD Video\s*<\/a>/i;
                            let sdMatch = fdownResultHtml.match(sdLinkRegex);

                            if (sdMatch && sdMatch[1]) {
                                videoUrl = sdMatch[1];
                                quality = "SD";
                            }
                        }

                        // Title Scraping
                        const videoTitleRegex = /<p[^>]*class=["']?card-text[^"']*["']?>\s*<strong[^>]*>Title:\s*<\/strong>\s*([\s\S]*?)<\/p>/i;
                        let titleMatch = fdownResultHtml.match(videoTitleRegex);
                        
                        if (titleMatch && titleMatch[1]) {
                            let scrapedTitle = sanitizeText(titleMatch[1]);
                            if (scrapedTitle.length > 900) { 
                                scrapedTitle = scrapedTitle.substring(0, 897) + "\\.\\.\\."; 
                            }
                            videoTitle = scrapedTitle;
                        }

                        // Stats Scraping (Description)
                        const videoStatsRegex = /<p[^>]*class=["']?card-text[^"']*["']?>\s*<strong[^>]*>Description:\s*<\/strong>\s*([\s\S]*?)<\/p>/i;
                        let statsMatch = fdownResultHtml.match(videoStatsRegex);

                        if (statsMatch && statsMatch[1]) {
                            videoStats = sanitizeText(statsMatch[1]);
                            videoStats = videoStats.length > 0 ? `Description: ${videoStats}` : `Description: නොමැත`;
                        } else {
                            videoStats = `විස්තර තොරතුරු නොමැත\\.`;
                        }
                        
                        if (videoUrl) {
                            videoUrl = videoUrl.replace(/&amp;/g, '&');
                        }

                    } catch (fdownError) {
                        console.error("Fdown scraping failed:", fdownError);
                        // videoUrl remains null
                    }


                    // --- 3. Final Caption and Sending ---
                    
                    let finalCaption = `**${videoTitle}**\n\nQuality: ${quality}\n${videoStats}\n\n[🔗 Original Link](${text})`;
                    
                    if (finalCaption.length > 1024) {
                        finalCaption = finalCaption.substring(0, 1000) + '\\.\\.\\. \\(Caption Truncated\\)'; 
                    }

                    if (videoUrl) {
                        // Send the video with the scraped thumbnail
                        await this.sendVideo(telegramApi, chatId, videoUrl, finalCaption, messageId, thumbnailLink);
                        
                    } else {
                        // Send error message (Fdown failed)
                        let errorCaption = `❌ සමාවෙන්න, Download Link එක (HD/SD) fdown\\.net වෙතින් සොයා ගැනීමට නොහැකි විය\\. වීඩියෝව Private විය හැක\\.`;
                        if (thumbnailLink) {
                            errorCaption += `\n\nThumbnail Link එක සොයා ගන්නා ලදී, නමුත් වීඩියෝවක් යැවීමට නොහැක\\.`;
                        }
                        errorCaption += ` (Link: ${escapeMarkdownV2(text)})`;
                        
                        await this.sendMessage(telegramApi, chatId, errorCaption, messageId);
                    }
                    
                } else {
                    await this.sendMessage(telegramApi, chatId, escapeMarkdownV2('❌ කරුණාකර වලංගු Facebook වීඩියෝ Link එකක් එවන්න\\.'), messageId);
                }
            }

            return new Response('OK', { status: 200 });

        } catch (e) {
            console.error("General error:", e);
            return new Response('OK', { status: 200 }); 
        }
    },

    async sendMessage(api, chatId, text, replyToMessageId) {
        try {
            await fetch(`${api}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: text, 
                    parse_mode: 'MarkdownV2', 
                    ...(replyToMessageId && { reply_to_message_id: replyToMessageId }),
                }),
            });
        } catch (e) {
            console.error("Error sending message:", e);
        }
    },

    async sendVideo(api, chatId, videoUrl, caption = null, replyToMessageId, thumbnailLink = null) {
        
        const videoResponse = await fetch(videoUrl);
        
        if (videoResponse.status !== 200) {
            
            let messageText = `⚠️ වීඩියෝව කෙලින්ම Upload කිරීමට අසාර්ථකයි\\. CDN වෙත පිවිසීමට නොහැක\\.`;

            if (caption) {
                 messageText = `❌ වීඩියෝව Download කිරීමට අසාර්ථකයි! වීඩියෝ Link එක බිඳී ඇත\\. තොරතුරු: ${caption.replace(/\*\*/g, '').replace(/\[.*\]/g, '').trim()}`;
            }

            await this.sendMessage(api, chatId, escapeMarkdownV2(messageText), replyToMessageId);
            return;
        }
        
        const videoBlob = await videoResponse.blob();
        
        const formData = new FormData();
        formData.append('chat_id', chatId);
        
        if (caption) {
            formData.append('caption', caption);
            formData.append('parse_mode', 'MarkdownV2'); 
        }
        
        if (replyToMessageId) {
            formData.append('reply_to_message_id', replyToMessageId);
        }
        
        formData.append('video', videoBlob, 'video.mp4'); 

        // Add Thumbnail
        if (thumbnailLink) {
            try {
                const thumbResponse = await fetch(thumbnailLink);
                if (thumbResponse.ok) {
                    const thumbBlob = await thumbResponse.blob();
                    formData.append('thumb', thumbBlob, 'thumbnail.jpg');
                } 
            } catch (e) {
                console.error("Error fetching thumbnail:", e);
            }
        }

        try {
            const telegramResponse = await fetch(`${api}/sendVideo`, {
                method: 'POST',
                body: formData, 
            });
            
            const telegramResult = await telegramResponse.json();
            
            if (!telegramResponse.ok) {
                await this.sendMessage(api, chatId, escapeMarkdownV2(`❌ වීඩියෝව යැවීම අසාර්ථකයි! (Error: ${telegramResult.description || 'නොදන්නා දෝෂයක්\\.'})`), replyToMessageId);
            }
            
        } catch (e) {
            await this.sendMessage(api, chatId, escapeMarkdownV2(`❌ වීඩියෝව යැවීම අසාර්ථකයි! (Network හෝ Timeout දෝෂයක්)\\.`), replyToMessageId);
        }
    }
};
