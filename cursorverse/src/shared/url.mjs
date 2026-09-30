// Turns what someone typed in the address bar into a URL: a web address, or a search.
export const ENGINES = {
  google: { name: 'Google', url: 'https://www.google.com/search?q=' },
  duckduckgo: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' },
  bing: { name: 'Bing', url: 'https://www.bing.com/search?q=' },
  brave: { name: 'Brave Search', url: 'https://search.brave.com/search?q=' },
};

const HOST = /^(localhost|[\w-]+(\.[\w-]+)+|\d{1,3}(\.\d{1,3}){3})(:\d{1,5})?([/?#].*)?$/i;

export function toUrl(input, engine = 'google') {
  const t = String(input ?? '').trim();
  if (!t) return null;
  const search = () => (ENGINES[engine] || ENGINES.google).url + encodeURIComponent(t);
  if (/^https?:\/\/\S+$/i.test(t)) return t;
  if (/\s/.test(t)) return search();
  if (HOST.test(t)) return `https://${t}`;
  // other schemes (file:, javascript:, chrome:) are never opened; search for them instead
  return search();
}
