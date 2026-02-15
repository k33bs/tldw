export type AIProvider = 'openai' | 'anthropic' | 'gemini' | 'deepseek' | 'grok' | 'mistral' | 'glm' | 'kimi';

export interface Settings {
  provider: AIProvider;
  apiKey: string;
  model: string;
  summaryLength: 'short' | 'medium' | 'long';
}

export const DEFAULT_SETTINGS: Settings = {
  provider: 'openai',
  apiKey: '',
  model: 'gpt-4.1-nano',
  summaryLength: 'medium',
};

export const MODELS: Record<AIProvider, { id: string; name: string }[]> = {
  openai: [
    { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini' },
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4.1', name: 'GPT-4.1' },
    { id: 'o3-mini', name: 'o3 Mini' },
    { id: 'o3', name: 'o3' },
    { id: 'o4-mini', name: 'o4-mini' },
    { id: 'gpt-5-nano', name: 'GPT-5 Nano' },
    { id: 'gpt-5-mini', name: 'GPT-5 Mini' },
    { id: 'gpt-5', name: 'GPT-5' },
    { id: 'gpt-5.1', name: 'GPT-5.1' },
    { id: 'gpt-5.2', name: 'GPT-5.2' },
  ],
  anthropic: [
    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
    { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5' },
    { id: 'claude-sonnet-4-0', name: 'Claude Sonnet 4' },
    { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5' },
    { id: 'claude-opus-4-5', name: 'Claude Opus 4.5' },
    { id: 'claude-opus-4-6', name: 'Claude Opus 4.6' },
  ],
  gemini: [
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash' },
    { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro' },
  ],
  deepseek: [
    { id: 'deepseek-chat', name: 'DeepSeek V3' },
    { id: 'deepseek-reasoner', name: 'DeepSeek R1' },
  ],
  grok: [
    { id: 'grok-3-mini', name: 'Grok 3 Mini' },
    { id: 'grok-3', name: 'Grok 3' },
    { id: 'grok-4-0709', name: 'Grok 4' },
    { id: 'grok-4-fast-non-reasoning', name: 'Grok 4 Fast' },
    { id: 'grok-4-fast-reasoning', name: 'Grok 4 Fast (Reasoning)' },
    { id: 'grok-4-1-fast-non-reasoning', name: 'Grok 4.1 Fast' },
    { id: 'grok-4-1-fast-reasoning', name: 'Grok 4.1 Fast (Reasoning)' },
  ],
  mistral: [
    { id: 'mistral-small-latest', name: 'Mistral Small' },
    { id: 'mistral-medium-latest', name: 'Mistral Medium' },
    { id: 'mistral-large-latest', name: 'Mistral Large' },
    { id: 'magistral-small-latest', name: 'Magistral Small' },
    { id: 'magistral-medium-latest', name: 'Magistral Medium' },
  ],
  glm: [
    { id: 'glm-4-plus', name: 'GLM 4 Plus' },
    { id: 'glm-4.5-flash', name: 'GLM 4.5 Flash' },
    { id: 'glm-4.5-air', name: 'GLM 4.5 Air' },
    { id: 'glm-4.5', name: 'GLM 4.5' },
    { id: 'glm-4.6', name: 'GLM 4.6' },
    { id: 'glm-4.7', name: 'GLM 4.7' },
    { id: 'glm-5', name: 'GLM 5' },
  ],
  kimi: [
    { id: 'moonshot-v1-32k', name: 'Moonshot V1 32K' },
    { id: 'moonshot-v1-128k', name: 'Moonshot V1 128K' },
    { id: 'kimi-k2-0711-preview', name: 'Kimi K2' },
    { id: 'kimi-k2-thinking', name: 'Kimi K2 Thinking' },
    { id: 'kimi-k2.5', name: 'Kimi K2.5' },
  ],
};

export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...result.settings };
}

export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  const current = await getSettings();
  await chrome.storage.local.set({
    settings: { ...current, ...settings },
  });
}

export async function getApiKey(): Promise<string> {
  const settings = await getSettings();
  return settings.apiKey;
}

export async function saveApiKey(apiKey: string): Promise<void> {
  await saveSettings({ apiKey });
}
