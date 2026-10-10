// Catmull-Clark subdivision for all-quad cages, the backbone of the body and garment meshes.
//
// A cage is { nv, D, data: Float32Array(nv*D), quads: Int32Array(nf*4), tags: Int32Array(nf) }.
// Every vertex carries D floats: xyz first, then any attributes (dense bone weights, UVs…). All
// channels use the same smooth stencils, so skin weights blend as smoothly as the surface.
// Boundary edges follow the crease rules (cubic B-spline boundary curve), which gives clean hems.
//
//   subdivide(cage)          -> next level cage (tags inherited from the parent face)
//   limitPositions(cage)     -> Float32Array of limit points (only the D channels you ask for)
//   fitCageToSurface(cage,S) -> moves cage verts so the limit surface interpolates S
//   triangulate(cage)        -> Uint32Array index buffer

/** Build edge topology: edge endpoints, adjacent faces, per-face edge ids. */
export function topology(cage) {
  const { nv, quads } = cage;
  const nf = quads.length >> 2;
  const map = new Map();
  const ev = [];
  const ef = [];
  const faceEdges = new Int32Array(nf * 4);
  for (let f = 0; f < nf; f++) {
    for (let i = 0; i < 4; i++) {
      const a = quads[f * 4 + i];
      const b = quads[f * 4 + ((i + 1) & 3)];
      const key = a < b ? a * nv + b : b * nv + a;
      let e = map.get(key);
      if (e === undefined) {
        e = ev.length >> 1;
        map.set(key, e);
        ev.push(a, b);
        ef.push(f, -1);
      } else {
        ef[e * 2 + 1] = f;
      }
      faceEdges[f * 4 + i] = e;
    }
  }
  return { ne: ev.length >> 1, ev: Int32Array.from(ev), ef: Int32Array.from(ef), faceEdges, nf };
}

/** One level of Catmull-Clark. */
export function subdivide(cage) {
  const { nv, D, data, quads, tags } = cage;
  const T = topology(cage);
  const { ne, ev, ef, faceEdges, nf } = T;
  const NV = nv + ne + nf;
  const out = new Float32Array(NV * D);
  const fOff = nv + ne;
  // Face points.
  for (let f = 0; f < nf; f++) {
    const o = (fOff + f) * D;
    for (let i = 0; i < 4; i++) {
      const v = quads[f * 4 + i] * D;
      for (let d = 0; d < D; d++) out[o + d] += data[v + d] * 0.25;
    }
  }
  // Edge points + per-vertex accumulators.
  const isBoundaryV = new Uint8Array(nv);
  const valence = new Int32Array(nv);
  const sumR = new Float32Array(nv * D); // sum of edge midpoints (interior)
  const sumF = new Float32Array(nv * D); // sum of adjacent face points
  const bsum = new Float32Array(nv * D); // sum of boundary neighbours
  for (let e = 0; e < ne; e++) {
    const a = ev[e * 2];
    const b = ev[e * 2 + 1];
    const f0 = ef[e * 2];
    const f1 = ef[e * 2 + 1];
    const o = (nv + e) * D;
    const A = a * D;
    const B = b * D;
    if (f1 < 0) {
      for (let d = 0; d < D; d++) out[o + d] = (data[A + d] + data[B + d]) * 0.5;
      isBoundaryV[a] = 1;
      isBoundaryV[b] = 1;
      for (let d = 0; d < D; d++) {
        bsum[A + d] += data[B + d];
        bsum[B + d] += data[A + d];
      }
    } else {
      const F0 = (fOff + f0) * D;
      const F1 = (fOff + f1) * D;
      for (let d = 0; d < D; d++) out[o + d] = (data[A + d] + data[B + d] + out[F0 + d] + out[F1 + d]) * 0.25;
    }
    valence[a]++;
    valence[b]++;
    for (let d = 0; d < D; d++) {
      const m = (data[A + d] + data[B + d]) * 0.5;
      sumR[A + d] += m;
      sumR[B + d] += m;
    }
  }
  const nFaces = new Int32Array(nv);
  for (let f = 0; f < nf; f++) {
    const F = (fOff + f) * D;
    for (let i = 0; i < 4; i++) {
      const v = quads[f * 4 + i];
      nFaces[v]++;
      const V = v * D;
      for (let d = 0; d < D; d++) sumF[V + d] += out[F + d];
    }
  }
  // Vertex points.
  for (let v = 0; v < nv; v++) {
    const V = v * D;
    if (isBoundaryV[v]) {
      for (let d = 0; d < D; d++) out[V + d] = (bsum[V + d] + 6 * data[V + d]) / 8;
    } else {
      const n = valence[v];
      const nfv = nFaces[v] || 1;
      for (let d = 0; d < D; d++) {
        out[V + d] = (sumF[V + d] / nfv + (2 * sumR[V + d]) / n + (n - 3) * data[V + d]) / n;
      }
    }
  }
  // New quads.
  const nq = new Int32Array(nf * 16);
  const ntags = new Int32Array(nf * 4);
  for (let f = 0; f < nf; f++) {
    const fp = fOff + f;
    for (let i = 0; i < 4; i++) {
      const v = quads[f * 4 + i];
      const eNext = nv + faceEdges[f * 4 + i];
      const ePrev = nv + faceEdges[f * 4 + ((i + 3) & 3)];
      const o = (f * 4 + i) * 4;
      nq[o] = v;
      nq[o + 1] = eNext;
      nq[o + 2] = fp;
      nq[o + 3] = ePrev;
      ntags[f * 4 + i] = tags ? tags[f] : 0;
    }
  }
  return { nv: NV, D, data: out, quads: nq, tags: ntags };
}

