// Tiny event bus.
const map = new Map();
export const bus = {
  on(name, fn) {
    if (!map.has(name)) map.set(name, new Set());
    map.get(name).add(fn);
    return () => map.get(name)?.delete(fn);
  },
  emit(name, data) {
    const set = map.get(name);
    if (set) for (const fn of [...set]) fn(data);
  },
};
