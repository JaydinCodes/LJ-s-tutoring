import { describe, expect, it, vi } from 'vitest';
import { AssistantError } from '../src/domains/assistant/errors.js';
import { buildProviderPlan, AssistantService } from '../src/domains/assistant/service.js';
import { chunkDocumentText, selectRelevantChunks } from '../src/domains/assistant/chunking.js';
import type { AssistantConfig } from '../src/domains/assistant/config.js';
import type { AssistantProvider } from '../src/domains/assistant/provider.js';

function baseConfig(overrides: Partial<AssistantConfig> = {}): AssistantConfig {
  return {
    openRouterApiKey: 'test-openrouter-key',
    openRouterModel: 'google/gemma-4-31b-it:free',
    lmStudioBaseUrl: '',
    lmStudioModel: '',
    maxTokens: 1024,
    temperature: 0.4,
    timeoutMs: 5000,
    maxInputChars: 20000,
    maxHistoryMessages: 12,
    maxDocumentChars: 50000,
    chunkSize: 120,
    chunkOverlap: 20,
    retryAttempts: 0,
    retryDelayMs: 0,
    ...overrides,
  };
}

function createProvider(
  name: 'openrouter' | 'lmstudio',
  handler: (messages: Array<{ role: string; content: string }>) => Promise<string>,
): AssistantProvider {
  return {
    name,
    isConfigured: true,
    generateChatResponse: async (request) => ({
      text: await handler(request.messages),
      model: request.model,
      provider: name,
    }),
    analyzeDocument: async (request) => ({
      text: await handler(request.messages),
      model: request.model,
      provider: name,
    }),
  };
}

describe('assistant domain', () => {
  it('injects the Odie persona before history and user messages', async () => {
    const captured: Array<Array<{ role: string; content: string }>> = [];
    const service = new AssistantService(
      baseConfig(),
      [
        createProvider('openrouter', async (messages) => {
          captured.push(messages);
          return 'Hi there';
        }),
      ],
      console,
    );

    const result = await service.chat({
      message: 'Hello Odie',
      history: [
        { role: 'user', content: 'Earlier question' },
        { role: 'assistant', content: 'Earlier answer' },
      ],
    });

    expect(result.text).toBe('Hi there');
    expect(captured).toHaveLength(1);
    expect(captured[0][0].role).toBe('system');
    expect(captured[0][0].content).toContain('You are Odie');
    expect(captured[0][1]).toEqual({ role: 'user', content: 'Earlier question' });
    expect(captured[0][2]).toEqual({ role: 'assistant', content: 'Earlier answer' });
    expect(captured[0][3]).toEqual({ role: 'user', content: 'Hello Odie' });
  });

  it('builds an OpenRouter-first provider chain with optional LM Studio fallback', () => {
    const openrouter = createProvider('openrouter', async () => 'o');
    const lmstudio = createProvider('lmstudio', async () => 'l');
    const plans = buildProviderPlan(baseConfig({ lmStudioBaseUrl: 'http://localhost:1234', lmStudioModel: 'local-model' }), [lmstudio, openrouter]);

    expect(plans.map((plan) => `${plan.provider.name}:${plan.model}`)).toEqual([
      'openrouter:google/gemma-4-31b-it:free',
      'lmstudio:local-model',
    ]);
  });

  it('chunks large documents and prefers chunks that match the question', () => {
    const text = [
      'Mathematics',
      '',
      'This section explains quadratic equations and factoring.',
      '',
      'History',
      '',
      'This section explains the causes of the First World War and diplomacy.',
      '',
      'Science',
      '',
      'This section explains photosynthesis and cell division in detail.',
    ].join('\n');

    const chunks = chunkDocumentText(text.repeat(8), 120, 20);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.text.length <= 120)).toBe(true);

    const selected = selectRelevantChunks(chunks, 'What does the document say about photosynthesis?', 3, 400);
    expect(selected.length).toBeGreaterThan(0);
    expect(selected.some((chunk) => chunk.text.toLowerCase().includes('photosynthesis'))).toBe(true);
  });

  it('falls back to the next provider after a transient primary failure', async () => {
    const failingOpenRouter = createProvider('openrouter', async () => {
      throw new AssistantError('openrouter_rate_limited', 'rate limited', { statusCode: 429, transient: true });
    });
    const workingLmStudio = createProvider('lmstudio', async () => 'Fallback answer');
    const service = new AssistantService(
      baseConfig({ lmStudioBaseUrl: 'http://localhost:1234', lmStudioModel: 'local-model' }),
      [failingOpenRouter, workingLmStudio],
      console,
    );

    const result = await service.chat({ message: 'Use the fallback path' });

    expect(result.text).toBe('Fallback answer');
    expect(result.metadata.provider).toBe('lmstudio');
    expect(result.metadata.fallbackUsed).toBe(true);
    expect(result.metadata.attempts).toBe(2);
  });
});
