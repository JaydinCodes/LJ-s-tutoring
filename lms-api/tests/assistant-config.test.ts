import { describe, expect, it } from 'vitest';
import { loadAssistantConfig } from '../src/domains/assistant/config.js';

describe('assistant configuration', () => {
  it('uses OpenRouter as the configured Odie provider', () => {
    const config = loadAssistantConfig({
      OPENROUTER_API_KEY: 'test-openrouter-key',
      OPENROUTER_MODEL: 'google/gemma-4-31b-it:free',
      DEFAULT_MODEL: 'legacy-default-model',
    } as NodeJS.ProcessEnv);

    expect(config.openRouterApiKey).toBe('test-openrouter-key');
    expect(config.openRouterModel).toBe('google/gemma-4-31b-it:free');
    expect('groqApiKey' in config).toBe(false);
  });
});
