import { getSettings, saveSettings, MODELS, AIProvider, Settings } from '../lib/storage';

const providerSelect = document.getElementById('provider') as HTMLSelectElement;
const modelSelect = document.getElementById('model') as HTMLSelectElement;
const apiKeyInput = document.getElementById('api-key') as HTMLInputElement;
const summaryLengthSelect = document.getElementById('summary-length') as HTMLSelectElement;
const toggleKeyBtn = document.getElementById('toggle-key') as HTMLButtonElement;
const providerInfo = document.getElementById('provider-info') as HTMLParagraphElement;
const form = document.getElementById('settings-form') as HTMLFormElement;
const status = document.getElementById('status') as HTMLDivElement;

const PROVIDER_LINKS: Record<AIProvider, { name: string; url: string }> = {
  openai: { name: 'OpenAI', url: 'https://platform.openai.com/api-keys' },
  anthropic: { name: 'Anthropic', url: 'https://console.anthropic.com/settings/keys' },
  gemini: { name: 'Google AI Studio', url: 'https://aistudio.google.com/app/apikey' },
  deepseek: { name: 'DeepSeek', url: 'https://platform.deepseek.com/api_keys' },
  grok: { name: 'xAI', url: 'https://console.x.ai/' },
  mistral: { name: 'Mistral', url: 'https://console.mistral.ai/api-keys/' },
  glm: { name: 'Zhipu AI', url: 'https://open.bigmodel.cn/usercenter/apikeys' },
  kimi: { name: 'Moonshot AI', url: 'https://platform.moonshot.cn/console/api-keys' },
};

function updateModelOptions(provider: AIProvider, currentModel?: string) {
  const models = MODELS[provider];
  modelSelect.innerHTML = '';

  for (const model of models) {
    const option = document.createElement('option');
    option.value = model.id;
    option.textContent = model.name;
    if (currentModel === model.id) {
      option.selected = true;
    }
    modelSelect.appendChild(option);
  }

  // If current model not in list, select first
  if (currentModel && !models.some(m => m.id === currentModel)) {
    modelSelect.selectedIndex = 0;
  }
}

function updateProviderInfo(provider: AIProvider) {
  const info = PROVIDER_LINKS[provider];
  providerInfo.innerHTML = `Get your API key from <a href="${info.url}" target="_blank">${info.name}</a>`;
}

function showStatus(message: string, type: 'success' | 'error') {
  status.textContent = message;
  status.className = `status ${type}`;
  setTimeout(() => {
    status.classList.add('hidden');
  }, 3000);
}

// Load current settings
async function loadSettings() {
  const settings = await getSettings();

  providerSelect.value = settings.provider;
  apiKeyInput.value = settings.apiKey;
  summaryLengthSelect.value = settings.summaryLength;

  updateModelOptions(settings.provider, settings.model);
  updateProviderInfo(settings.provider);
}

// Event listeners
providerSelect.addEventListener('change', () => {
  const provider = providerSelect.value as AIProvider;
  updateModelOptions(provider);
  updateProviderInfo(provider);
});

toggleKeyBtn.addEventListener('click', () => {
  const isPassword = apiKeyInput.type === 'password';
  apiKeyInput.type = isPassword ? 'text' : 'password';
  toggleKeyBtn.innerHTML = isPassword
    ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
        <line x1="1" y1="1" x2="23" y2="23"></line>
      </svg>`
    : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>`;
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const settings: Partial<Settings> = {
    provider: providerSelect.value as AIProvider,
    model: modelSelect.value,
    apiKey: apiKeyInput.value,
    summaryLength: summaryLengthSelect.value as Settings['summaryLength'],
  };

  try {
    await saveSettings(settings);
    showStatus('Settings saved successfully!', 'success');
  } catch (error) {
    showStatus('Failed to save settings', 'error');
  }
});

// Initialize
loadSettings();
