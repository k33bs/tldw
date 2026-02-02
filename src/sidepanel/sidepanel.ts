interface SummaryResult {
  conclusion: string;
  overview: string;
  keyPoints: {
    timestamp: string;
    point: string;
  }[];
}

// DOM Elements
const settingsBtn = document.getElementById('settings-btn') as HTMLButtonElement;
const headerSummarizeBtn = document.getElementById('header-summarize-btn') as HTMLButtonElement;
const videoInfo = document.getElementById('video-info') as HTMLDivElement;
const videoTitle = document.getElementById('video-title') as HTMLHeadingElement;
const initialState = document.getElementById('initial-state') as HTMLDivElement;
const loadingState = document.getElementById('loading-state') as HTMLDivElement;
const loadingStatus = document.getElementById('loading-status') as HTMLParagraphElement;
const errorState = document.getElementById('error-state') as HTMLDivElement;
const summaryState = document.getElementById('summary-state') as HTMLDivElement;
const summarizeBtn = document.getElementById('summarize-btn') as HTMLButtonElement;
const retryBtn = document.getElementById('retry-btn') as HTMLButtonElement;
const copyBtn = document.getElementById('copy-btn') as HTMLButtonElement;
const errorMessage = document.getElementById('error-message') as HTMLParagraphElement;
const summaryConclusion = document.getElementById('summary-conclusion') as HTMLParagraphElement;
const summaryOverview = document.getElementById('summary-overview') as HTMLParagraphElement;
const keyPointsList = document.getElementById('key-points') as HTMLUListElement;

let currentSummary: SummaryResult | null = null;
let currentVideoTitle = '';

// State management
type AppState = 'initial' | 'loading' | 'error' | 'summary';

function showState(state: AppState) {
  initialState.classList.toggle('hidden', state !== 'initial');
  loadingState.classList.toggle('hidden', state !== 'loading');
  errorState.classList.toggle('hidden', state !== 'error');
  summaryState.classList.toggle('hidden', state !== 'summary');
}

function setButtonsDisabled(disabled: boolean) {
  headerSummarizeBtn.disabled = disabled;
  summarizeBtn.disabled = disabled;
  retryBtn.disabled = disabled;

  // Toggle main summarize button loading state
  const summarizeBtnText = summarizeBtn.querySelector('.btn-text') as HTMLSpanElement;
  const summarizeBtnLoading = summarizeBtn.querySelector('.btn-loading') as HTMLSpanElement;
  if (summarizeBtnText && summarizeBtnLoading) {
    summarizeBtnText.classList.toggle('hidden', disabled);
    summarizeBtnLoading.classList.toggle('hidden', !disabled);
  }

  // Toggle retry button loading state
  const retryBtnText = retryBtn.querySelector('.btn-text') as HTMLSpanElement;
  const retryBtnLoading = retryBtn.querySelector('.btn-loading') as HTMLSpanElement;
  if (retryBtnText && retryBtnLoading) {
    retryBtnText.classList.toggle('hidden', disabled);
    retryBtnLoading.classList.toggle('hidden', !disabled);
  }
}

function setLoadingStatus(status: string) {
  loadingStatus.textContent = status;
}

function showError(message: string) {
  errorMessage.textContent = message;
  showState('error');
  setButtonsDisabled(false);
}

function showToast(message: string) {
  let toast = document.querySelector('.toast') as HTMLDivElement | null;
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast?.classList.remove('show'), 2000);
}

// Get the current tab
async function getCurrentTab(): Promise<chrome.tabs.Tab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

// Try to inject the content script
async function injectContentScript(tabId: number): Promise<boolean> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['dist/content-youtube.js'],
    });
    // Give it a moment to initialize
    await new Promise((resolve) => setTimeout(resolve, 100));
    return true;
  } catch (error) {
    console.error('[TLDW] Failed to inject content script:', error);
    return false;
  }
}

// Send message to content script with retry logic
async function sendToContent<T>(
  message: any,
  maxRetries = 2
): Promise<T> {
  const tab = await getCurrentTab();
  if (!tab?.id) {
    throw new Error('No active tab found');
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await chrome.tabs.sendMessage(tab.id, message);
      return response as T;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if it's a connection error (content script not loaded)
      const isConnectionError =
        lastError.message.includes('Receiving end does not exist') ||
        lastError.message.includes('Could not establish connection');

      if (isConnectionError && attempt < maxRetries) {
        // Try to inject the content script
        setLoadingStatus('Reconnecting to page...');
        const injected = await injectContentScript(tab.id);
        if (!injected) {
          throw new Error(
            'Could not connect to the page. Please refresh the YouTube page and try again.'
          );
        }
        // Wait a bit before retrying
        await new Promise((resolve) => setTimeout(resolve, 200));
        continue;
      }

      throw lastError;
    }
  }

  throw lastError || new Error('Failed to communicate with the page');
}