/**
 * Limit-surface positions of every vertex (Catmull-Clark limit stencils), for the first `dims`
 * channels. Interior: (n²v + 4Σe + Σf) / (n(n+5)); boundary: (b0 + 4v + b1) / 6.
 */
export function limitPositions(cage, dims = 3, T = topology(cage)) {
  const { nv, D, data, quads } = cage;
  const { ne, ev, ef } = T;
  const nf = quads.length >> 2;
  const acc = new Float64Array(nv * dims);
  const n = new Int32Array(nv);
  const bnd = new Uint8Array(nv);
  const bacc = new Float64Array(nv * dims);
  for (let e = 0; e < ne; e++) {
    if (ef[e * 2 + 1] >= 0) continue;
    const a = ev[e * 2];
    const b = ev[e * 2 + 1];
    bnd[a] = bnd[b] = 1;
    for (let d = 0; d < dims; d++) {
      bacc[a * dims + d] += data[b * D + d];
      bacc[b * dims + d] += data[a * D + d];
    }
  }
  for (let f = 0; f < nf; f++) {
    for (let i = 0; i < 4; i++) {
      const v = quads[f * 4 + i];
      const a = quads[f * 4 + ((i + 1) & 3)];
      const b = quads[f * 4 + ((i + 2) & 3)];
      const c = quads[f * 4 + ((i + 3) & 3)];
      n[v]++;
      for (let d = 0; d < dims; d++) acc[v * dims + d] += 2 * (data[a * D + d] + data[c * D + d]) + data[b * D + d];
    }
  }
  const out = new Float32Array(nv * dims);
  for (let v = 0; v < nv; v++) {
    if (bnd[v]) {
      for (let d = 0; d < dims; d++) out[v * dims + d] = (bacc[v * dims + d] + 4 * data[v * D + d]) / 6;
    } else {
      const k = n[v];
      for (let d = 0; d < dims; d++) out[v * dims + d] = (k * k * data[v * D + d] + acc[v * dims + d]) / (k * (k + 5));
    }
  }
  return out;
}

/** Iteratively move cage positions so the limit surface passes through the targets S (xyz). */
export function fitCageToSurface(cage, S, iters = 6, rate = 1) {
  const T = topology(cage);
  const { nv, D, data } = cage;
  for (let it = 0; it < iters; it++) {
    const L = limitPositions(cage, 3, T);
    for (let v = 0; v < nv; v++) {
      for (let d = 0; d < 3; d++) data[v * D + d] += rate * (S[v * 3 + d] - L[v * 3 + d]);
    }
  }
  return cage;
}

