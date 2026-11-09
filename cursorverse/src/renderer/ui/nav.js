// Lets pages switch pages without importing app.js (avoids an import cycle).
// refresh() redraws the current page and keeps the scroll position.
export const nav = { go: () => {}, refresh: () => {} };
