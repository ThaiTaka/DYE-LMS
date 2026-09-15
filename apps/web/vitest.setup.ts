import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom does not implement matchMedia, and the reduced-motion query is read by
// anything that animates. Without this the first render throws.
//
// Guarded on `window` existing: a file that opts into the Node environment
// (`// @vitest-environment node` — route handlers, whose `Request.formData()`
// does not work under jsdom) has no window at all.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  cleanup();
});
