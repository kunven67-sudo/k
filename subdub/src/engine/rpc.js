// Tiny promise RPC between the page and a worker. Events (progress etc.) go through `on`.
export class WorkerRPC {
  constructor(worker) {
    this.w = worker; this.id = 0; this.pending = new Map(); this.handlers = new Map();
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.event) { for (const cb of this.handlers.get(m.event) || []) cb(m.data); return; }
      const p = this.pending.get(m.id); if (!p) return;
      this.pending.delete(m.id);
      m.error ? p.rej(Object.assign(new Error(m.error), { stack: m.stack })) : p.res(m.result);
    };
    worker.onerror = (e) => { const err = new Error('Worker crashed: ' + (e.message || 'unknown')); for (const p of this.pending.values()) p.rej(err); this.pending.clear(); for (const cb of this.handlers.get('crash') || []) cb(err); };
  }
  call(method, args = {}, transfer = []) {
    const id = ++this.id;
    return new Promise((res, rej) => { this.pending.set(id, { res, rej }); this.w.postMessage({ id, method, args }, transfer); });
  }
  on(event, cb) { if (!this.handlers.has(event)) this.handlers.set(event, []); this.handlers.get(event).push(cb); return this; }
  terminate() { this.w.terminate(); }
}

// Worker side: serve(handlers). A handler may return {result, transfer}. Calls run one at a time (models share one GPU/CPU).
export function serve(handlers) {
  const emit = (event, data, transfer = []) => self.postMessage({ event, data }, transfer);
  let chain = Promise.resolve();
  self.onmessage = (e) => {
    const { id, method, args } = e.data;
    chain = chain.then(async () => {
      try {
        const fn = handlers[method];
        if (!fn) throw new Error('No such method: ' + method);
        const out = await fn(args, emit);
        if (out && out.__transfer) self.postMessage({ id, result: out.result }, out.__transfer);
        else self.postMessage({ id, result: out });
      } catch (err) {
        self.postMessage({ id, error: String(err?.message || err), stack: err?.stack });
      }
    });
  };
  return emit;
}
export const withTransfer = (result, transfer) => ({ __transfer: transfer, result });
