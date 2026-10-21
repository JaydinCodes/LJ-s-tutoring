const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'src', 'features', 'students', 'OdieCareerDialog.tsx'),
  'utf8',
);
const markdownSource = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'src', 'features', 'students', 'OdieMarkdown.tsx'),
  'utf8',
);
const viteConfig = fs.readFileSync(path.resolve(__dirname, '..', '..', 'vite.app.config.ts'), 'utf8');

test('Odie uses a responsive side panel with safe formatted responses', () => {
  assert.match(source, /h-\[100dvh\]/, 'the panel must fit the visible mobile viewport');
  assert.match(source, /justify-end/, 'desktop Odie must open from the side');
  assert.match(source, /createPortal/, 'the fixed panel must escape transformed dashboard ancestors');
  assert.match(source, /sm:max-w-\[40rem\]/, 'desktop Odie must leave pathway context visible');
  assert.match(source, /lazy\(\(\) => import\('\.\/OdieMarkdown'\)\)/, 'Markdown dependencies must load only when Odie opens');
  assert.match(markdownSource, /ReactMarkdown/, 'assistant responses must not expose raw Markdown syntax');
  assert.match(markdownSource, /remarkGfm/, 'tables and common Markdown must be supported');
  assert.match(markdownSource, /overflow-x-auto/, 'wide response tables must not overflow the panel');
  assert.match(viteConfig, /return 'markdown-renderer'/, 'the optional renderer must respect the route chunk budget');
  assert.match(viteConfig, /return 'markdown-syntax'/, 'the optional parser must respect the route chunk budget');
  assert.match(source, /data-modal-initial-focus/, 'the editable draft must receive initial focus');
  assert.match(source, /event\.nativeEvent\.isComposing/, 'Enter-to-send must not interrupt input method composition');
});

test('the configured Markdown stack renders learner-facing structure instead of raw syntax', async () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const [{ default: ReactMarkdown }, { default: remarkGfm }] = await Promise.all([
    import('react-markdown'),
    import('remark-gfm'),
  ]);
  const markdown = [
    '## A typical day',
    '',
    'Here is **what matters most**:',
    '',
    '| Time | Activity |',
    '| --- | --- |',
    '| Morning | Plan lessons |',
    '',
    '[Unsafe](javascript:alert(1))',
    '',
    '<script>alert(1)</script>',
  ].join('\n');
  const html = renderToStaticMarkup(React.createElement(ReactMarkdown, { remarkPlugins: [remarkGfm] }, markdown));

  assert.match(html, /<h2>A typical day<\/h2>/);
  assert.match(html, /<strong>what matters most<\/strong>/);
  assert.match(html, /<table>/);
  assert.doesNotMatch(html, /\*\*what matters most\*\*/);
  assert.doesNotMatch(html, /href="javascript:/);
  assert.doesNotMatch(html, /<script>/);
});
