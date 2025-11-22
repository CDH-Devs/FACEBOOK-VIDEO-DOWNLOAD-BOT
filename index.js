// fbindex.js - ENV විචල්‍යයන් සහ /download HTML Handler සමග යාවත්කාලීන කරන ලදී

import { WorkerHandlers } from './handlers';
import { getApiMetadata, scrapeVideoLinkAndThumbnail } from './api';
import { formatCaption, htmlBold } from './helpers';
import { PROGRESS_STATES } from './config'; // OWNER_ID ඉවත් කරන ලදී

export default {
    
    async fetch(request, env, ctx) {
        
        const url = new URL(request.url);
        
        // --- 1. /download GET REQUEST HANDLER (HTML Response) ---
        if (url.pathname === '/download' && request.method === 'GET') {
            
            // **සම්පූර්ණ index.html කේතය මෙතැනට ඇතුළු කරන්න.**
            const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title id="pageTitle">File Download - C D H Corporation</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        :root {
            --primary-color: #0088cc; /* Telegram Blue */
            --success-color: #28a745;
        }
        body { 
            background-color: #f8f9fa; 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        .container { 
            max-width: 800px; 
            margin-top: 50px; 
            margin-bottom: 50px;
        }
        .download-box { 
            background: #ffffff; 
            border-radius: 10px; 
            padding: 40px; 
            box-shadow: 0 5px 20px rgba(0, 0, 0, 0.1); 
        }
        .btn-download { 
            background-color: var(--success-color); 
            border-color: var(--success-color); 
            font-size: 1.5rem; 
            padding: 15px 40px; 
            border-radius: 50px; 
            transition: background-color 0.3s ease;
        }
        .btn-download:hover {
            background-color: #218838;
            border-color: #1e7e34;
        }
        .logo-text {
            color: var(--primary-color);
            font-weight: 700;
        }
        .status-badge {
            font-size: 0.9rem;
        }
        .detail-row {
            padding: 5px 0;
            border-bottom: 1px solid #eee;
        }
        .detail-row:last-child {
            border-bottom: none;
        }
        .thumb-img {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            margin-bottom: 20px;
        }
    </style>
</head>
<body>

<div class="container">
    <div class="download-box text-center">
        
        <h1 class="mb-4">
            <span class="logo-text">C D H Corporation</span> 
            <small class="badge bg-success status-badge">File Downloader</small>
        </h1>
        
        <div id="loadingState" class="mb-5">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-3 text-muted">Decoding link and preparing download...</p>
        </div>

        <div id="videoDetails" class="d-none"> 
            
            <img id="thumbnailImage" class="thumb-img d-none" alt="Video Thumbnail">

            <h2 id="videoTitle" class="mb-3 text-start">Video Title Placeholder</h2>
            
            <div class="text-start mb-4">
                <div class="detail-row"><strong>👤 Uploader:</strong> <span id="uploaderText">N/A</span></div>
                <div class="detail-row"><strong>⏱️ Duration:</strong> <span id="durationText">N/A</span></div>
                <div class="detail-row"><strong>👁️ Views:</strong> <span id="viewsText">N/A</span></div>
                <div class="detail-row"><strong>📅 Upload Date:</strong> <span id="uploadDateText">N/A</span></div>
            </div>

            <a id="downloadButton" href="#" class="btn btn-download btn-block mt-4" role="button">
                ⬇️ Download Video
            </a>

            <p class="mt-3 text-muted">Click the button to start the direct download.</p>
        </div>

        <div id="errorState" class="d-none alert alert-danger mt-4" role="alert">
            ❌ Error: Could not load the download link.
        </div>
        
    </div>
</div>

<script>
    document.addEventListener('DOMContentLoaded', () => {
        const params = new URLSearchParams(window.location.search);
        const urlParam = params.get('url');
        
        const loadingState = document.getElementById('loadingState');
        const videoDetails = document.getElementById('videoDetails');
        const errorState = document.getElementById('errorState');
        const pageTitle = document.getElementById('pageTitle');
        const videoTitle = document.getElementById('videoTitle');
        const downloadButton = document.getElementById('downloadButton');
        const uploaderText = document.getElementById('uploaderText');
        const durationText = document.getElementById('durationText');
        const viewsText = document.getElementById('viewsText');
        const uploadDateText = document.getElementById('uploadDateText');
        const thumbnailImage = document.getElementById('thumbnailImage');

        if (urlParam) {
            try {
                // Base64 decoding helper (Worker logic)
                const decodeBase64 = (encoded) => {
                    if (!encoded) return 'N/A';
                    return decodeURIComponent(escape(atob(encoded)));
                };

                const decodedUrl = decodeBase64(urlParam);
                const decodedTitle = decodeBase64(params.get('title'));
                const decodedUploader = decodeBase64(params.get('uploader'));
                const decodedDuration = decodeBase64(params.get('duration'));
                const decodedViews = decodeBase64(params.get('views'));
                const decodedUploadDate = decodeBase64(params.get('date'));
                const decodedThumbnailUrl = decodeBase64(params.get('thumbnail')); 

                loadingState.classList.add('d-none');
                videoDetails.classList.remove('d-none');
                
                videoTitle.textContent = decodedTitle;
                pageTitle.textContent = \`Download: \${decodedTitle}\`;
                
                downloadButton.href = decodedUrl;
                downloadButton.download = decodedTitle.replace(/[^a-z0-9]/gi, '_') + '.mp4'; 

                uploaderText.textContent = decodedUploader;
                durationText.textContent = decodedDuration;
                viewsText.textContent = decodedViews;
                uploadDateText.textContent = decodedUploadDate;

                if (decodedThumbnailUrl && decodedThumbnailUrl !== 'N/A') {
                    thumbnailImage.src = decodedThumbnailUrl;
                    thumbnailImage.classList.remove('d-none');
                } else {
                    thumbnailImage.classList.add('d-none'); 
                }

            } catch (e) {
                loadingState.classList.add('d-none');
                errorState.classList.remove('d-none');
                pageTitle.textContent = "Error Loading Link";
                console.error("Decoding error:", e);
            }
        } else {
            loadingState.classList.add('d-none');
            videoDetails.classList.add('d-none'); 
            errorState.textContent = "Please use the Telegram Bot to generate a valid download link.";
            errorState.classList.remove('d-none');
        }
    });
</script>

</body>
</html>
`; 
            
            return new Response(htmlContent, {
                headers: {
                    'Content-Type': 'text/html;charset=UTF-8',
                    'Cache-Control': 'public, max-age=3600'
                },
            });
        }
        
        if (request.method !== 'POST') {
            return new Response('Hello, I am your FDOWN Telegram Worker Bot.', { status: 200 });
        }
        
        const handlers = new WorkerHandlers(env);
        
        const userInlineKeyboard = [
            [{ text: 'C D H Corporation © ✅', callback_data: 'ignore_c_d_h' }] 
        ];
        
        const initialProgressKeyboard = [
             [{ text: PROGRESS_STATES[0].text.replace(/<[^>]*>/g, ''), callback_data: 'ignore_progress' }]
        ];

        try {
            const update = await request.json();
            const message = update.message;
            const callbackQuery = update.callback_query;
            
            if (!message && !callbackQuery) {
                 return new Response('OK', { status: 200 });
            }
            
            ctx.waitUntil(new Promise(resolve => setTimeout(resolve, 0)));

            if (message) { 
                const chatId = message.chat.id;
                const messageId = message.message_id;
                const text = message.text ? message.text.trim() : null; 
                
                // OWNER_ID env විචල්‍යයෙන් ලබා ගනී
                const isOwner = env.OWNER_ID && chatId.toString() === env.OWNER_ID.toString();
                
                const userName = message.from.first_name || "User"; 

                ctx.waitUntil(handlers.saveUserId(chatId));

                
                if (isOwner && text && text.toLowerCase().startsWith('/start')) {
                    
                    if (isOwner) {
                        const ownerText = htmlBold("👑 Welcome Back, Admin!") + "\n\nThis is your Admin Control Panel.";
                        const adminKeyboard = [
                            [{ text: '📊 Users Count', callback_data: 'admin_users_count' }],
                            [{ text: '📣 Broadcast', callback_data: 'admin_broadcast' }],
                            [{ text: 'C D H Corporation © ✅', callback_data: 'ignore_c_d_h' }] 
                        ];
                        await handlers.sendMessage(chatId, ownerText, messageId, adminKeyboard);
                    } else {
                        const userText = `👋 <b>Hello Dear ${userName}!</b> 💁‍♂️ You can easily <b>Download Facebook Videos</b> using this BOT.

🎯 This BOT is <b>Active 24/7</b>.🔔 

◇───────────────◇

🚀 <b>Developer</b> : @chamoddeshan
🔥 <b>C D H Corporation ©</b>

◇───────────────◇`;
                        
                        await handlers.sendMessage(chatId, userText, messageId, userInlineKeyboard);
                    }
                    return new Response('OK', { status: 200 });
                }

                if (text) { 
                    const isLink = /^https?:\/\/(www\.)?(facebook\.com|fb\.watch|fb\.me)/i.test(text);
                    
                    if (isLink) {
                        
                        // Action: Send 'typing'
                        ctx.waitUntil(handlers.sendAction(chatId, 'typing'));

                        const initialText = htmlBold('⌛️ Detecting video... Please wait a moment.'); 
                        const progressMessageId = await handlers.sendMessage(
                            chatId, 
                            initialText, 
                            messageId, 
                            initialProgressKeyboard
                        );
                        
                        if (progressMessageId) {
                            ctx.waitUntil(handlers.simulateProgress(chatId, progressMessageId, messageId));
                        }
                        
                        try {
                            const apiData = await getApiMetadata(text, env); // env යවයි
                            const finalCaption = formatCaption(apiData);
                            
                            const scraperData = await scrapeVideoLinkAndThumbnail(text);
                            const videoUrl = scraperData.videoUrl;
                            
                            const finalThumbnailLink = apiData.thumbnailLink || scraperData.fallbackThumbnail;

                            
                            if (videoUrl) {
                                handlers.progressActive = false; 
                                
                                // Large file handling: env.MAX_FILE_SIZE_BYTES භාවිතා කරයි
                                if (apiData.filesize > env.MAX_FILE_SIZE_BYTES) { 
                                    if (progressMessageId) {
                                        await handlers.deleteMessage(chatId, progressMessageId);
                                    }
                                    
                                    await handlers.sendLinkMessage(
                                        chatId,
                                        videoUrl, 
                                        finalCaption, 
                                        messageId,
                                        apiData // apiData එක සම්පූර්ණයෙන් යැවීම
                                    );
                                    
                                } else {
                                    // ... (ඉතිරි කේතය) ...
                                }
                                
                            } else {
                                // ... (ඉතිරි කේතය) ...
                            }
                            
                        } catch (fdownError) {
                            // ... (ඉතිරි කේතය) ...
                        }
                        
                    } else {
                        await handlers.sendMessage(chatId, htmlBold('❌ Please send a valid Facebook video link.'), messageId);
                    }
                } 
            }
            
            // ... (Callback Query Logic හි env.OWNER_ID භාවිතයට වෙනස් කර ඇත) ...
            
            if (callbackQuery) {
                 // ... (ඉතිරි කේතය) ...
                 if (env.OWNER_ID && chatId.toString() !== env.OWNER_ID.toString()) { 
                      await handlers.answerCallbackQuery(callbackQuery.id, "❌ You cannot use this command.");
                      return new Response('OK', { status: 200 });
                 }
                 // ... (ඉතිරි කේතය) ...

                 return new Response('OK', { status: 200 });
            }


            return new Response('OK', { status: 200 });

        } catch (e) {
            // ✅ දෝෂය log කර එය නැවත throw කිරීම, එවිට Cloudflare Dashboard එකේ දෝෂය දර්ශනය වේ.
            console.error("Worker Catch Block Error:", e);
            
            // Telegram webhook එකට 500 status එකක් යැවීම
            return new Response(`Worker Internal Error: ${e.message}`, { status: 500 });
        }
    }
};
