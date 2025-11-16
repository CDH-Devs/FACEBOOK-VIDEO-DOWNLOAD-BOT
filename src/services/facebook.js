// src/services/facebook.js

// Playwright සම්පූර්ණයෙන්ම ඉවත් කර ඇත.

async function tryScrapingService(videoUrl, serviceUrl) {
  try {
    console.log(`Trying scraping service: ${serviceUrl}`);
    
    // Scraping service එකට POST ඉල්ලීම යවයි
    const response = await fetch(serviceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Referer': serviceUrl
      },
      body: `url=${encodeURIComponent(videoUrl)}` 
    });
    
    if (!response.ok) {
      throw new Error(`Scraping service returned status ${response.status}`);
    }
    
    const html = await response.text();
    
    // HTML ප්‍රතිචාරයෙන් HD සහ SD සබැඳි සොයා ගනී
    const hdMatch = html.match(/<a[^>]+href="([^"]+)"[^>]*>\s*Download\s+in\s+(?:HD|High)/i);
    const sdMatch = html.match(/<a[^>]+href="([^"]+)"[^>]*>\s*Download\s+in\s+(?:SD|Normal)/i);
    
    const hdUrl = hdMatch ? hdMatch[1] : null;
    const sdUrl = sdMatch ? sdMatch[1] : null;
    
    if (!hdUrl && !sdUrl) {
      const anyDownload = html.match(/href="(https?:\/\/[^"]+\.mp4[^"]*)"/i);
      if (anyDownload) {
        return {
          url: anyDownload[1],
          hd: anyDownload[1],
          sd: anyDownload[1],
          title: 'Facebook Video',
          service: 'Scraping'
        };
      }
      throw new Error('No download links found');
    }
    
    return {
      url: hdUrl || sdUrl,
      hd: hdUrl,
      sd: sdUrl,
      title: 'Facebook Video',
      service: 'Scraping'
    };
  } catch (error) {
    console.error(`Scraping failed for ${serviceUrl}: ${error.message}`);
    throw error;
  }
}

export async function getFbVideoInfo(videoUrl, env) {
  console.log(`Fetching video info for: ${videoUrl}`);
  
  // උත්සාහ කිරීමට විවිධ scraping සේවාවන් ලැයිස්තුව
  const services = [
    // FBDOWN.net
    { 
        name: 'FBDOWN', 
        func: (url) => tryScrapingService(url, 'https://www.fbdown.net/download.php') 
    },
    // GetFVid (මුල් සේවාව)
    { 
        name: 'GetFVid', 
        func: (url) => tryScrapingService(url, 'https://www.getfvid.com/downloader') 
    },
  ];
  
  for (const service of services) {
    try {
      console.log(`Trying ${service.name}...`);
      const result = await service.func(videoUrl);
      console.log(`✅ Success with ${service.name}`);
      return {
        url: result.url,
        hd: result.hd,
        sd: result.sd,
        title: result.title,
        thumbnail: '',
        duration: 0,
        author: ''
      };
    } catch (error) {
      console.log(`❌ ${service.name} failed: ${error.message}`);
      // එක් සේවාවක් අසාර්ථක වුවහොත්, ඊළඟ එක උත්සාහ කරයි
      continue; 
    }
  }
  
  console.log('\n⚠️ All methods failed. Providing helpful message to user.');
  
  return {
    error: '❌ වීඩියෝව බාගත කිරීමට නොහැකි විය. / Unable to download video.\n\n' +
           '💡 කරුණාකර පරීක්ෂා කරන්න / Please check:\n' +
           '• වීඩියෝව ප්‍රසිද්ධ (public) දැයි / Video is public\n' +
           '• වීඩියෝව තවමත් ලබා ගත හැකි දැයි / Video is still available\n' +
           '• URL එක නිවැරදි දැයි / URL is correct\n\n' +
           '🔄 සියලු සේවාවන් අසාර්ථක විය. කරුණාකර පසුව නැවත උත්සාහ කරන්න.'
  };
}
