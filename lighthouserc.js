module.exports = {
  ci: {
    collect: {
      staticDistDir: './dist',
      // Workflows install Playwright's Chromium directly rather than Ubuntu's
      // Snap-backed chromium-browser package. The no-sandbox flags below make
      // that browser usable by Lighthouse on hosted CI runners.
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
