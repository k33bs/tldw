export interface TranscriptSegment {
  text: string;
  start: number;
  duration: number;
}

export interface TranscriptResult {
  segments: TranscriptSegment[];
  fullText: string;
  videoId: string;
  videoTitle: string;
}

export function getVideoId(url: string): string | null {
  const urlObj = new URL(url);
  return urlObj.searchParams.get('v');
}

export function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function parseTimestamp(timestamp: string): number {
  const parts = timestamp.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return parts[0] * 60 + parts[1];
}

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string;
}

/**
 * Extract a complete JSON object from a string starting at startIndex
 * Uses bracket matching to find the end of the object
 */
export function extractJsonObject(str: string, startIndex: number): string | null {
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = startIndex; i < str.length; i++) {
    const char = str[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === '\\' && inString) {
      escape = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '{') depth++;
    if (char === '}') {
      depth--;
      if (depth === 0) {
        return str.slice(startIndex, i + 1);
      }
    }
  }
  return null;
}

/**
 * Parse XML transcript format from YouTube
 * Handles <text start="..." dur="...">content</text> format
 */
export function parseXmlTranscript(xml: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  // Use [\s\S]*? to handle multi-line content
  const textRegex = /<text start="([^"]+)" dur="([^"]+)"[^>]*>([\s\S]*?)<\/text>/g;
  let match;

  while ((match = textRegex.exec(xml)) !== null) {
    const start = parseFloat(match[1]);
    const duration = parseFloat(match[2]);
    const text = decodeHtmlEntities(match[3])
      .replace(/\n/g, ' ')
      .trim();

    if (text) {
      segments.push({ text, start, duration });
    }
  }

  return segments;
}

/**
 * Decode common HTML entities in transcript text
 */
export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&nbsp;/g, ' ');
}

/**
 * Parse JSON3 transcript format from YouTube
 */
export function parseJson3Transcript(text: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  try {
    const data = JSON.parse(text);
    const events = data.events || [];

    for (const event of events) {
      if (event.segs) {
        const segText = event.segs
          .map((seg: { utf8?: string }) => seg.utf8 || '')
          .join('')
          .trim();

        if (segText) {
          segments.push({
            text: segText,
            start: (event.tStartMs || 0) / 1000,
            duration: (event.dDurationMs || 0) / 1000,
          });
        }
      }
    }
  } catch {
    // Not valid JSON
  }
  return segments;
}

/**
 * Parse SRV3 transcript format from YouTube
 * Format: <p t="start_ms" d="duration_ms">text</p>
 */
export function parseSrv3Transcript(text: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  const pRegex = /<p t="(\d+)" d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
  let match;

  while ((match = pRegex.exec(text)) !== null) {
    const start = parseInt(match[1]) / 1000;
    const duration = parseInt(match[2]) / 1000;
    const rawText = match[3];

    // Clean up the text - remove <s> tags and decode entities
    const cleanText = rawText
      .replace(/<s[^>]*>/g, '')
      .replace(/<\/s>/g, '')
      .replace(/\n/g, ' ')
      .trim();

    const decodedText = decodeHtmlEntities(cleanText);

    if (decodedText) {
      segments.push({ text: decodedText, start, duration });
    }
  }

  return segments;
}

/**
 * Parse VTT (WebVTT) transcript format
 * Supports both HH:MM:SS.mmm and MM:SS.mmm formats
 */
export function parseVttTranscript(text: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  const lines = text.split('\n');
  let currentStart = -1; // Use -1 to distinguish "not set" from "set to 0"
  let currentDuration = 0;
  let currentText = '';

  // Match both formats:
  // HH:MM:SS.mmm --> HH:MM:SS.mmm
  // MM:SS.mmm --> MM:SS.mmm
  const timestampRegex = /(?:(\d{2}):)?(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(?:(\d{2}):)?(\d{2}):(\d{2})\.(\d{3})/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const timestampMatch = line.match(timestampRegex);
    if (timestampMatch) {
      // Save previous segment before starting new one
      if (currentStart >= 0 && currentText) {
        segments.push({
          text: currentText,
          start: currentStart,
          duration: currentDuration,
        });
      }

      // Parse start time (hours are optional)
      const startH = timestampMatch[1] ? parseInt(timestampMatch[1]) : 0;
      const startM = parseInt(timestampMatch[2]);
      const startS = parseInt(timestampMatch[3]);
      const startMs = parseInt(timestampMatch[4]);

      // Parse end time (hours are optional)
      const endH = timestampMatch[5] ? parseInt(timestampMatch[5]) : 0;
      const endM = parseInt(timestampMatch[6]);
      const endS = parseInt(timestampMatch[7]);
      const endMs = parseInt(timestampMatch[8]);

      currentStart = startH * 3600 + startM * 60 + startS + startMs / 1000;
      const endTime = endH * 3600 + endM * 60 + endS + endMs / 1000;
      currentDuration = endTime - currentStart;
      currentText = '';
    } else if (line && !line.startsWith('WEBVTT') && !line.match(/^\d+$/) && currentStart >= 0) {
      // This is caption text (not header, not cue number)
      const cleanText = line.replace(/<[^>]+>/g, '').trim();
      if (cleanText) {
        currentText += (currentText ? ' ' : '') + cleanText;
      }
    } else if (line === '' && currentText && currentStart >= 0) {
      // End of a caption block
      segments.push({
        text: currentText,
        start: currentStart,
        duration: currentDuration,
      });
      currentText = '';
      currentStart = -1;
    }
  }

  // Don't forget the last segment
  if (currentText && currentStart >= 0) {
    segments.push({
      text: currentText,
      start: currentStart,
      duration: currentDuration,
    });
  }

  return segments;
}