/** Replace positions with their limit points (smooth silhouette at low face counts). */
export function pushToLimit(cage) {
  const L = limitPositions(cage, 3);
  for (let v = 0; v < cage.nv; v++) for (let d = 0; d < 3; d++) cage.data[v * cage.D + d] = L[v * 3 + d];
  return cage;
}

/** Quads -> triangles (split along the shorter diagonal for nicer shading). */
export function triangulate(cage, keepFace = null) {
  const { quads, data, D } = cage;
  const nf = quads.length >> 2;
  const idx = [];
  const d2 = (a, b) => {
    const x = data[a * D] - data[b * D];
    const y = data[a * D + 1] - data[b * D + 1];
    const z = data[a * D + 2] - data[b * D + 2];
    return x * x + y * y + z * z;
  };
  for (let f = 0; f < nf; f++) {
    if (keepFace && !keepFace(f)) continue;
    const a = quads[f * 4];
    const b = quads[f * 4 + 1];
    const c = quads[f * 4 + 2];
    const d = quads[f * 4 + 3];
    if (d2(a, c) <= d2(b, d)) idx.push(a, b, c, a, c, d);
    else idx.push(a, b, d, b, c, d);
  }
  return idx;
}

/** Remove unreferenced vertices after face deletion; returns { cage, remap }. */
export function compact(cage, keepFace) {
  const { nv, D, data, quads, tags } = cage;
  const nf = quads.length >> 2;
  const remap = new Int32Array(nv).fill(-1);
  const q = [];
  const tg = [];
  let n = 0;
  for (let f = 0; f < nf; f++) {
    if (!keepFace(f)) continue;
    for (let i = 0; i < 4; i++) {
      const v = quads[f * 4 + i];
      if (remap[v] < 0) remap[v] = n++;
      q.push(remap[v]);
    }
    tg.push(tags[f]);
  }
  const out = new Float32Array(n * D);
  for (let v = 0; v < nv; v++) if (remap[v] >= 0) out.set(data.subarray(v * D, v * D + D), remap[v] * D);
  return { cage: { nv: n, D, data: out, quads: Int32Array.from(q), tags: Int32Array.from(tg) }, remap };
}

/**
 * Make face winding consistent across the mesh (flood fill over shared edges), then flip
 * everything if the enclosed signed volume is negative (normals must point outward).
 */
export function orientFaces(cage) {
  const { quads, data, D, nv } = cage;
  const nf = quads.length >> 2;
  const T = topology(cage);
  const done = new Uint8Array(nf);
  const flip = (f) => {
    const o = f * 4;
    const a = quads[o + 1];
    quads[o + 1] = quads[o + 3];
    quads[o + 3] = a;
  };
  // Directed-edge test: does face f traverse a->b?
  const has = (f, a, b) => {
    for (let i = 0; i < 4; i++) if (quads[f * 4 + i] === a && quads[f * 4 + ((i + 1) & 3)] === b) return true;
    return false;
  };
  for (let s = 0; s < nf; s++) {
    if (done[s]) continue;
    done[s] = 1;
    const stack = [s];
    while (stack.length) {
      const f = stack.pop();
      for (let i = 0; i < 4; i++) {
        const e = T.faceEdges[f * 4 + i];
        const g = T.ef[e * 2] === f ? T.ef[e * 2 + 1] : T.ef[e * 2];
        if (g < 0 || done[g]) continue;
        const a = T.ev[e * 2];
        const b = T.ev[e * 2 + 1];
        if (has(g, a, b) === has(f, a, b)) flip(g);
        done[g] = 1;
        stack.push(g);
      }
    }
  }
  let vol = 0;
  for (let f = 0; f < nf; f++) {
    const p = [0, 1, 2, 3].map((i) => quads[f * 4 + i] * D);
    for (const [i, j, k] of [[0, 1, 2], [0, 2, 3]]) {
      const A = p[i];
      const B = p[j];
      const C = p[k];
      vol += data[A] * (data[B + 1] * data[C + 2] - data[B + 2] * data[C + 1])
        - data[A + 1] * (data[B] * data[C + 2] - data[B + 2] * data[C])
        + data[A + 2] * (data[B] * data[C + 1] - data[B + 1] * data[C]);
    }
  }
  if (vol < 0) for (let f = 0; f < nf; f++) flip(f);
  void nv;
  return cage;
}
