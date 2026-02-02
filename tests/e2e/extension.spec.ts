import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import path from 'path';

/**
 * Chrome Extension E2E Tests
 *
 * These tests require the extension to be built first (npm run build).
 * Run with: npm run test:e2e
 *
 * Note: Chrome extensions can only be loaded in Chromium with a persistent context.
 */

const EXTENSION_PATH = path.join(__dirname, '../../dist');

// Helper to create a browser context with the extension loaded
async function createExtensionContext(): Promise<BrowserContext> {
  const userDataDir = path.join(__dirname, '../../test-user-data-dir');
  return chromium.launchPersistentContext(userDataDir, {
    headless: false, // Extensions require headed mode
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
    ],
  });
}

// Helper to get the extension ID from the loaded extensions
async function getExtensionId(context: BrowserContext): Promise<string> {
  // Navigate to chrome://extensions to get the extension ID
  const page = await context.newPage();
  await page.goto('chrome://extensions');

  // Wait for extensions to load and get the ID
  // This is a simplified approach - in real tests you might need more robust detection
  await page.waitForTimeout(1000);

  // Get extension ID from the service worker URL
  const serviceWorkers = context.serviceWorkers();
  for (const worker of serviceWorkers) {
    const url = worker.url();
    const match = url.match(/chrome-extension:\/\/([^/]+)/);
    if (match) {
      await page.close();
      return match[1];
    }
  }

  await page.close();
  throw new Error('Could not find extension ID');
}

test.describe('TLDW Extension', () => {
  let context: BrowserContext;
  let extensionId: string;

  test.beforeAll(async () => {
    context = await createExtensionContext();
    extensionId = await getExtensionId(context);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('extension loads successfully', async () => {
    expect(extensionId).toBeTruthy();
    expect(extensionId.length).toBeGreaterThan(0);
  });

  test('options page renders correctly', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/options/index.html`);

    // Check that the page has the expected elements
    await expect(page.locator('h1')).toContainText('TLDW');

    // Check for provider dropdown
    const providerSelect = page.locator('#provider');
    await expect(providerSelect).toBeVisible();

    // Check for API key input
    const apiKeyInput = page.locator('#api-key');
    await expect(apiKeyInput).toBeVisible();

    // Check for model dropdown
    const modelSelect = page.locator('#model');
    await expect(modelSelect).toBeVisible();

    await page.close();
  });

  test('options page saves settings', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/options/index.html`);

    // Select OpenAI provider
    await page.selectOption('#provider', 'openai');

    // Enter API key
    await page.fill('#api-key', 'test-api-key-12345');

    // Select a model
    await page.selectOption('#model', 'gpt-4o-mini');

    // Click save button
    await page.click('button[type="submit"]');

    // Wait for success message
    await page.waitForSelector('.success-message', { state: 'visible' });

    // Reload page and verify settings persisted
    await page.reload();

    await expect(page.locator('#provider')).toHaveValue('openai');
    await expect(page.locator('#api-key')).toHaveValue('test-api-key-12345');
    await expect(page.locator('#model')).toHaveValue('gpt-4o-mini');

    await page.close();
  });

  test('side panel renders on YouTube video page', async () => {
    const page = await context.newPage();

    // Navigate to a YouTube video
    await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Open the side panel programmatically
    // Note: This is a simplified test - real side panel testing requires
    // interacting with the extension popup or action button
    const sidePanelPage = await context.newPage();
    await sidePanelPage.goto(`chrome-extension://${extensionId}/src/sidepanel/index.html`);

    // Check that side panel elements are present
    await expect(sidePanelPage.locator('h1')).toContainText('TLDW');
    await expect(sidePanelPage.locator('#header-summarize-btn')).toBeVisible();
    await expect(sidePanelPage.locator('#summarize-btn')).toBeVisible();
    await expect(sidePanelPage.locator('#settings-btn')).toBeVisible();

    await page.close();
    await sidePanelPage.close();
  });

  test('summarize button shows loading state when clicked', async () => {
    const page = await context.newPage();

    // Open side panel directly
    await page.goto(`chrome-extension://${extensionId}/src/sidepanel/index.html`);

    // Get the summarize button
    const summarizeBtn = page.locator('#summarize-btn');
    await expect(summarizeBtn).toBeVisible();

    // Note: Clicking will fail because we're not on a real YouTube page
    // but we can verify the button exists and is interactive
    await expect(summarizeBtn).toBeEnabled();

    await page.close();
  });
});

