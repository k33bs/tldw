import { AIProvider, getSettings } from './storage';

export interface SummaryResult {
  conclusion: string;
  overview: string;
  keyPoints: {
    timestamp: string;
    point: string;
  }[];
}

interface AIAdapter {
  summarize(transcript: string, summaryLength: string): Promise<string>;
}

function getKeyPointsCount(length: string): string {
  switch (length) {
    case 'short':
      return '3-5';
    case 'long':
      return '8-12';
    default:
      return '5-8';
  }
}

function getSystemInstructions(summaryLength: string): string {
  const pointsCount = getKeyPointsCount(summaryLength);

  return `You summarize YouTube video transcripts. When given a transcript, provide:
1. THE ANSWER (20 words max) - If someone asked "what's the answer?" or "just tell me so I don't have to watch" - what would you say? Give the actual answer, solution, technique, verdict, or outcome. Be specific and actionable.
2. A brief 2-3 sentence overview
3. ${pointsCount} key points, each with the approximate timestamp from the transcript

Format your response EXACTLY as follows (use this exact structure):
## Conclusion
[THE ANSWER - specific, actionable, complete. Examples:
- "Write detailed specs first, run 'claude -p' in a bash loop with fresh context each iteration, use specs as source of truth instead of context"
- "Don't buy it - battery dies in 2 hours and screen has bad ghosting"
- "Mix 2 parts epoxy to 1 part hardite, cure for 24 hours at room temperature"
- "She was the killer - planted evidence to frame her husband"]

## Overview
[Your 2-3 sentence summary here]

## Key Points
- [MM:SS] First key point
- [MM:SS] Second key point
- [MM:SS] Third key point
(continue for all key points)

Important:
- The Conclusion must be THE ACTUAL ANSWER - specific enough that someone doesn't need to watch the video
- Use timestamps in [MM:SS] or [H:MM:SS] format
- Each key point should be on its own line starting with "- "
- Keep each point concise but informative`;
}

// OpenAI-compatible adapter used by OpenAI, DeepSeek, Grok, Mistral, GLM, and Kimi
// Uses system/user message separation for automatic prompt caching (OpenAI, DeepSeek)
class OpenAICompatibleAdapter implements AIAdapter {
  constructor(
    private apiKey: string,
    private model: string,
    private baseUrl: string = 'https://api.openai.com/v1',
    private providerName: string = 'OpenAI'
  ) {}

  async summarize(transcript: string, summaryLength: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: getSystemInstructions(summaryLength),
          },
          {
            role: 'user',
            content: `Summarize this transcript:\n\n${transcript}`,
          },
        ],
        max_tokens: 2000,
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `${this.providerName} API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }
}

const OPENAI_COMPATIBLE_PROVIDERS: Record<string, { baseUrl: string; name: string }> = {
  openai: { baseUrl: 'https://api.openai.com/v1', name: 'OpenAI' },
  deepseek: { baseUrl: 'https://api.deepseek.com', name: 'DeepSeek' },
  grok: { baseUrl: 'https://api.x.ai/v1', name: 'Grok' },
  mistral: { baseUrl: 'https://api.mistral.ai/v1', name: 'Mistral' },
  glm: { baseUrl: 'https://api.z.ai/api/paas/v4', name: 'GLM' },
  kimi: { baseUrl: 'https://api.moonshot.ai/v1', name: 'Kimi' },
};

// Anthropic adapter with prompt caching via cache_control on system message
class AnthropicAdapter implements AIAdapter {
  constructor(
    private apiKey: string,
    private model: string
  ) {}

  async summarize(transcript: string, summaryLength: string): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 2000,
        system: [
          {
            type: 'text',
            text: getSystemInstructions(summaryLength),
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [
          {
            role: 'user',
            content: `Summarize this transcript:\n\n${transcript}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    return data.content[0]?.text || '';
  }
}

// Gemini adapter with systemInstruction for better separation of concerns
class GeminiAdapter implements AIAdapter {
  constructor(
    private apiKey: string,
    private model: string
  ) {}

  async summarize(transcript: string, summaryLength: string): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: getSystemInstructions(summaryLength) }],
        },
        contents: [
          {
            parts: [{ text: `Summarize this transcript:\n\n${transcript}` }],
          },
        ],
        generationConfig: {
          maxOutputTokens: 2000,
          temperature: 0.5,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }
}

