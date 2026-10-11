// Writes models/portal-gun.stl (millimetres) and models/portal-gun.glb (metres).
// Needs the npm 'three' package (0.160.x) resolvable from where you run it:
//   npm i three@0.160.0 && node portal-gun/tools/export-models.mjs
import * as THREE from 'three';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { buildPortalGun, exportCopy } from '../model.js';

// GLTFExporter reads Blobs through FileReader, which Node lacks.
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then((buf) => { this.result = buf; this.onloadend?.(); }); }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(buf).toString('base64')}`;
      this.onloadend?.();
    });
  }
};

const out = new URL('../models/', import.meta.url);
mkdirSync(out, { recursive: true });
const api = buildPortalGun(THREE);

const stl = new STLExporter().parse(exportCopy(THREE, api, 10), { binary: true });
writeFileSync(new URL('portal-gun.stl', out), new Uint8Array(stl.buffer));

const glb = await new GLTFExporter().parseAsync(exportCopy(THREE, api, 0.01), { binary: true });
writeFileSync(new URL('portal-gun.glb', out), new Uint8Array(glb));

const size = new THREE.Box3().setFromObject(exportCopy(THREE, api, 10)).getSize(new THREE.Vector3());
console.log(`STL ${(stl.byteLength / 1024).toFixed(0)} KB, GLB ${(glb.byteLength / 1024).toFixed(0)} KB, size ${size.x.toFixed(0)} x ${size.y.toFixed(0)} x ${size.z.toFixed(0)} mm`);