// Main summarize function
async function summarize() {
  setButtonsDisabled(true);
  showState('loading');
  setLoadingStatus('Fetching transcript...');

  try {
    // Get transcript from content script
    const transcriptResult = await sendToContent<{
      transcript?: string;
      videoTitle?: string;
      error?: string;
    }>({ type: 'GET_TRANSCRIPT' });

    if (transcriptResult.error) {
      throw new Error(transcriptResult.error);
    }

    if (!transcriptResult.transcript) {
      throw new Error('Failed to extract transcript');
    }

    // Update video title
    currentVideoTitle = transcriptResult.videoTitle || 'Unknown Video';
    videoTitle.textContent = currentVideoTitle;
    videoInfo.classList.remove('hidden');

    // Update status
    setLoadingStatus('Generating summary...');

    // Generate summary via service worker
    const summaryResult = (await chrome.runtime.sendMessage({
      type: 'GENERATE_SUMMARY',
      transcript: transcriptResult.transcript,
    })) as { summary?: SummaryResult; error?: string };

    if (summaryResult.error) {
      throw new Error(summaryResult.error);
    }

    if (!summaryResult.summary) {
      throw new Error('Failed to generate summary');
    }

    currentSummary = summaryResult.summary;
    displaySummary(currentSummary);
    showState('summary');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An error occurred';

    // Provide better error messages for common issues
    if (message.includes('Receiving end does not exist') || message.includes('Could not establish connection')) {
      showError('Lost connection to the page. Please refresh the YouTube page and try again.');
    } else if (message.includes('API key')) {
      showError('API key not configured. Click the settings icon to add your API key.');
    } else {
      showError(message);
    }
  } finally {
    setButtonsDisabled(false);
  }
}

// Display summary in UI
function displaySummary(summary: SummaryResult) {
  summaryConclusion.textContent = summary.conclusion || '';
  summaryOverview.textContent = summary.overview;

  keyPointsList.innerHTML = '';
  for (const point of summary.keyPoints) {
    const li = document.createElement('li');
    li.className = 'key-point';

    const timestampBtn = document.createElement('button');
    timestampBtn.className = 'timestamp';
    timestampBtn.textContent = point.timestamp;
    timestampBtn.addEventListener('click', () => seekToTimestamp(point.timestamp));

    const pointText = document.createElement('span');
    pointText.className = 'point-text';
    pointText.textContent = point.point;

    li.appendChild(timestampBtn);
    li.appendChild(pointText);
    keyPointsList.appendChild(li);
  }
}

// Seek video to timestamp
async function seekToTimestamp(timestamp: string) {
  try {
    await sendToContent({ type: 'SEEK_TO_TIMESTAMP', timestamp }, 1);
  } catch (error) {
    console.error('[TLDW] Failed to seek:', error);
    showToast('Could not seek. Try refreshing the page.');
  }
}

// Copy summary to clipboard
async function copySummary() {
  if (!currentSummary) return;

  const text = formatSummaryAsText(currentSummary);
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied to clipboard!');
  } catch (error) {
    showToast('Failed to copy');
  }
}

function formatSummaryAsText(summary: SummaryResult): string {
  let text = `# ${currentVideoTitle}\n\n`;
  if (summary.conclusion) {
    text += `**TL;DR:** ${summary.conclusion}\n\n`;
  }
  text += `## Overview\n${summary.overview}\n\n`;
  text += `## Key Points\n`;
  for (const point of summary.keyPoints) {
    text += `- [${point.timestamp}] ${point.point}\n`;
  }
  return text;
}

// Event listeners
settingsBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' });
});

headerSummarizeBtn.addEventListener('click', summarize);
summarizeBtn.addEventListener('click', summarize);
retryBtn.addEventListener('click', summarize);
copyBtn.addEventListener('click', copySummary);

// Initialize
async function init() {
  const tab = await getCurrentTab();
  if (tab?.url && tab.url.includes('youtube.com/watch')) {
    // We're on a video page, ready to summarize
  } else {
    // Not on a video page
    const helperText = initialState.querySelector('.helper-text');
    if (helperText) {
      helperText.textContent = 'Please navigate to a YouTube video to use this extension.';
    }
    summarizeBtn.disabled = true;
    headerSummarizeBtn.disabled = true;
  }
}

init();
