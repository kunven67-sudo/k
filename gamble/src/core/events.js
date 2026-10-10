// Tiny synchronous event bus. Every system talks through `bus` instead of importing each other,
// so feature modules stay decoupled. Event names are namespaced strings, e.g. 'money:changed'.
// The canonical list of shared events lives in ARCHITECTURE.md.

export class EventBus {
  constructor() {
    this._handlers = new Map();
  }

  on(name, fn) {
    let set = this._handlers.get(name);
    if (!set) {
      set = new Set();
      this._handlers.set(name, set);
    }
    set.add(fn);
    return () => this.off(name, fn);
  }

  once(name, fn) {
    const off = this.on(name, (payload) => {
      off();
      fn(payload);
    });
    return off;
  }

  off(name, fn) {
    const set = this._handlers.get(name);
    if (set) set.delete(fn);
  }

  emit(name, payload) {
    const set = this._handlers.get(name);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        fn(payload);
      } catch (err) {
        console.error(`[bus] handler for "${name}" threw`, err);
      }
    }
  }
}

export const bus = new EventBus();
