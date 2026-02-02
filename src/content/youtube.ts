import {
  formatTimestamp,
  parseTimestamp,
  TranscriptSegment,
  parseXmlTranscript,
  parseJson3Transcript,
  parseSrv3Transcript,
  parseVttTranscript,
  decodeHtmlEntities,
  extractJsonObject,
} from '../lib/transcript';

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string;
  vssId?: string;
}

// Listen for messages from side panel or service worker
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_TRANSCRIPT') {
    handleGetTranscript().then(sendResponse).catch((error) => {
      console.error('[TLDW] Error:', error);
      sendResponse({ error: error.message });
    });
    return true; // Async response
  }

  if (message.type === 'SEEK_TO_TIMESTAMP') {
    seekToTimestamp(message.timestamp);
    sendResponse({ success: true });
    return false;
  }

  if (message.type === 'GET_VIDEO_INFO') {
    const videoId = getVideoIdFromUrl(window.location.href);
    const title = document.title.replace(' - YouTube', '').trim();
    sendResponse({ videoId, title, url: window.location.href });
    return false;
  }

  return false;
});

function getVideoIdFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.searchParams.get('v');
  } catch {
    return null;
  }
}

function getPlayerResponse(): any {
  // Method 1: Try to get from script tags
  const scripts = document.querySelectorAll('script');

  for (const script of scripts) {
    const text = script.textContent || '';
    if (text.includes('ytInitialPlayerResponse')) {
      const startIdx = text.indexOf('ytInitialPlayerResponse');
      const jsonStart = text.indexOf('{', startIdx);
      if (jsonStart !== -1) {
        const jsonStr = extractJsonObject(text, jsonStart);
        if (jsonStr) {
          try {
            return JSON.parse(jsonStr);
          } catch {
            continue;
          }
        }
      }
    }
  }

  // Method 2: Try to get from page HTML
  const html = document.documentElement.innerHTML;
  const startIdx = html.indexOf('ytInitialPlayerResponse');
  if (startIdx !== -1) {
    const jsonStart = html.indexOf('{', startIdx);
    if (jsonStart !== -1) {
      const jsonStr = extractJsonObject(html, jsonStart);
      if (jsonStr) {
        try {
          return JSON.parse(jsonStr);
        } catch {
          // Continue to fallback
        }
      }
    }
  }

  return null;
}

