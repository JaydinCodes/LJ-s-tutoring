module.exports = {
  ci: {
    collect: {
      staticDistDir: './dist',
      // CI also installs Playwright for browser journeys. Explicitly use the
      // system Chromium selected by each workflow, otherwise LHCI can prefer
      // Playwright's sandbox-restricted browser on Ubuntu runners.
      chromePath: process.env.CHROME_PATH,
      url: ['http://localhost:8080/'],
      numberOfRuns: 3,
      settings: {
        chromeFlags: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.75 }],
        // Pa11y is the blocking accessibility gate in QA; Lighthouse a11y is informational.
        'categories:accessibility': ['warn', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }],
      },
    },
  },
};
