// A tiny event bus: modules talk through named events instead of importing each other.
export class EventBus {
  constructor() {
    this.map = new Map();
  }

  on(type, fn) {
    let list = this.map.get(type);
    if (!list) this.map.set(type, (list = []));
    list.push(fn);
    return () => this.off(type, fn);
  }

  off(type, fn) {
    const list = this.map.get(type);
    if (!list) return;
    const i = list.indexOf(fn);
    if (i >= 0) list.splice(i, 1);
  }

  emit(type, payload) {
    const list = this.map.get(type);
    if (!list || !list.length) return;
    // copy so handlers can unsubscribe while we iterate
    for (const fn of list.slice()) {
      try {
        fn(payload);
      } catch (err) {
        console.error(`[bus] ${type} handler failed`, err);
      }
    }
  }
}
