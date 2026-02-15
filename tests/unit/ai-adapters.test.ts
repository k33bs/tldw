import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateSummary } from '../../src/lib/ai-providers';

// Mock chrome.storage API
const mockStorage = {
  local: {
    get: vi.fn(),
    set: vi.fn(),
  },
};

// Mock global chrome object
vi.stubGlobal('chrome', {
  storage: mockStorage,
});

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('AI Adapters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('OpenAI Adapter', () => {
    it('constructs correct request for OpenAI API', async () => {
      // Setup settings mock - note: getSettings stores under 'settings' key
      mockStorage.local.get.mockResolvedValue({
        settings: {
          provider: 'openai',
          apiKey: 'sk-test-key',
          model: 'gpt-4o-mini',
          summaryLength: 'medium',
        },
      });

      // Setup fetch mock
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: `## Conclusion
Test conclusion

## Overview
Test overview

## Key Points
- [0:30] First point`,
              },
            },
          ],
        }),
      });

      await generateSummary('Test transcript');

      // Verify fetch was called with correct parameters
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer sk-test-key',
          }),
        })
      );

      // Verify request body uses system/user message separation for caching
      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.model).toBe('gpt-4o-mini');
      expect(body.messages[0].role).toBe('system');
      expect(body.messages[0].content).toContain('Conclusion');
      expect(body.messages[1].role).toBe('user');
      expect(body.messages[1].content).toContain('Test transcript');
    });

    it('handles OpenAI API errors correctly', async () => {
      mockStorage.local.get.mockResolvedValue({
        settings: {
          provider: 'openai',
          apiKey: 'sk-test-key',
          model: 'gpt-4o-mini',
          summaryLength: 'medium',
        },
      });

      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          error: { message: 'Invalid API key' },
        }),
      });

      await expect(generateSummary('Test transcript')).rejects.toThrow('Invalid API key');
    });
  });

  describe('Anthropic Adapter', () => {
    it('constructs correct request for Anthropic API', async () => {
      mockStorage.local.get.mockResolvedValue({
        settings: {
          provider: 'anthropic',
          apiKey: 'sk-ant-test-key',
          model: 'claude-3-5-sonnet-20241022',
          summaryLength: 'medium',
        },
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [
            {
              text: `## Conclusion
Anthropic conclusion

## Overview
Anthropic overview

## Key Points
- [1:00] Anthropic point`,
            },
          ],
        }),
      });

      await generateSummary('Test transcript');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-api-key': 'sk-ant-test-key',
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          }),
        })
      );

      // Verify request body uses system message with cache_control
      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.model).toBe('claude-3-5-sonnet-20241022');
      expect(body.system[0].type).toBe('text');
      expect(body.system[0].cache_control).toEqual({ type: 'ephemeral' });
      expect(body.messages[0].role).toBe('user');
      expect(body.messages[0].content).toContain('transcript');
    });

    it('handles Anthropic API errors correctly', async () => {
      mockStorage.local.get.mockResolvedValue({
        settings: {
          provider: 'anthropic',
          apiKey: 'invalid-key',
          model: 'claude-3-5-sonnet-20241022',
          summaryLength: 'medium',
        },
      });

      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({
          error: { message: 'Invalid x-api-key' },
        }),
      });

      await expect(generateSummary('Test transcript')).rejects.toThrow('Invalid x-api-key');
    });
  });

  describe('Gemini Adapter', () => {
    it('constructs correct request for Gemini API', async () => {
      mockStorage.local.get.mockResolvedValue({
        settings: {
          provider: 'gemini',
          apiKey: 'gemini-test-key',
          model: 'gemini-1.5-flash',
          summaryLength: 'medium',
        },
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: `## Conclusion
Gemini conclusion

## Overview
Gemini overview

## Key Points
- [2:00] Gemini point`,
                  },
                ],
              },
            },
          ],
        }),
      });

      await generateSummary('Test transcript');

      // Gemini uses API key in URL
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );

      // Verify API key is in URL
      const fetchCall = mockFetch.mock.calls[0];
      expect(fetchCall[0]).toContain('key=gemini-test-key');

      // Verify systemInstruction is used for instructions
      const body = JSON.parse(fetchCall[1].body);
      expect(body.systemInstruction).toBeDefined();
      expect(body.systemInstruction.parts[0].text).toContain('Conclusion');
      expect(body.contents[0].parts[0].text).toContain('transcript');
    });

    it('handles Gemini API errors correctly', async () => {
      mockStorage.local.get.mockResolvedValue({
        settings: {
          provider: 'gemini',
          apiKey: 'invalid-key',
          model: 'gemini-1.5-flash',
          summaryLength: 'medium',
        },
      });

      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: { message: 'API key not valid' },
        }),
      });

      await expect(generateSummary('Test transcript')).rejects.toThrow('API key not valid');
    });
  });

  describe('Common behavior', () => {
    it('throws error when API key is not configured', async () => {
      mockStorage.local.get.mockResolvedValue({
        settings: {
          provider: 'openai',
          apiKey: '',
          model: 'gpt-4o-mini',
          summaryLength: 'medium',
        },
      });

      await expect(generateSummary('Test transcript')).rejects.toThrow(
        'API key not configured'
      );
    });

    it('parses summary response correctly', async () => {
      mockStorage.local.get.mockResolvedValue({
        settings: {
          provider: 'openai',
          apiKey: 'sk-test-key',
          model: 'gpt-4o-mini',
          summaryLength: 'short',
        },
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: `## Conclusion
The answer is 42

## Overview
This video explains everything about life, the universe, and everything.

## Key Points
- [0:00] Introduction
- [1:30] The question
- [5:00] The answer revealed`,
              },
            },
          ],
        }),
      });

      const result = await generateSummary('Test transcript');

      expect(result.conclusion).toBe('The answer is 42');
      expect(result.overview).toContain('life, the universe');
      expect(result.keyPoints).toHaveLength(3);
      expect(result.keyPoints[2].timestamp).toBe('5:00');
      expect(result.keyPoints[2].point).toBe('The answer revealed');
    });
  });
});
