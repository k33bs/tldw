import { describe, it, expect } from 'vitest';
import {
  formatTimestamp,
  parseTimestamp,
  getVideoId,
  parseXmlTranscript,
  parseJson3Transcript,
  parseSrv3Transcript,
  parseVttTranscript,
  decodeHtmlEntities,
} from '../../src/lib/transcript';

describe('formatTimestamp', () => {
  it('formats seconds to MM:SS', () => {
    expect(formatTimestamp(0)).toBe('0:00');
    expect(formatTimestamp(5)).toBe('0:05');
    expect(formatTimestamp(65)).toBe('1:05');
    expect(formatTimestamp(125)).toBe('2:05');
  });

  it('formats to H:MM:SS for hours', () => {
    expect(formatTimestamp(3600)).toBe('1:00:00');
    expect(formatTimestamp(3665)).toBe('1:01:05');
    expect(formatTimestamp(7325)).toBe('2:02:05');
  });

  it('pads minutes and seconds correctly', () => {
    expect(formatTimestamp(61)).toBe('1:01');
    expect(formatTimestamp(3661)).toBe('1:01:01');
  });
});

describe('parseTimestamp', () => {
  it('parses MM:SS format', () => {
    expect(parseTimestamp('0:00')).toBe(0);
    expect(parseTimestamp('1:05')).toBe(65);
    expect(parseTimestamp('10:30')).toBe(630);
  });

  it('parses H:MM:SS format', () => {
    expect(parseTimestamp('1:00:00')).toBe(3600);
    expect(parseTimestamp('1:01:05')).toBe(3665);
    expect(parseTimestamp('2:30:45')).toBe(9045);
  });
});

describe('getVideoId', () => {
  it('extracts video ID from standard YouTube URL', () => {
    expect(getVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts video ID with additional params', () => {
    expect(getVideoId('https://www.youtube.com/watch?v=abc123&t=120')).toBe('abc123');
    expect(getVideoId('https://www.youtube.com/watch?list=PLtest&v=xyz789')).toBe('xyz789');
  });

  it('returns null for invalid URLs', () => {
    expect(getVideoId('https://www.youtube.com/channel/UC123')).toBe(null);
    expect(getVideoId('https://example.com')).toBe(null);
  });
});

describe('decodeHtmlEntities', () => {
  it('decodes common HTML entities', () => {
    expect(decodeHtmlEntities('&amp;')).toBe('&');
    expect(decodeHtmlEntities('&lt;')).toBe('<');
    expect(decodeHtmlEntities('&gt;')).toBe('>');
    expect(decodeHtmlEntities('&quot;')).toBe('"');
    expect(decodeHtmlEntities('&#39;')).toBe("'");
    expect(decodeHtmlEntities('&#x27;')).toBe("'");
    expect(decodeHtmlEntities('&#x2F;')).toBe('/');
    expect(decodeHtmlEntities('&nbsp;')).toBe(' ');
  });

  it('decodes multiple entities in a string', () => {
    expect(decodeHtmlEntities('Tom &amp; Jerry')).toBe('Tom & Jerry');
    expect(decodeHtmlEntities('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')).toBe('<script>alert("xss")</script>');
  });

  it('leaves regular text unchanged', () => {
    expect(decodeHtmlEntities('Hello World')).toBe('Hello World');
  });
});

describe('parseXmlTranscript', () => {
  it('parses basic XML transcript format', () => {
    const xml = `
      <text start="0" dur="5">Hello world</text>
      <text start="5.5" dur="3.2">This is a test</text>
    `;
    const result = parseXmlTranscript(xml);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ text: 'Hello world', start: 0, duration: 5 });
    expect(result[1]).toEqual({ text: 'This is a test', start: 5.5, duration: 3.2 });
  });

  it('decodes HTML entities in text', () => {
    const xml = `<text start="0" dur="5">Tom &amp; Jerry</text>`;
    const result = parseXmlTranscript(xml);
    expect(result[0].text).toBe('Tom & Jerry');
  });

  it('handles multi-line content', () => {
    const xml = `<text start="0" dur="5">Line one
Line two</text>`;
    const result = parseXmlTranscript(xml);
    expect(result[0].text).toBe('Line one Line two');
  });

  it('skips empty text segments', () => {
    const xml = `
      <text start="0" dur="5">Hello</text>
      <text start="5" dur="3"></text>
      <text start="8" dur="2">World</text>
    `;
    const result = parseXmlTranscript(xml);
    expect(result).toHaveLength(2);
  });

  it('handles additional attributes in text tags', () => {
    const xml = `<text start="0" dur="5" attr="value">Hello</text>`;
    const result = parseXmlTranscript(xml);
    expect(result[0].text).toBe('Hello');
  });
});

