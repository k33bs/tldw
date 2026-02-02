export type AIProvider = 'openai' | 'anthropic' | 'gemini';

export interface Settings {
  provider: AIProvider;
  apiKey: string;
  model: string;
  summaryLength: 'short' | 'medium' | 'long';
}

export const DEFAULT_SETTINGS: Settings = {
  provider: 'openai',
  apiKey: '',
  model: 'gpt-4o-mini',
  summaryLength: 'medium',
};

export const MODELS: Record<AIProvider, { id: string; name: string }[]> = {
  openai: [
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'gpt-4o', name: 'GPT-4o' },
  ],
  anthropic: [
    { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku' },
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
  ],
  gemini: [
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
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
