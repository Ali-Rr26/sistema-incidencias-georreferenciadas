/**
 * Shared Leaflet lazy loader.
 *
 * Loads Leaflet CSS + JS from CDN on first call; subsequent calls return
 * a resolved promise. Used by feed-create, feed-detail, and the classic form.
 */
export default function loadLeaflet() {
  if (window.L) return Promise.resolve();

  if (!document.querySelector('link[href*="leaflet.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}
