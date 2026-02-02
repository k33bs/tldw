# Privacy Policy for TLDW

**Last updated: February 2, 2026**

## Overview

TLDW ("Too Long; Didn't Watch") is a browser extension that summarizes YouTube videos using AI. We are committed to protecting your privacy. This policy explains what data we collect, how we use it, and your rights.

## Data Collection

### What We Collect

**We do not collect any personal data.** The extension operates entirely locally on your device.

### What We Store Locally

The following data is stored locally in your browser using Chrome's storage API:

- **AI Provider Selection**: Your choice of AI provider (OpenAI, Anthropic, or Google)
- **Model Selection**: Your preferred AI model
- **API Key**: Your personal API key for the selected provider
- **Summary Length Preference**: Your preferred summary detail level

This data never leaves your device except as described below.

## Data Transmission

### YouTube Transcripts

When you request a video summary:

1. The extension extracts the transcript from the YouTube video you are viewing
2. The transcript is sent directly to your chosen AI provider (OpenAI, Anthropic, or Google)
3. The AI provider returns a summary which is displayed in the extension

**We do not operate any servers. We do not see, store, or have access to your transcripts or summaries.**

### Third-Party AI Providers

Your transcript data is sent directly from your browser to the AI provider you configure:

- **OpenAI**: Subject to [OpenAI's Privacy Policy](https://openai.com/privacy)
- **Anthropic**: Subject to [Anthropic's Privacy Policy](https://www.anthropic.com/privacy)
- **Google**: Subject to [Google's Privacy Policy](https://policies.google.com/privacy)

You are responsible for reviewing and accepting these providers' terms and privacy policies.

## Data Security

- Your API key is stored locally in Chrome's secure storage
- All communication with AI providers uses HTTPS encryption
- No data is transmitted to any servers we operate

## Data We Do NOT Collect

- No personal information
- No browsing history
- No YouTube watch history
- No analytics or tracking
- No cookies
- No advertising identifiers

## Children's Privacy

This extension is not directed at children under 13. We do not knowingly collect any information from children.

## Changes to This Policy

We may update this privacy policy from time to time. Changes will be posted to this page with an updated revision date.

## Contact

For questions about this privacy policy, please open an issue on our GitHub repository:
https://github.com/k33bs/tldw/issues

## Your Rights

Since we don't collect personal data, there is no personal data to access, modify, or delete. Your locally stored settings can be cleared by removing the extension or clearing extension data in Chrome settings.
