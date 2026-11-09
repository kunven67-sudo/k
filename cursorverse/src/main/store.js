// Tiny JSON file store with atomic, debounced writes.
const fs = require('fs');
const path = require('path');

class JsonFile {
  constructor(file, fallback) {
    this.file = file;
    this.timer = null;
    this.data = fallback;
    try {
      const raw = fs.readFileSync(file, 'utf8');
      this.data = JSON.parse(raw);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        // corrupt file: keep a copy so nothing is silently lost, then start fresh
        try { fs.copyFileSync(file, `${file}.broken-${Date.now()}`); } catch { /* ignore */ }
      }
    }
  }

  save(data) {
    this.data = data;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 250);
  }

  flush() {
    clearTimeout(this.timer);
    this.timer = null;
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 1));
      fs.renameSync(tmp, this.file);
    } catch (err) {
      console.error('[store] could not save', this.file, err);
    }
  }
}

module.exports = { JsonFile };
