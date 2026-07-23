import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const variablesPath = resolve(frontendRoot, 'public/css/variables.css');
const appPath = resolve(frontendRoot, 'public/css/app.css');
const responsivePath = resolve(
  frontendRoot,
  'public/css/mobile-responsive.css',
);
const dashboardPath = resolve(
  frontendRoot,
  'app/dashboard/pages/dashboard/dashboard.component.css',
);

let variablesCss;
let appCss;
let responsiveCss;
let dashboardCss;
let buildOutDir;

function withoutComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function customProperty(name) {
  const match = variablesCss.match(new RegExp(`--${name}:\\s*([^;]+);`));
  return match?.[1].trim();
}

beforeAll(() => {
  variablesCss = withoutComments(readFileSync(variablesPath, 'utf8'));
  appCss = withoutComments(readFileSync(appPath, 'utf8'));
  responsiveCss = withoutComments(readFileSync(responsivePath, 'utf8'));
  dashboardCss = withoutComments(readFileSync(dashboardPath, 'utf8'));
});

afterAll(() => {
  if (buildOutDir) rmSync(buildOutDir, { recursive: true, force: true });
});

describe('typography stylesheet contract', () => {
  it('maps all heading levels to centralized type tokens', () => {
    for (const heading of ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']) {
      expect(customProperty(`font-size-${heading}`)).toMatch(/rem|clamp\(/);
      expect(appCss).toMatch(
        new RegExp(
          `${heading}\\s*\\{[^}]*font-size:\\s*var\\(--font-size-${heading}\\)`,
        ),
      );
    }

    expect(customProperty('line-height-body')).toBe('1.5');
    expect(customProperty('line-height-heading')).toBe('1.2');
    expect(appCss).toMatch(
      /h1,\s*h2,\s*h3,\s*h4,\s*h5,\s*h6\s*\{[^}]*line-height:\s*var\(--line-height-heading\)/,
    );
  });

  it('keeps h5 and h6 below the removed 32px responsive rule', () => {
    expect(customProperty('font-size-h5')).not.toContain('32px');
    expect(customProperty('font-size-h6')).not.toContain('32px');
    expect(responsiveCss).not.toContain('clamp(18px, 5vw, 32px)');
    expect(responsiveCss).not.toMatch(/h[1-6][^{]*\{[^}]*font-size:/);
  });

  it('keeps shared page-title typography out of dashboard overrides', () => {
    expect(appCss).toMatch(
      /\.gr-page__title\s*\{[^}]*font-size:\s*var\(--font-size-page-title\)/,
    );
    expect(dashboardCss).not.toMatch(/\.gr-page__title\s*\{/);
    expect(dashboardCss).not.toMatch(/\.gr-breadcrumb\s*\{/);
  });

  it('copies the responsive stylesheet into a production build', () => {
    buildOutDir = mkdtempSync(resolve(tmpdir(), 'typography-build-'));

    execFileSync(
      process.execPath,
      [
        resolve(frontendRoot, 'node_modules/vite/bin/vite.js'),
        'build',
        '--outDir',
        buildOutDir,
        '--emptyOutDir',
      ],
      { cwd: frontendRoot, stdio: 'pipe' },
    );

    expect(existsSync(resolve(buildOutDir, 'css/mobile-responsive.css'))).toBe(
      true,
    );
    expect(readFileSync(resolve(buildOutDir, 'index.html'), 'utf8')).toContain(
      '/css/mobile-responsive.css',
    );
  }, 30000);
});
