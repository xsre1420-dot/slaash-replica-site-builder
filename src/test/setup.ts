import '@testing-library/jest-dom/vitest';

/** Supabase Realtime expects WebSocket — polyfill for happy-dom / Node test runs */
if (typeof globalThis.WebSocket === 'undefined') {
  class MockWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    readonly CONNECTING = 0;
    readonly OPEN = 1;
    readonly CLOSING = 2;
    readonly CLOSED = 3;
    readyState = 1;
    url: string;
    protocol = '';
    constructor(url: string) {
      this.url = url;
    }
    close() {}
    send() {}
    addEventListener() {}
    removeEventListener() {}
    dispatchEvent() {
      return true;
    }
  }
  globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
}

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});