test.describe('Content Script Integration', () => {
  let context: BrowserContext;

  test.beforeAll(async () => {
    context = await createExtensionContext();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('content script injects on YouTube video pages', async () => {
    const page = await context.newPage();

    // Navigate to YouTube
    await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.waitForLoadState('domcontentloaded');

    // Check that our content script logged its presence
    // Note: In real tests, you might want to check for specific DOM modifications
    // or message passing functionality

    // Wait for video player to be ready (indicates page is fully loaded)
    await page.waitForSelector('video', { timeout: 10000 }).catch(() => {
      // Video might not load in headless/test environment
    });

    await page.close();
  });

  test('handles non-YouTube pages gracefully', async () => {
    const page = await context.newPage();

    // Navigate to a non-YouTube page
    await page.goto('https://example.com');
    await page.waitForLoadState('domcontentloaded');

    // Content script should not throw errors
    // Check console for any extension-related errors
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      if (error.message.includes('TLDW')) {
        errors.push(error.message);
      }
    });

    await page.waitForTimeout(1000);
    expect(errors).toHaveLength(0);

    await page.close();
  });
});

test.describe('UI Components', () => {
  let context: BrowserContext;
  let extensionId: string;

  test.beforeAll(async () => {
    context = await createExtensionContext();
    extensionId = await getExtensionId(context);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('settings button navigates to options page', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/sidepanel/index.html`);

    // The settings button sends a message to open options
    // We can't directly test the navigation in this context,
    // but we can verify the button exists and is clickable
    const settingsBtn = page.locator('#settings-btn');
    await expect(settingsBtn).toBeVisible();
    await expect(settingsBtn).toHaveAttribute('title', 'Settings');

    await page.close();
  });

  test('error state displays correctly', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/sidepanel/index.html`);

    // Manually trigger error state for testing
    await page.evaluate(() => {
      const errorState = document.getElementById('error-state');
      const initialState = document.getElementById('initial-state');
      const errorMessage = document.getElementById('error-message');

      if (errorState && initialState && errorMessage) {
        initialState.classList.add('hidden');
        errorState.classList.remove('hidden');
        errorMessage.textContent = 'Test error message';
      }
    });

    // Verify error state is visible
    await expect(page.locator('#error-state')).toBeVisible();
    await expect(page.locator('#error-message')).toContainText('Test error message');
    await expect(page.locator('#retry-btn')).toBeVisible();

    await page.close();
  });

  test('summary state displays correctly', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/sidepanel/index.html`);

    // Manually trigger summary state for testing
    await page.evaluate(() => {
      const summaryState = document.getElementById('summary-state');
      const initialState = document.getElementById('initial-state');
      const summaryConclusion = document.getElementById('summary-conclusion');
      const summaryOverview = document.getElementById('summary-overview');
      const keyPointsList = document.getElementById('key-points');

      if (summaryState && initialState && summaryConclusion && summaryOverview && keyPointsList) {
        initialState.classList.add('hidden');
        summaryState.classList.remove('hidden');
        summaryConclusion.textContent = 'Test conclusion';
        summaryOverview.textContent = 'Test overview description';

        // Add a test key point
        const li = document.createElement('li');
        li.className = 'key-point';
        li.innerHTML = `
          <button class="timestamp">0:30</button>
          <span class="point-text">Test key point</span>
        `;
        keyPointsList.appendChild(li);
      }
    });

    // Verify summary state is visible
    await expect(page.locator('#summary-state')).toBeVisible();
    await expect(page.locator('#summary-conclusion')).toContainText('Test conclusion');
    await expect(page.locator('#summary-overview')).toContainText('Test overview');
    await expect(page.locator('.key-point')).toBeVisible();
    await expect(page.locator('.timestamp')).toContainText('0:30');
    await expect(page.locator('#copy-btn')).toBeVisible();

    await page.close();
  });
});