export async function extractTranscript(videoId: string): Promise<TranscriptResult> {
  // Get the video page to extract caption info
  const pageResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
  const pageHtml = await pageResponse.text();

  // Extract video title
  const titleMatch = pageHtml.match(/<title>([^<]+)<\/title>/);
  let videoTitle = titleMatch ? titleMatch[1].replace(' - YouTube', '').trim() : 'Unknown Video';

  // Extract ytInitialPlayerResponse using proper JSON parsing
  const playerResponseStart = pageHtml.indexOf('ytInitialPlayerResponse');
  if (playerResponseStart === -1) {
    throw new Error('Could not find player response data');
  }

  const jsonStart = pageHtml.indexOf('{', playerResponseStart);
  if (jsonStart === -1) {
    throw new Error('Could not find player response JSON');
  }

  const jsonStr = extractJsonObject(pageHtml, jsonStart);
  if (!jsonStr) {
    throw new Error('Could not extract player response JSON');
  }

  let playerResponse: any;
  try {
    playerResponse = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error('Failed to parse player response');
  }

  // Get caption tracks
  const captionTracks: CaptionTrack[] =
    playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];

  if (captionTracks.length === 0) {
    throw new Error('No captions available for this video');
  }

  // Prefer English captions, then auto-generated, then first available
  let selectedTrack = captionTracks.find(
    (t) => t.languageCode === 'en' && t.kind !== 'asr'
  );
  if (!selectedTrack) {
    selectedTrack = captionTracks.find((t) => t.languageCode === 'en');
  }
  if (!selectedTrack) {
    selectedTrack = captionTracks[0];
  }

  // Fetch transcript - try JSON format first, fall back to XML
  let segments: TranscriptSegment[] = [];

  // Try JSON format
  const jsonUrl = `${selectedTrack.baseUrl}&fmt=json3`;
  const jsonResponse = await fetch(jsonUrl);

  if (jsonResponse.ok) {
    const responseText = await jsonResponse.text();
    try {
      const transcriptData = JSON.parse(responseText);
      const events = transcriptData.events || [];

      for (const event of events) {
        if (event.segs) {
          const text = event.segs
            .map((seg: { utf8: string }) => seg.utf8 || '')
            .join('')
            .trim();

          if (text) {
            const startMs = event.tStartMs || 0;
            const durationMs = event.dDurationMs || 0;

            segments.push({
              text,
              start: startMs / 1000,
              duration: durationMs / 1000,
            });
          }
        }
      }
    } catch {
      // JSON parsing failed, might be XML
      segments = parseXmlTranscript(responseText);
    }
  }

  // If JSON failed, try XML format
  if (segments.length === 0) {
    const xmlResponse = await fetch(selectedTrack.baseUrl);
    if (xmlResponse.ok) {
      const xmlText = await xmlResponse.text();
      segments = parseXmlTranscript(xmlText);
    }
  }

  if (segments.length === 0) {
    throw new Error('Failed to extract transcript from video');
  }

  const fullText = segments.map((s) => s.text).join(' ');

  return {
    segments,
    fullText,
    videoId,
    videoTitle,
  };
}

export function formatTranscriptForAI(transcript: TranscriptResult): string {
  const lines: string[] = [];

  for (const segment of transcript.segments) {
    const timestamp = formatTimestamp(segment.start);
    lines.push(`[${timestamp}] ${segment.text}`);
  }

  return lines.join('\n');
}
