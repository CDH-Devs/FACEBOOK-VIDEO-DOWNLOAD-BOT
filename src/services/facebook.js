/**
 * Facebook Video Downloader Service using Apify Actor
 */

const APIFY_ACTOR_ID = 'qq0smwvcggvvHjvuy';

/**
 * Main function to get Facebook video information using Apify
 */
export async function getFbVideoInfo(videoUrl, env) {
  console.log(`Fetching video info for: ${videoUrl}`);
  
  if (!env?.APIFY_API_TOKEN) {
    console.error('APIFY_API_TOKEN not found in environment');
    return { 
      error: 'Service configuration error. Please contact the bot administrator.' 
    };
  }
  
  try {
    // Run the Apify actor
    const runResult = await runApifyActor(videoUrl, env.APIFY_API_TOKEN);
    
    if (!runResult.success) {
      console.error('Apify actor run failed:', runResult.error);
      return { 
        error: 'Unable to fetch video. The video might be private, deleted, or temporarily unavailable.' 
      };
    }
    
    // Get the dataset results
    const videoData = await getApifyDataset(runResult.datasetId, env.APIFY_API_TOKEN);
    
    if (!videoData) {
      return { 
        error: 'No video data found. The video might be private or unavailable.' 
      };
    }
    
    return videoData;
  } catch (error) {
    console.error('Facebook video fetch error:', error.message);
    return { 
      error: `Failed to fetch video: ${error.message}` 
    };
  }
}

/**
 * Run the Apify actor with the Facebook video URL
 */
async function runApifyActor(videoUrl, apiToken) {
  try {
    const runUrl = `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/runs?token=${apiToken}`;
    
    const response = await fetch(runUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: videoUrl
      })
    });
    
    if (!response.ok) {
      throw new Error(`Apify API returned ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    const runId = data.data.id;
    const datasetId = data.data.defaultDatasetId;
    
    console.log(`Apify actor started. Run ID: ${runId}`);
    
    // Wait for the actor to finish
    const finished = await waitForActorCompletion(runId, apiToken, 30000);
    
    if (!finished) {
      throw new Error('Actor execution timeout');
    }
    
    return {
      success: true,
      runId,
      datasetId
    };
  } catch (error) {
    console.error('Error running Apify actor:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Wait for Apify actor to complete execution
 */
async function waitForActorCompletion(runId, apiToken, timeout = 30000) {
  const startTime = Date.now();
  const checkInterval = 1000; // Check every 1 second
  
  while (Date.now() - startTime < timeout) {
    try {
      const statusUrl = `https://api.apify.com/v2/actor-runs/${runId}?token=${apiToken}`;
      const response = await fetch(statusUrl);
      
      if (!response.ok) {
        throw new Error(`Status check failed: ${response.status}`);
      }
      
      const data = await response.json();
      const status = data.data.status;
      
      console.log(`Actor status: ${status}`);
      
      if (status === 'SUCCEEDED') {
        return true;
      }
      
      if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
        throw new Error(`Actor execution ${status}`);
      }
      
      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    } catch (error) {
      console.error('Error checking actor status:', error.message);
      throw error;
    }
  }
  
  return false; // Timeout
}

/**
 * Get video data from Apify dataset
 */
async function getApifyDataset(datasetId, apiToken) {
  try {
    const datasetUrl = `https://api.apify.com/v2/datasets/${datasetId}/items?token=${apiToken}`;
    
    const response = await fetch(datasetUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch dataset: ${response.status}`);
    }
    
    const items = await response.json();
    
    if (!items || items.length === 0) {
      return null;
    }
    
    const item = items[0];
    const result = item.result || item;
    
    if (!result || result.error) {
      return null;
    }
    
    // Extract video URLs from the medias array
    const hdVideo = result.medias?.find(m => m.quality === 'HD');
    const sdVideo = result.medias?.find(m => m.quality === 'SD');
    
    return {
      url: result.url,
      hd: hdVideo?.url || null,
      sd: sdVideo?.url || hdVideo?.url || null,
      title: result.title || 'Facebook Video',
      thumbnail: result.thumbnail || '',
      duration: result.duration || 0,
      author: result.author || ''
    };
  } catch (error) {
    console.error('Error fetching Apify dataset:', error.message);
    return null;
  }
}
