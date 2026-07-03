/**
 * Feed component unit tests — single responsive template contract.
 *
 * The feed component renders a single #feed element with .feed-main and
 * .feed-aside children. It no longer probes #main-wrapper or toggles
 * #feed-desktop/#feed-mobile containers — viewport reflow is handled
 * by CSS grid + media query.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const feedModule = await import('./feed.component.js');
const feedComponent = feedModule.default;

function htmlResponse(body) {
  return {
    ok: true,
    status: 200,
    text: vi.fn().mockResolvedValue(body),
  };
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const feedHtmlPath = join(__dirname, 'feed.component.html');
const feedJsPath = join(__dirname, 'feed.component.js');
const feedHtml = readFileSync(feedHtmlPath, 'utf8');
const feedJs = readFileSync(feedJsPath, 'utf8');

describe('feed component — single responsive template', () => {
  let fetchMock;

  beforeEach(() => {
    vi.clearAllMocks();

    fetchMock = vi.fn(async (url) => {
      if (url.includes('/incidents/feed')) {
        return {
          ok: true,
          json: () =>
            Promise.resolve({
              data: [],
              meta: { current_page: 1, last_page: 1 },
            }),
        };
      }
      if (url.includes('feed.component.html')) {
        return htmlResponse('<div id="feed" class="feed"></div>');
      }
      return htmlResponse('');
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('component exports defineComponent contract', () => {
    expect(feedComponent).toHaveProperty('templateUrl');
    expect(feedComponent).toHaveProperty('styleUrl');
    expect(feedComponent).toHaveProperty('onInit');
    expect(feedComponent).toHaveProperty('onDestroy');
    expect(feedComponent.templateUrl).toBe('app/feed/feed.component.html');
    expect(feedComponent.styleUrl).toBe('app/feed/feed.component.css');
  });

  it('onInit handles missing DOM gracefully', async () => {
    document.body.innerHTML = '';

    await expect(feedComponent.onInit()).resolves.toBeUndefined();
    feedComponent.onDestroy();
  });

  it('template has exactly one #feed container (no dual desktop/mobile split)', () => {
    expect((feedHtml.match(/id="feed"/g) || []).length).toBe(1);
    expect(feedHtml).not.toMatch(/id="feed-desktop"/);
    expect(feedHtml).not.toMatch(/id="feed-mobile"/);
    expect(feedHtml).not.toMatch(/id="feed-list-mobile"/);
    expect(feedHtml).not.toMatch(/id="feed-sentinel-mobile"/);
    expect(feedHtml).not.toMatch(/id="feed-cargando-mobile"/);
    expect(feedHtml).not.toMatch(/id="feed-vacio-mobile"/);
  });

  it('template uses .feed-main + .feed-aside siblings under #feed', () => {
    expect(feedHtml).toMatch(/id="feed"[^>]*>\s*<div class="feed-main"/);
    expect(feedHtml).toMatch(/<aside class="feed-aside"/);
  });

  it('component does not probe #main-wrapper for context detection', () => {
    expect(feedJs).not.toMatch(/main-wrapper/);
    expect(feedJs).not.toMatch(/detectContext/);
    expect(feedJs).not.toMatch(/feed-list-mobile/);
    expect(feedJs).not.toMatch(/feed-sentinel-mobile/);
    expect(feedJs).not.toMatch(/feed-cargando-mobile/);
    expect(feedJs).not.toMatch(/feed-vacio-mobile/);
  });
});
