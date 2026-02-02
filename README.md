# TLDW

**Too Long; Didn't Watch** - Get AI summaries of YouTube videos without sitting through the whole thing.

A Chrome extension that grabs the transcript from any YouTube video and sends it to your AI provider of choice (OpenAI, Anthropic, or Google Gemini) to generate a quick summary with key points and timestamps.

## What it does

- Extracts transcripts from YouTube videos (works with auto-generated captions too)
- Generates a one-line "conclusion" so you know the bottom line immediately
- Gives you a brief overview and key points with clickable timestamps
- Click any timestamp to jump to that part of the video
- Copy the summary to clipboard

## Installation

1. Clone this repo
2. Run `npm install`
3. Run `npm run build`
4. Open Chrome and go to `chrome://extensions`
5. Enable "Developer mode" (top right)
6. Click "Load unpacked" and select the project folder

## Setup

Click the extension icon, then the settings gear. You'll need to:

1. Pick your AI provider (OpenAI, Anthropic, or Gemini)
2. Enter your API key
3. Choose a model

Your API key is stored locally in Chrome - it never touches any server except the AI provider you choose.

## Usage

1. Go to any YouTube video
2. Click the TLDW extension icon to open the side panel
3. Hit "Summarize Video"
4. Wait a few seconds for the AI to do its thing

## Development

```bash
npm run dev      # Build with watch mode
npm run build    # Production build
npm test         # Run unit tests
npm run test:e2e # Run E2E tests (requires build first)
```

Built with TypeScript and Vite. No framework bloat - just vanilla JS for the UI.

## Notes

- Videos need captions/transcripts available (most do)
- Longer videos = more API tokens = slightly higher cost
- The extension chunks transcripts into 30-second segments to keep token usage reasonable

## License

MIT
