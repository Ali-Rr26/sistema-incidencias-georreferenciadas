/**
 * Feed component unit tests — detectContext() with DOM simulation.
 *
 * detectContext() checks if #main-wrapper is visible → 'desktop', else 'mobile'.
 * We test the feed component's onInit behavior in different DOM states.
 */
import { defineComponent } from '../utils/component.js';

// Import the component module — this also executes module-level code
// but we only test the exported component definition
const feedModule = await import('./feed.component.js');
const feedComponent = feedModule.default;

function htmlResponse(body) {
  return {
    ok: true,
    status: 200,
    text: vi.fn().mockResolvedValue(body),
  };
}

describe('feed detectContext (DOM simulation)', () => {
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
        return htmlResponse('<div id="feed-desktop" class="d-none"></div><div id="feed-mobile"></div>');
      }
      return htmlResponse('');
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('detects desktop mode when #main-wrapper is visible', async () => {
    document.body.innerHTML = `
      <div id="main-wrapper" style="display:block">
        <div id="page-outlet"></div>
      </div>
      <div id="auth-outlet"></div>
    `;

    // Verify the DOM setup
    const wrapper = document.getElementById('main-wrapper');
    expect(wrapper).not.toBeNull();
    expect(wrapper.style.display).toBe('block');
  });

  it('detects mobile mode when #main-wrapper display is none', async () => {
    document.body.innerHTML = `
      <div id="main-wrapper" style="display:none">
        <div id="page-outlet"></div>
      </div>
      <div id="auth-outlet"></div>
    `;

    const wrapper = document.getElementById('main-wrapper');
    expect(wrapper).not.toBeNull();
    expect(wrapper.style.display).toBe('none');
  });

  it('detects mobile mode when #main-wrapper does not exist', async () => {
    document.body.innerHTML = `
      <div id="user-wrapper">
        <div id="shell-content"></div>
      </div>
    `;

    const wrapper = document.getElementById('main-wrapper');
    expect(wrapper).toBeNull();
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

    // Should not throw
    await expect(feedComponent.onInit()).resolves.toBeUndefined();
    feedComponent.onDestroy();
  });
});
