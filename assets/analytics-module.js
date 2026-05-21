import '/assets/analytics.js';

const api = (typeof globalThis !== 'undefined' && globalThis.__PO_ANALYTICS_API__)
  || { track: async () => ({ ok: false, reason: 'no_runtime' }), correlationId: () => '', readConfig: () => ({ enabled: false }) };

export const track = api.track;
export const correlationId = api.correlationId;
export const readConfig = api.readConfig;
export default api;
