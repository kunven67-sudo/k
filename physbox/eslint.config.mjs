// Lint: npx eslint js  (vendor code is ignored)
const browser = ['window', 'document', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame', 'localStorage', 'sessionStorage', 'indexedDB', 'location', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'console', 'navigator', 'getComputedStyle', 'Response', 'Request', 'fetch', 'Blob', 'File', 'FileReader', 'URL', 'Worker', 'self', 'postMessage', 'importScripts', 'CompressionStream', 'DecompressionStream', 'TextEncoder', 'TextDecoder', 'btoa', 'atob', 'Image', 'ImageData', 'OffscreenCanvas', 'createImageBitmap', 'AudioContext', 'OfflineAudioContext', 'AudioBuffer', 'MutationObserver', 'ResizeObserver', 'IntersectionObserver', 'KeyboardEvent', 'MouseEvent', 'PointerEvent', 'Event', 'CustomEvent', 'HTMLElement', 'HTMLCanvasElement', 'DOMParser', 'structuredClone', 'queueMicrotask', 'crypto', 'matchMedia', 'devicePixelRatio', 'alert', 'confirm', 'WebAssembly', 'Float32Array', 'process'];
export default [
  { ignores: ['js/vendor/**'] },
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: Object.fromEntries(browser.map((k) => [k, 'readonly'])) },
    rules: { 'no-undef': 'error', 'no-unused-vars': ['warn', { args: 'none' }], 'no-unreachable': 'error', 'no-dupe-keys': 'error', 'no-redeclare': 'error', 'no-const-assign': 'error', 'no-eval': 'error', 'no-new-func': 'error' },
  },
];
