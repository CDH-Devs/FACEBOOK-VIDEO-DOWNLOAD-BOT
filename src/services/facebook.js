import youtubedl from 'youtube-dl-exec';
import { promisify } from 'util';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export async function getFbVideoInfo(videoUrl) {
  console.log(`Fetching video info for: ${videoUrl}`);
  
  try {
    const info = await youtubedl(videoUrl, {
      dumpSingleJson: true,
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
      addHeader: [
        'referer:youtube.com',
        'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ]
    });

    if (!info) {
      return {
        error: 'Unable to fetch video information'
      };
    }

    const tempDir = '/tmp/fb-videos';
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const outputTemplate = path.join(tempDir, `${Date.now()}.%(ext)s`);

    const downloadResult = await youtubedl(videoUrl, {
      output: outputTemplate,
      format: 'best',
      noCheckCertificates: true,
      noWarnings: true,
      addHeader: [
        'referer:youtube.com',
        'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ]
    });

    const videoExtensions = ['.mp4', '.webm', '.mkv', '.avi', '.mov', '.flv', '.m4v'];
    const videoFiles = fs.readdirSync(tempDir).filter(f => {
      const stats = fs.statSync(path.join(tempDir, f));
      const ext = path.extname(f).toLowerCase();
      return stats.mtimeMs > Date.now() - 10000 && videoExtensions.includes(ext);
    });

    let videoPath = null;
    if (videoFiles.length > 0) {
      videoPath = path.join(tempDir, videoFiles[0]);
    }

    setTimeout(() => {
      if (videoPath && fs.existsSync(videoPath)) {
        fs.unlinkSync(videoPath);
        console.log(`Cleaned up temporary file: ${videoPath}`);
      }
    }, 60000);

    return {
      url: info.url || info.webpage_url,
      videoPath: videoPath,
      title: info.title || 'Facebook Video',
      thumbnail: info.thumbnail || '',
      duration: info.duration || 0,
      author: info.uploader || info.channel || ''
    };
  } catch (error) {
    console.error('yt-dlp error:', error.message);
    
    if (error.message.includes('private') || error.message.includes('This video is only available')) {
      return {
        error: 'This video is private or not available'
      };
    }
    
    if (error.message.includes('Video unavailable')) {
      return {
        error: 'Video is unavailable or has been removed'
      };
    }
    
    return {
      error: `Failed to fetch video: ${error.message}`
    };
  }
}
