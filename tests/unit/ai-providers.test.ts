import { describe, it, expect } from 'vitest';
import { parseSummaryResponse } from '../../src/lib/ai-providers';

describe('parseSummaryResponse', () => {
  describe('conclusion parsing', () => {
    it('parses ## Conclusion header', () => {
      const response = `## Conclusion
Use method A for best results

## Overview
This is the overview`;
      const result = parseSummaryResponse(response);
      expect(result.conclusion).toBe('Use method A for best results');
    });

    it('parses ### Conclusion header', () => {
      const response = `### Conclusion
Use method B

### Overview
Overview text`;
      const result = parseSummaryResponse(response);
      expect(result.conclusion).toBe('Use method B');
    });

    it('parses **Conclusion** header', () => {
      const response = `**Conclusion**
Method C is recommended

**Overview**
Overview here`;
      const result = parseSummaryResponse(response);
      expect(result.conclusion).toBe('Method C is recommended');
    });

    it('parses TL;DR as conclusion', () => {
      const response = `## TL;DR
Short answer here

## Overview
More details`;
      const result = parseSummaryResponse(response);
      expect(result.conclusion).toBe('Short answer here');
    });

    it('only takes first line as conclusion', () => {
      const response = `## Conclusion
First line
Second line should not be included

## Overview
Overview text`;
      const result = parseSummaryResponse(response);
      expect(result.conclusion).toBe('First line');
    });
  });

  describe('overview parsing', () => {
    it('parses overview text', () => {
      const response = `## Overview
This is a detailed overview of the video content.

## Key Points
- [0:00] Point one`;
      const result = parseSummaryResponse(response);
      expect(result.overview).toBe('This is a detailed overview of the video content.');
    });

    it('combines multiple lines into overview', () => {
      const response = `## Overview
First sentence of overview.
Second sentence continues here.
Third sentence ends it.

## Key Points
- [0:00] Point`;
      const result = parseSummaryResponse(response);
      expect(result.overview).toBe('First sentence of overview. Second sentence continues here. Third sentence ends it.');
    });

    it('parses Summary as overview', () => {
      const response = `## Summary
This is the summary text.

## Key Points
- [0:00] Point`;
      const result = parseSummaryResponse(response);
      expect(result.overview).toBe('This is the summary text.');
    });
  });

  describe('key points parsing', () => {
    it('parses [MM:SS] format', () => {
      const response = `## Key Points
- [0:30] First point
- [1:45] Second point
- [10:00] Third point`;
      const result = parseSummaryResponse(response);
      expect(result.keyPoints).toHaveLength(3);
      expect(result.keyPoints[0]).toEqual({ timestamp: '0:30', point: 'First point' });
      expect(result.keyPoints[1]).toEqual({ timestamp: '1:45', point: 'Second point' });
      expect(result.keyPoints[2]).toEqual({ timestamp: '10:00', point: 'Third point' });
    });

    it('parses [H:MM:SS] format', () => {
      const response = `## Key Points
- [1:00:00] Hour mark point
- [1:30:45] Later point`;
      const result = parseSummaryResponse(response);
      expect(result.keyPoints).toHaveLength(2);
      expect(result.keyPoints[0]).toEqual({ timestamp: '1:00:00', point: 'Hour mark point' });
      expect(result.keyPoints[1]).toEqual({ timestamp: '1:30:45', point: 'Later point' });
    });

    it('parses (MM:SS) parentheses format', () => {
      const response = `## Key Points
- (0:30) First point
- (1:45) Second point`;
      const result = parseSummaryResponse(response);
      expect(result.keyPoints).toHaveLength(2);
      expect(result.keyPoints[0]).toEqual({ timestamp: '0:30', point: 'First point' });
    });

    it('parses MM:SS - text format', () => {
      const response = `## Key Points
- 0:30 - First point
- 1:45 - Second point`;
      const result = parseSummaryResponse(response);
      expect(result.keyPoints).toHaveLength(2);
      expect(result.keyPoints[0]).toEqual({ timestamp: '0:30', point: 'First point' });
    });

    it('parses bare MM:SS text format', () => {
      const response = `## Key Points
- 0:30 First point
- 1:45 Second point`;
      const result = parseSummaryResponse(response);
      expect(result.keyPoints).toHaveLength(2);
      expect(result.keyPoints[0]).toEqual({ timestamp: '0:30', point: 'First point' });
    });

    it('handles bullet points with different characters', () => {
      const response = `## Key Points
- [0:30] Dash bullet
• [1:00] Circle bullet`;
      const result = parseSummaryResponse(response);
      expect(result.keyPoints).toHaveLength(2);
    });

    it('handles numbered lists', () => {
      const response = `## Key Points
1. [0:30] First numbered point
2. [1:00] Second numbered point`;
      const result = parseSummaryResponse(response);
      expect(result.keyPoints).toHaveLength(2);
      expect(result.keyPoints[0]).toEqual({ timestamp: '0:30', point: 'First numbered point' });
    });

    it('handles points without timestamps', () => {
      const response = `## Key Points
- This point has no timestamp
- [1:00] This one does`;
      const result = parseSummaryResponse(response);
      expect(result.keyPoints).toHaveLength(2);
      expect(result.keyPoints[0]).toEqual({ timestamp: '0:00', point: 'This point has no timestamp' });
      expect(result.keyPoints[1]).toEqual({ timestamp: '1:00', point: 'This one does' });
    });

    it('parses Key Takeaways as key points', () => {
      const response = `## Key Takeaways
- [0:30] Important insight
- [1:00] Another insight`;
      const result = parseSummaryResponse(response);
      expect(result.keyPoints).toHaveLength(2);
    });
  });

  describe('full response parsing', () => {
    it('parses a complete response', () => {
      const response = `## Conclusion
Use TypeScript for better code quality

## Overview
This video explains why TypeScript is beneficial for large projects. It covers type safety, IDE support, and refactoring capabilities.

## Key Points
- [0:30] TypeScript adds static typing to JavaScript
- [2:15] IDE autocomplete becomes much more powerful
- [5:00] Refactoring is safer with type checking
- [8:30] Large teams benefit the most from TypeScript`;

      const result = parseSummaryResponse(response);

      expect(result.conclusion).toBe('Use TypeScript for better code quality');
      expect(result.overview).toContain('TypeScript is beneficial');
      expect(result.keyPoints).toHaveLength(4);
      expect(result.keyPoints[2].timestamp).toBe('5:00');
      expect(result.keyPoints[2].point).toBe('Refactoring is safer with type checking');
    });

    it('handles missing sections gracefully', () => {
      const response = `Some random text without proper sections`;
      const result = parseSummaryResponse(response);
      expect(result.conclusion).toBe('');
      expect(result.overview).toBe('');
      expect(result.keyPoints).toEqual([]);
    });

    it('handles response with only key points', () => {
      const response = `## Key Points
- [0:00] First point
- [1:00] Second point`;
      const result = parseSummaryResponse(response);
      expect(result.conclusion).toBe('');
      expect(result.overview).toBe('');
      expect(result.keyPoints).toHaveLength(2);
    });
  });

  describe('edge cases', () => {
    it('handles empty response', () => {
      const result = parseSummaryResponse('');
      expect(result.conclusion).toBe('');
      expect(result.overview).toBe('');
      expect(result.keyPoints).toEqual([]);
    });

    it('handles response with extra whitespace', () => {
      const response = `   ## Conclusion

   The answer is 42

   ## Overview

   Details here   `;
      const result = parseSummaryResponse(response);
      expect(result.conclusion).toBe('The answer is 42');
      expect(result.overview).toBe('Details here');
    });

    it('handles mixed case headers', () => {
      const response = `## CONCLUSION
Answer here

## OVERVIEW
Details here`;
      const result = parseSummaryResponse(response);
      expect(result.conclusion).toBe('Answer here');
      expect(result.overview).toBe('Details here');
    });
  });
});
