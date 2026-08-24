(function () {
  'use strict';

  function containsHtmlTags(value) {
    return /<\/?[a-z][^>]*>/i.test(String(value || ''));
  }

  function stripHtmlTags(value) {
    // This is a plain-text display helper, never an HTML sanitizer. Build the
    // output from text spans so its result is not mistaken for safely-rendered
    // markup by callers or static analysis.
    const input = String(value || '');
    const text = [];
    let cursor = 0;
    for (const match of input.matchAll(/<\/?[a-z][^>]*>/gi)) {
      text.push(input.slice(cursor, match.index));
      cursor = (match.index || 0) + match[0].length;
    }
    text.push(input.slice(cursor));
    return text.join('').trim();
  }

  const api = { containsHtmlTags, stripHtmlTags };
  if (typeof window !== 'undefined') {
    window.PO_SANITIZE = api;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();