function createAdapter(provider: AIProvider, apiKey: string, model: string): AIAdapter {
  if (provider === 'anthropic') {
    return new AnthropicAdapter(apiKey, model);
  }
  if (provider === 'gemini') {
    return new GeminiAdapter(apiKey, model);
  }
  const providerConfig = OPENAI_COMPATIBLE_PROVIDERS[provider];
  if (providerConfig) {
    return new OpenAICompatibleAdapter(apiKey, model, providerConfig.baseUrl, providerConfig.name);
  }
  throw new Error(`Unknown provider: ${provider}`);
}

/**
 * Check if a line is a section header
 */
function isSectionHeader(line: string, sectionName: string): boolean {
  const lower = line.toLowerCase();
  const name = sectionName.toLowerCase();

  // Match various markdown header formats:
  // ## Conclusion, ### Conclusion, # Conclusion
  // **Conclusion**, **Conclusion:**
  // Conclusion:
  return (
    lower.includes(`## ${name}`) ||
    lower.includes(`### ${name}`) ||
    lower.includes(`# ${name}`) ||
    lower.includes(`**${name}**`) ||
    lower.includes(`**${name}:**`) ||
    lower === `${name}:` ||
    lower === name
  );
}

/**
 * Parse the AI summary response into structured data
 */
export function parseSummaryResponse(response: string): SummaryResult {
  const lines = response.split('\n');

  let conclusion = '';
  let overview = '';
  const keyPoints: { timestamp: string; point: string }[] = [];

  let currentSection: 'none' | 'conclusion' | 'overview' | 'keypoints' = 'none';

  for (const line of lines) {
    const trimmed = line.trim();

    // Check for section headers
    if (isSectionHeader(trimmed, 'conclusion') || isSectionHeader(trimmed, 'tl;dr') || isSectionHeader(trimmed, 'tldr')) {
      currentSection = 'conclusion';
      continue;
    }

    if (isSectionHeader(trimmed, 'overview') || isSectionHeader(trimmed, 'summary')) {
      currentSection = 'overview';
      continue;
    }

    if (isSectionHeader(trimmed, 'key points') || isSectionHeader(trimmed, 'keypoints') || isSectionHeader(trimmed, 'key takeaways')) {
      currentSection = 'keypoints';
      continue;
    }

    // Skip empty lines
    if (!trimmed) continue;

    // Process content based on current section
    switch (currentSection) {
      case 'conclusion':
        // Only take the first non-empty line as conclusion
        if (!conclusion) {
          conclusion = trimmed;
        }
        break;

      case 'overview':
        // Accumulate overview text
        overview += (overview ? ' ' : '') + trimmed;
        break;

      case 'keypoints':
        // Parse key points with timestamps
        if (trimmed.startsWith('-') || trimmed.startsWith('•') || trimmed.match(/^\d+\./)) {
          // Remove bullet/number prefix
          const content = trimmed.replace(/^[-•]\s*/, '').replace(/^\d+\.\s*/, '');

          // Try various timestamp formats:
          // [MM:SS] or [H:MM:SS] - bracketed
          // (MM:SS) or (H:MM:SS) - parentheses
          // MM:SS or H:MM:SS - bare timestamps at start
          const patterns = [
            /^\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*(.+)$/,  // [MM:SS] text
            /^\((\d{1,2}:\d{2}(?::\d{2})?)\)\s*(.+)$/,  // (MM:SS) text
            /^(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–—:]\s*(.+)$/,  // MM:SS - text or MM:SS: text
            /^(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/,  // MM:SS text
          ];

          let matched = false;
          for (const pattern of patterns) {
            const match = content.match(pattern);
            if (match) {
              keyPoints.push({
                timestamp: match[1],
                point: match[2].trim(),
              });
              matched = true;
              break;
            }
          }

          // If no timestamp found, still add the point with 0:00
          if (!matched && content.length > 0) {
            keyPoints.push({
              timestamp: '0:00',
              point: content,
            });
          }
        }
        break;
    }
  }

  return { conclusion, overview, keyPoints };
}

export async function generateSummary(transcript: string): Promise<SummaryResult> {
  const settings = await getSettings();

  if (!settings.apiKey) {
    throw new Error('API key not configured. Please set your API key in the extension settings.');
  }

  const adapter = createAdapter(settings.provider, settings.apiKey, settings.model);
  const response = await adapter.summarize(transcript, settings.summaryLength);

  return parseSummaryResponse(response);
}
