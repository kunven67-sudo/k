// Ad + tracker blocking for the built-in browser (Ghostery's engine, the same
// filter lists uBlock uses). Lists are downloaded once and cached on disk.
const fs = require('fs');
const path = require('path');

class AdBlock {
  constructor(session, cacheDir) {
    this.session = session;
    this.cacheFile = path.join(cacheDir, 'adblock-engine.bin');
    this.blocker = null;
    this.enabled = false;
    this.loading = null;
    this.blocked = 0;
    this.error = null;
    this.onCount = null;
  }

  async load() {
    if (this.blocker) return this.blocker;
    if (!this.loading) {
      this.loading = (async () => {
        const { ElectronBlocker } = require('@ghostery/adblocker-electron');
        try {
          this.blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking(fetch, {
            path: this.cacheFile,
            read: fs.promises.readFile,
            write: fs.promises.writeFile,
          });
        } catch (err) {
          // no internet on first run: fall back to a small built-in list
          this.error = err.message;
          this.blocker = ElectronBlocker.parse(FALLBACK_FILTERS);
        }
        this.blocker.on('request-blocked', () => {
          this.blocked++;
          this.onCount?.(this.blocked);
        });
        return this.blocker;
      })();
    }
    return this.loading;
  }

  async setEnabled(on) {
    if (on === this.enabled) return;
    this.enabled = on;
    try {
      const b = await this.load();
      if (this.enabled !== on) return; // toggled again while loading
      if (on) b.enableBlockingInSession(this.session);
      else b.disableBlockingInSession(this.session);
    } catch (err) {
      this.error = err.message;
      console.error('[adblock]', err);
    }
  }
}

const FALLBACK_FILTERS = [
  '||doubleclick.net^', '||googlesyndication.com^', '||googleadservices.com^', '||adservice.google.com^',
  '||google-analytics.com^', '||googletagmanager.com^', '||adnxs.com^', '||taboola.com^', '||outbrain.com^',
  '||criteo.com^', '||criteo.net^', '||amazon-adsystem.com^', '||ads.yahoo.com^', '||advertising.com^',
  '||scorecardresearch.com^', '||quantserve.com^', '||moatads.com^', '||pubmatic.com^', '||rubiconproject.com^',
  '||openx.net^', '||casalemedia.com^', '||adsrvr.org^', '||smartadserver.com^', '||popads.net^', '||propellerads.com^',
  '||hotjar.com^', '||facebook.net/tr^', '||ads-twitter.com^',
].join('\n');

module.exports = { AdBlock };
