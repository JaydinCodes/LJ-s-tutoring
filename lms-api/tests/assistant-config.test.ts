import { describe, expect, it } from 'vitest';
import { loadAssistantConfig } from '../src/domains/assistant/config.js';

describe('assistant configuration', () => {
  it('does not send OpenRouter default models to Groq', () => {
    const config = loadAssistantConfig({
      GROQ_API_KEY: 'test-groq-key',
      GROQ_MODEL: 'llama-3.1-8b-instant',
      OPENROUTER_API_KEY: 'test-openrouter-key',
      OPENROUTER_MODEL: 'google/gemma-2-9b-it:free',
      DEFAULT_MODEL: 'google/gemma-4-26b-a4b-it:free',
    } as NodeJS.ProcessEnv);

    expect(config.groqModel).toBe('llama-3.1-8b-instant');
    expect(config.openRouterModel).toBe('google/gemma-2-9b-it:free');
  });
});