describe('parseJson3Transcript', () => {
  it('parses JSON3 transcript format', () => {
    const json = JSON.stringify({
      events: [
        { tStartMs: 0, dDurationMs: 5000, segs: [{ utf8: 'Hello ' }, { utf8: 'world' }] },
        { tStartMs: 5500, dDurationMs: 3200, segs: [{ utf8: 'Test' }] },
      ],
    });
    const result = parseJson3Transcript(json);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ text: 'Hello world', start: 0, duration: 5 });
    expect(result[1]).toEqual({ text: 'Test', start: 5.5, duration: 3.2 });
  });

  it('skips events without segs', () => {
    const json = JSON.stringify({
      events: [
        { tStartMs: 0, dDurationMs: 5000, segs: [{ utf8: 'Hello' }] },
        { tStartMs: 5000, dDurationMs: 1000 }, // No segs
        { tStartMs: 6000, dDurationMs: 2000, segs: [{ utf8: 'World' }] },
      ],
    });
    const result = parseJson3Transcript(json);
    expect(result).toHaveLength(2);
  });

  it('skips empty text segments', () => {
    const json = JSON.stringify({
      events: [
        { tStartMs: 0, dDurationMs: 5000, segs: [{ utf8: '' }] },
        { tStartMs: 5000, dDurationMs: 1000, segs: [{ utf8: '  ' }] },
        { tStartMs: 6000, dDurationMs: 2000, segs: [{ utf8: 'Valid' }] },
      ],
    });
    const result = parseJson3Transcript(json);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('Valid');
  });

  it('returns empty array for invalid JSON', () => {
    const result = parseJson3Transcript('not valid json');
    expect(result).toEqual([]);
  });

  it('returns empty array for JSON without events', () => {
    const result = parseJson3Transcript('{}');
    expect(result).toEqual([]);
  });
});

describe('parseSrv3Transcript', () => {
  it('parses SRV3 transcript format', () => {
    const srv3 = `
      <p t="0" d="5000">Hello world</p>
      <p t="5500" d="3200">This is a test</p>
    `;
    const result = parseSrv3Transcript(srv3);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ text: 'Hello world', start: 0, duration: 5 });
    expect(result[1]).toEqual({ text: 'This is a test', start: 5.5, duration: 3.2 });
  });

  it('removes <s> tags from content', () => {
    const srv3 = `<p t="0" d="5000"><s p="2">Hello</s> <s>world</s></p>`;
    const result = parseSrv3Transcript(srv3);
    expect(result[0].text).toBe('Hello world');
  });

  it('decodes HTML entities', () => {
    const srv3 = `<p t="0" d="5000">Tom &amp; Jerry</p>`;
    const result = parseSrv3Transcript(srv3);
    expect(result[0].text).toBe('Tom & Jerry');
  });

  it('handles multi-line content', () => {
    const srv3 = `<p t="0" d="5000">Line one
Line two</p>`;
    const result = parseSrv3Transcript(srv3);
    expect(result[0].text).toBe('Line one Line two');
  });
});

describe('parseVttTranscript', () => {
  it('parses basic VTT transcript', () => {
    const vtt = `WEBVTT

00:00:00.000 --> 00:00:05.000
Hello world

00:00:05.500 --> 00:00:08.700
This is a test`;
    const result = parseVttTranscript(vtt);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ text: 'Hello world', start: 0, duration: 5 });
    expect(result[1].text).toBe('This is a test');
    expect(result[1].start).toBe(5.5);
    expect(result[1].duration).toBeCloseTo(3.2, 5);
  });

  it('handles captions starting at 0:00', () => {
    const vtt = `WEBVTT

00:00:00.000 --> 00:00:03.000
First caption at zero

00:00:03.000 --> 00:00:06.000
Second caption`;
    const result = parseVttTranscript(vtt);
    expect(result).toHaveLength(2);
    expect(result[0].start).toBe(0);
    expect(result[0].text).toBe('First caption at zero');
  });

  it('handles cue numbers', () => {
    const vtt = `WEBVTT

1
00:00:00.000 --> 00:00:05.000
First caption

2
00:00:05.000 --> 00:00:10.000
Second caption`;
    const result = parseVttTranscript(vtt);
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe('First caption');
    expect(result[1].text).toBe('Second caption');
  });

  it('removes HTML tags from text', () => {
    const vtt = `WEBVTT

00:00:00.000 --> 00:00:05.000
<c.colorCCCCCC>Styled</c> text`;
    const result = parseVttTranscript(vtt);
    expect(result[0].text).toBe('Styled text');
  });

  it('handles multi-line captions', () => {
    const vtt = `WEBVTT

00:00:00.000 --> 00:00:05.000
Line one
Line two`;
    const result = parseVttTranscript(vtt);
    expect(result[0].text).toBe('Line one Line two');
  });

  it('handles last segment without trailing newline', () => {
    const vtt = `WEBVTT

00:00:00.000 --> 00:00:05.000
Last caption without newline`;
    const result = parseVttTranscript(vtt);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('Last caption without newline');
  });

  it('parses VTT without hours (MM:SS.mmm format)', () => {
    const vtt = `WEBVTT

00:00.000 --> 00:05.000
First caption at zero

00:05.000 --> 00:10.500
Second caption`;
    const result = parseVttTranscript(vtt);
    expect(result).toHaveLength(2);
    expect(result[0].start).toBe(0);
    expect(result[0].duration).toBe(5);
    expect(result[0].text).toBe('First caption at zero');
    expect(result[1].start).toBe(5);
    expect(result[1].duration).toBe(5.5);
  });

  it('parses mixed format (with and without hours)', () => {
    const vtt = `WEBVTT

00:30.000 --> 00:45.000
Short format caption

01:00:00.000 --> 01:00:10.000
Long format caption`;
    const result = parseVttTranscript(vtt);
    expect(result).toHaveLength(2);
    expect(result[0].start).toBe(30);
    expect(result[1].start).toBe(3600);
  });
});
