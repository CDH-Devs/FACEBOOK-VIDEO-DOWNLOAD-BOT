export async function getFbVideoInfo(videoUrl, env) {
  console.log(`Fetching video info for: ${videoUrl}`);
  
  try {
    const formData = new URLSearchParams();
    formData.append('URLz', videoUrl);
    
    const response = await fetch('https://fdown.net/download.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://fdown.net/',
        'Origin': 'https://fdown.net',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0'
      },
      body: formData.toString()
    });
    
    if (!response.ok) {
      console.error('FDown Error:', response.status);
      
      if (response.status === 403) {
        return {
          error: 'Access denied by download service. The service may be blocking automated requests. Please try again later or use a different video URL.'
        };
      }
      
      if (response.status === 429) {
        return {
          error: 'Service is temporarily rate-limited. Please wait a moment and try again.'
        };
      }
      
      if (response.status === 503 || response.status === 502) {
        return {
          error: 'Download service is temporarily unavailable. Please try again in a few minutes.'
        };
      }
      
      return {
        error: `Unable to fetch video (Error ${response.status}). Please check the URL and try again.`
      };
    }
    
    const html = await response.text();
    
    const alertMatch = html.match(/<div[^>]*class="[^"]*alert\s+alert-(?:danger|warning)[^"]*"[^>]*>(.*?)<\/div>/is);
    if (alertMatch) {
      const errorText = alertMatch[1].replace(/<[^>]*>/g, '').trim();
      console.error('FDown returned alert:', errorText);
      return {
        error: errorText || 'Could not process the video. Please check if the video is public and try again.'
      };
    }
    
    const hdMatch = html.match(/href="([^"]+)"[^>]*>\s*Download\s+(?:HD\s+)?[Vv]ideo(?:\s+in\s+HD\s+[Qq]uality)?/i) || 
                    html.match(/href="([^"]+)"[^>]*>\s*Download\s+[Hh]igh\s+[Qq]uality/i) ||
                    html.match(/href="([^"]+)"[^>]*class="[^"]*hd[^"]*"/i);
    
    const sdMatch = html.match(/href="([^"]+)"[^>]*>\s*Download\s+(?:SD\s+)?[Vv]ideo(?:\s+in\s+(?:SD|[Nn]ormal)\s+[Qq]uality)?/i) || 
                    html.match(/href="([^"]+)"[^>]*>\s*Download\s+[Nn]ormal\s+[Qq]uality/i) ||
                    html.match(/href="([^"]+)"[^>]*class="[^"]*sd[^"]*"/i);
    
    const titleMatch = html.match(/<h3[^>]*>(.*?)<\/h3>/i) || 
                       html.match(/<title>([^<]*?)\s*-\s*FDOWN<\/title>/i);
    
    const hdUrl = hdMatch ? hdMatch[1].trim() : null;
    const sdUrl = sdMatch ? sdMatch[1].trim() : null;
    const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : 'Facebook Video';
    
    if (!hdUrl && !sdUrl) {
      console.error('No download links found in response');
      console.log('HTML preview:', html.substring(0, 500));
      return {
        error: 'Could not extract video download links. The video might be private, deleted, or the service is temporarily unavailable. Please try again later.'
      };
    }
    
    return {
      url: hdUrl || sdUrl,
      hd: hdUrl,
      sd: sdUrl,
      title: title,
      thumbnail: '',
      duration: 0,
      author: ''
    };
  } catch (error) {
    console.error('Facebook video fetch error:', error.message);
    
    if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
      return {
        error: 'Service is temporarily rate-limited. Please wait a moment and try again.'
      };
    }
    
    if (error.message.includes('503') || error.message.includes('502')) {
      return {
        error: 'Download service is temporarily unavailable. Please try again in a few minutes.'
      };
    }
    
    return {
      error: `Failed to fetch video: ${error.message}. Please try again later.`
    };
  }
}

function extractVideoId(url) {
  const patterns = [
    /facebook\.com\/.*\/videos\/(\d+)/,
    /facebook\.com\/watch\/?\?v=(\d+)/,
    /fb\.watch\/([a-zA-Z0-9_-]+)/,
    /facebook\.com\/.*\/posts\/(\d+)/,
    /facebook\.com\/reel\/(\d+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return url.split('/').pop().split('?')[0];
}
