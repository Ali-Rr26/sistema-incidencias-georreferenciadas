import { afterEach, beforeEach, vi } from 'vitest';

class MockBootstrapWidget {
  constructor(element, options = {}) {
    this.element = element;
    this.options = options;
  }

  dispose() {}
  show() {}
  hide() {}
}

MockBootstrapWidget.getInstance = vi.fn(() => null);

const bootstrapMocks = {
  Toast: class Toast extends MockBootstrapWidget {},
  Modal: class Modal extends MockBootstrapWidget {},
  Tooltip: class Tooltip extends MockBootstrapWidget {},
  Popover: class Popover extends MockBootstrapWidget {},
};

if (!globalThis.bootstrap) {
  globalThis.bootstrap = bootstrapMocks;
} else {
  Object.assign(globalThis.bootstrap, bootstrapMocks);
}

beforeEach(() => {
  document.body.innerHTML = '';
  document.head
    .querySelectorAll('style[id^="style-"]')
    .forEach((style) => style.remove());
  window.location.hash = '';
});

afterEach(() => {
  vi.restoreAllMocks();
});
