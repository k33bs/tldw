import { generateSummary, SummaryResult } from '../lib/ai-providers';

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

// Handle messages from side panel and content script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GENERATE_SUMMARY') {
    handleGenerateSummary(message.transcript)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({ error: error.message });
      });
    return true;
  }

  if (message.type === 'OPEN_OPTIONS') {
    chrome.runtime.openOptionsPage();
    sendResponse({ success: true });
    return false;
  }

  return false;
});

async function handleGenerateSummary(transcript: string): Promise<{ summary: SummaryResult } | { error: string }> {
  try {
    const summary = await generateSummary(transcript);
    return { summary };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unknown error occurred' };
  }
}