// Try fetching with XMLHttpRequest and credentials (cookies)
function fetchWithXHR(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.withCredentials = true;
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.responseText);
      } else {
        reject(new Error(`XHR failed: ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('XHR error'));
    xhr.send();
  });
}

async function fetchTranscriptDirect(captionUrl: string): Promise<TranscriptSegment[]> {
  let segments: TranscriptSegment[] = [];

  // Decode the URL - YouTube often returns URL-encoded baseUrl
  const decodedUrl = decodeURIComponent(captionUrl);
  const separator = decodedUrl.includes('?') ? '&' : '?';

  // Try different format combinations
  const formats = ['srv3', 'json3', '', 'vtt'];

  for (const fmt of formats) {
    if (segments.length > 0) break;

    try {
      let url = decodedUrl;
      if (fmt) {
        url = `${decodedUrl}${separator}fmt=${fmt}`;
      }

      // Try with XMLHttpRequest first (includes cookies)
      let text = '';
      try {
        text = await fetchWithXHR(url);
      } catch {
        // Fallback to fetch
        const response = await fetch(url, { credentials: 'include' });
        text = await response.text();
      }

      if (text.length > 0) {
        // Try different parsers based on content
        if (text.trim().startsWith('{')) {
          segments = parseJson3Transcript(text);
        } else if (text.includes('<p t="')) {
          segments = parseSrv3Transcript(text);
        } else if (text.includes('<text ')) {
          segments = parseXmlTranscript(text);
        } else if (text.includes('WEBVTT')) {
          segments = parseVttTranscript(text);
        }

        // If primary parser failed, try others
        if (segments.length === 0) segments = parseJson3Transcript(text);
        if (segments.length === 0) segments = parseSrv3Transcript(text);
        if (segments.length === 0) segments = parseXmlTranscript(text);
        if (segments.length === 0) segments = parseVttTranscript(text);
      }
    } catch {
      // Try next format
    }
  }

  return segments;
}

// Use YouTube's Innertube API with ANDROID client - the most reliable method
async function fetchTranscriptViaInnertube(videoId: string): Promise<TranscriptSegment[]> {
  try {
    // Extract INNERTUBE_API_KEY from the page
    // Fallback is YouTube's public Innertube API key (embedded in their public JS, not a secret)
    const html = document.documentElement.innerHTML;
    const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
    const apiKey = apiKeyMatch ? apiKeyMatch[1] : 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

    // Call Innertube player API as ANDROID client
    const playerResponse = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'ANDROID',
            clientVersion: '20.10.38',
          },
        },
        videoId: videoId,
      }),
    });

    const playerData = await playerResponse.json();
    const captionTracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    if (captionTracks && captionTracks.length > 0) {
      // Prefer English manual, then English auto, then first available
      let track = captionTracks.find((t: any) => t.languageCode === 'en' && t.kind !== 'asr');
      if (!track) track = captionTracks.find((t: any) => t.languageCode === 'en');
      if (!track) track = captionTracks[0];

      // Clean the baseUrl - remove any fmt parameter
      const baseUrl = track.baseUrl.replace(/&fmt=\w+$/, '');

      // Fetch the transcript
      const transcriptResponse = await fetch(baseUrl);
      const transcriptText = await transcriptResponse.text();

      if (transcriptText.length > 0) {
        // Parse the transcript
        let segments = parseXmlTranscript(transcriptText);
        if (segments.length === 0) segments = parseSrv3Transcript(transcriptText);
        if (segments.length === 0) segments = parseJson3Transcript(transcriptText);

        if (segments.length > 0) {
          return segments;
        }
      }
    }
  } catch (e) {
    console.error('[TLDW] Innertube API error:', e);
  }

  return [];
}

async function fetchTranscriptViaYtApi(videoId: string): Promise<TranscriptSegment[]> {
  const listUrl = `https://www.youtube.com/api/timedtext?type=list&v=${videoId}`;

  try {
    const listResponse = await fetch(listUrl);
    const listText = await listResponse.text();

    // Parse all available languages from XML
    const langMatches = listText.matchAll(/lang_code="([^"]+)"/g);
    const languages = [...langMatches].map(m => m[1]);

    // Check if it's auto-generated
    const isAsr = listText.includes('kind="asr"');

    // Prefer English, fallback to first available
    const lang = languages.includes('en') ? 'en' : (languages[0] || 'en');

    // Try multiple URL variants
    const urlVariants = [
      `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}${isAsr ? '&kind=asr' : ''}`,
      `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}${isAsr ? '&kind=asr' : ''}&fmt=srv3`,
      `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}${isAsr ? '&kind=asr' : ''}&fmt=json3`,
      `https://www.youtube.com/api/timedtext?v=${videoId}&asr_langs=${lang}&caps=asr`,
    ];

    for (const transcriptUrl of urlVariants) {
      try {
        const transcriptResponse = await fetch(transcriptUrl);
        const transcriptText = await transcriptResponse.text();

        if (transcriptText.length > 0) {
          let segments: TranscriptSegment[] = [];

          // Try parsers based on content
          if (transcriptText.trim().startsWith('{')) {
            segments = parseJson3Transcript(transcriptText);
          } else if (transcriptText.includes('<p t="')) {
            segments = parseSrv3Transcript(transcriptText);
          } else if (transcriptText.includes('<text ')) {
            segments = parseXmlTranscript(transcriptText);
          }

          // Fallback to all parsers
          if (segments.length === 0) segments = parseXmlTranscript(transcriptText);
          if (segments.length === 0) segments = parseSrv3Transcript(transcriptText);
          if (segments.length === 0) segments = parseJson3Transcript(transcriptText);

          if (segments.length > 0) {
            return segments;
          }
        }
      } catch {
        // Try next URL variant
      }
    }
  } catch (e) {
    console.error('[TLDW] YT API error:', e);
  }

  return [];
}

// Try to get transcript from YouTube's transcript panel in the DOM
async function getTranscriptFromDOM(): Promise<TranscriptSegment[]> {
  const segments: TranscriptSegment[] = [];

  // Try to open the transcript panel if it's not already open
  const moreActionsButton = document.querySelector('button[aria-label="More actions"]') as HTMLButtonElement;

  if (moreActionsButton) {
    moreActionsButton.click();
    await new Promise(resolve => setTimeout(resolve, 500));

    // Look for "Show transcript" menu item
    const menuItems = document.querySelectorAll('ytd-menu-service-item-renderer, tp-yt-paper-item');
    for (const item of menuItems) {
      const text = item.textContent?.toLowerCase() || '';
      if (text.includes('transcript') || text.includes('show transcript')) {
        (item as HTMLElement).click();
        await new Promise(resolve => setTimeout(resolve, 1000));
        break;
      }
    }

    // Close the menu if transcript option wasn't found
    document.body.click();
  }

  // Read from the transcript panel
  const transcriptSegments = document.querySelectorAll('ytd-transcript-segment-renderer');

  if (transcriptSegments.length > 0) {
    for (const segment of transcriptSegments) {
      const timestampEl = segment.querySelector('.segment-timestamp');
      const textEl = segment.querySelector('.segment-text');

      if (timestampEl && textEl) {
        const timestampText = timestampEl.textContent?.trim() || '0:00';
        const text = textEl.textContent?.trim() || '';

        if (text) {
          const parts = timestampText.split(':').map(Number);
          let start = 0;
          if (parts.length === 3) {
            start = parts[0] * 3600 + parts[1] * 60 + parts[2];
          } else if (parts.length === 2) {
            start = parts[0] * 60 + parts[1];
          }

          segments.push({ text, start, duration: 0 });
        }
      }
    }
  }

  return segments;
}

async function handleGetTranscript() {
  const videoId = getVideoIdFromUrl(window.location.href);
  if (!videoId) {
    throw new Error('Not a YouTube video page');
  }

  let segments: TranscriptSegment[] = [];

  // Method 0: Try Innertube API with Android client (most reliable)
  segments = await fetchTranscriptViaInnertube(videoId);

  // Method 1: Try DOM scraping
  if (segments.length === 0) {
    segments = await getTranscriptFromDOM();
  }

  // Method 2: Try YouTube's timedtext API directly
  if (segments.length === 0) {
    segments = await fetchTranscriptViaYtApi(videoId);
  }

  // Method 3: Fall back to player response caption URLs
  if (segments.length === 0) {
    const playerResponse = getPlayerResponse();

    if (playerResponse) {
      const captionTracks: CaptionTrack[] =
        playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];

      if (captionTracks.length > 0) {
        // Prefer English manual captions, then English auto, then first available
        let selectedTrack = captionTracks.find(
          (t) => t.languageCode === 'en' && t.kind !== 'asr'
        );
        if (!selectedTrack) {
          selectedTrack = captionTracks.find((t) => t.languageCode === 'en');
        }
        if (!selectedTrack) {
          selectedTrack = captionTracks[0];
        }

        segments = await fetchTranscriptDirect(selectedTrack.baseUrl);

        // If still no segments, try with different URL construction
        if (segments.length === 0 && selectedTrack.vssId) {
          const altUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&caps=asr&vssId=${selectedTrack.vssId}&lang=${selectedTrack.languageCode}`;
          segments = await fetchTranscriptDirect(altUrl);
        }
      }
    }
  }

  if (segments.length === 0) {
    throw new Error('No transcript available. This video may not have captions enabled.');
  }

  // Consolidate segments into ~30 second chunks to reduce tokens
  const consolidatedSegments: TranscriptSegment[] = [];
  let currentChunk: TranscriptSegment | null = null;
  const CHUNK_DURATION = 30;

  for (const seg of segments) {
    if (!currentChunk) {
      currentChunk = { ...seg };
    } else if (seg.start - currentChunk.start < CHUNK_DURATION) {
      currentChunk.text += ' ' + seg.text;
      currentChunk.duration = seg.start + seg.duration - currentChunk.start;
    } else {
      consolidatedSegments.push(currentChunk);
      currentChunk = { ...seg };
    }
  }
  if (currentChunk) {
    consolidatedSegments.push(currentChunk);
  }

  // Format for AI - clean text only, minimal formatting
  const formattedTranscript = consolidatedSegments
    .map((seg) => {
      const cleanText = decodeHtmlEntities(seg.text)
        .replace(/\s+/g, ' ')
        .trim();
      return `[${formatTimestamp(seg.start)}] ${cleanText}`;
    })
    .join('\n');

  const videoTitle = document.title.replace(' - YouTube', '').trim();

  return {
    transcript: formattedTranscript,
    videoId,
    videoTitle,
  };
}

function seekToTimestamp(timestamp: string) {
  const seconds = parseTimestamp(timestamp);
  const video = document.querySelector('video');

  if (video) {
    video.currentTime = seconds;
    video.play().catch(() => {
      // Autoplay might be blocked, that's okay
    });
  }
}
