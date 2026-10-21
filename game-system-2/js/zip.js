/* Game System 2.0 — tiny zip reader/writer.
   Uses the browser's built-in DecompressionStream / CompressionStream ('deflate-raw'),
   so no library is needed. Supports stored + deflated entries and ZIP64 when reading. */
(function (root) {
  'use strict';

  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(u8) {
    var crc = -1;
    for (var i = 0; i < u8.length; i++) crc = CRC_TABLE[(crc ^ u8[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ -1) >>> 0;
  }

  async function pipeBytes(u8, transform) {
    var stream = new Blob([u8]).stream().pipeThrough(transform);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  function inflateRaw(u8) { return pipeBytes(u8, new DecompressionStream('deflate-raw')); }
  function deflateRaw(u8) { return pipeBytes(u8, new CompressionStream('deflate-raw')); }

  var utf8Fatal = new TextDecoder('utf-8', { fatal: true });
  var latin = new TextDecoder('windows-1252');

  function decodeName(bytes, isUtf8) {
    var name;
    if (isUtf8) {
      name = new TextDecoder('utf-8').decode(bytes);
    } else {
      try { name = utf8Fatal.decode(bytes); } catch (e) { name = latin.decode(bytes); }
    }
    return cleanPath(name);
  }

  /* Normalise a path inside an archive: forward slashes, no leading slash, no . or .. parts. */
  function cleanPath(p) {
    var parts = String(p).replace(/\\/g, '/').split('/');
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      var s = parts[i];
      if (s === '' || s === '.') continue;
      if (s === '..') { out.pop(); continue; }
      out.push(s);
    }
    var res = out.join('/');
    if (/[\\/]$/.test(p) && res) res += '/';
    return res;
  }

  var JUNK = /(^|\/)(__MACOSX\/|\.DS_Store$|Thumbs\.db$|desktop\.ini$)/i;

  /* Read a zip Blob. Returns [{path, blob, size}] for every file (folders skipped). */
  async function readZip(blob, onProgress) {
    var buf = new Uint8Array(await blob.arrayBuffer());
    var dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    if (buf.length < 22) throw new Error('This is not a zip file (it is too small).');

    var eocd = -1;
    var stop = Math.max(0, buf.length - 22 - 65535);
    for (var i = buf.length - 22; i >= stop; i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('This is not a zip file, or it is damaged.');

    var count = dv.getUint16(eocd + 10, true);
    var cdOffset = dv.getUint32(eocd + 16, true);

    if (cdOffset === 0xFFFFFFFF || count === 0xFFFF) {
      var loc = eocd - 20;
      if (loc >= 0 && dv.getUint32(loc, true) === 0x07064b50) {
        var z64 = Number(dv.getBigUint64(loc + 8, true));
        if (dv.getUint32(z64, true) === 0x06064b50) {
          count = Number(dv.getBigUint64(z64 + 32, true));
          cdOffset = Number(dv.getBigUint64(z64 + 48, true));
        }
      }
    }

    var entries = [];
    var p = cdOffset;
    for (var n = 0; n < count; n++) {
      if (p + 46 > buf.length || dv.getUint32(p, true) !== 0x02014b50) {
        throw new Error('This zip file is damaged (its file list is broken).');
      }
      var flags = dv.getUint16(p + 8, true);
      var method = dv.getUint16(p + 10, true);
      var crc = dv.getUint32(p + 16, true);
      var compSize = dv.getUint32(p + 20, true);
      var size = dv.getUint32(p + 24, true);
      var nameLen = dv.getUint16(p + 28, true);
      var extraLen = dv.getUint16(p + 30, true);
      var commentLen = dv.getUint16(p + 32, true);
      var localOff = dv.getUint32(p + 42, true);
      var name = decodeName(buf.subarray(p + 46, p + 46 + nameLen), flags & 0x800);

      if (compSize === 0xFFFFFFFF || size === 0xFFFFFFFF || localOff === 0xFFFFFFFF) {
        var e = p + 46 + nameLen;
        var end = e + extraLen;
        while (e + 4 <= end) {
          var id = dv.getUint16(e, true);
          var len = dv.getUint16(e + 2, true);
          if (id === 1) {
            var q = e + 4;
            if (size === 0xFFFFFFFF) { size = Number(dv.getBigUint64(q, true)); q += 8; }
            if (compSize === 0xFFFFFFFF) { compSize = Number(dv.getBigUint64(q, true)); q += 8; }
            if (localOff === 0xFFFFFFFF) { localOff = Number(dv.getBigUint64(q, true)); }
            break;
          }
          e += 4 + len;
        }
      }
      p += 46 + nameLen + extraLen + commentLen;
      if (!name || name.endsWith('/') || JUNK.test(name)) continue;
      entries.push({ name: name, flags: flags, method: method, crc: crc, compSize: compSize, size: size, localOff: localOff });
    }

    var out = [];
    for (var j = 0; j < entries.length; j++) {
      var en = entries[j];
      if (en.flags & 1) throw new Error('"' + en.name + '" is password-protected. Unzip it on your PC first, then add the folder.');
      var lo = en.localOff;
      if (dv.getUint32(lo, true) !== 0x04034b50) throw new Error('This zip file is damaged (bad entry for "' + en.name + '").');
      var start = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true);
      var raw = buf.subarray(start, start + en.compSize);
      var data;
      if (en.method === 0) data = raw;
      else if (en.method === 8) data = await inflateRaw(raw);
      else throw new Error('"' + en.name + '" uses a zip compression this browser can\'t open (method ' + en.method + '). Re-zip it with normal settings.');
      if (crc32(data) !== en.crc) throw new Error('"' + en.name + '" is damaged inside the zip (checksum mismatch).');
      out.push({ path: en.name, blob: new Blob([data]), size: data.length });
      if (onProgress) onProgress(j + 1, entries.length);
    }
    return out;
  }

  var NO_DEFLATE = /\.(png|jpe?g|gif|webp|avif|mp3|ogg|oga|m4a|aac|opus|mp4|webm|mov|woff2?|zip|gz|br|7z|rar|jpg)$/i;

  function dosDateTime(d) {
    var year = Math.max(1980, d.getFullYear());
    return {
      time: (d.getHours() << 11) | (d.getMinutes() << 5) | (Math.floor(d.getSeconds() / 2)),
      date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
    };
  }

  async function toBytes(x) {
    if (x instanceof Uint8Array) return x;
    if (typeof x === 'string') return new TextEncoder().encode(x);
    if (x instanceof ArrayBuffer) return new Uint8Array(x);
    return new Uint8Array(await x.arrayBuffer());
  }

  /* Build a zip. files: [{path, data: Blob|Uint8Array|string, date?}]. Returns a Blob. */
  async function makeZip(files, onProgress) {
    var parts = [];
    var central = [];
    var offset = 0;
    var enc = new TextEncoder();
    if (files.length > 0xFFFF) throw new Error('Too many files for one zip (' + files.length + ').');

    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      var nameBytes = enc.encode(cleanPath(f.path));
      var data = await toBytes(f.data);
      var crc = crc32(data);
      var method = 0;
      var comp = data;
      if (data.length > 64 && !NO_DEFLATE.test(f.path)) {
        var c = await deflateRaw(data);
        if (c.length < data.length) { method = 8; comp = c; }
      }
      if (offset + comp.length + 30 + nameBytes.length > 0xFFFFFFFF) {
        throw new Error('That is too much data for one zip file (over 4 GB).');
      }
      var dt = dosDateTime(f.date || new Date());
      var lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true);
      lh.setUint16(4, 20, true);
      lh.setUint16(6, 0x0800, true);
      lh.setUint16(8, method, true);
      lh.setUint16(10, dt.time, true);
      lh.setUint16(12, dt.date, true);
      lh.setUint32(14, crc, true);
      lh.setUint32(18, comp.length, true);
      lh.setUint32(22, data.length, true);
      lh.setUint16(26, nameBytes.length, true);
      lh.setUint16(28, 0, true);
      parts.push(lh.buffer, nameBytes, comp);
      central.push({ nameBytes: nameBytes, method: method, dt: dt, crc: crc, compSize: comp.length, size: data.length, offset: offset });
      offset += 30 + nameBytes.length + comp.length;
      if (onProgress) onProgress(i + 1, files.length);
    }

    var cdStart = offset;
    var cdSize = 0;
    for (var k = 0; k < central.length; k++) {
      var ce = central[k];
      var ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true);
      ch.setUint16(4, 20, true);
      ch.setUint16(6, 20, true);
      ch.setUint16(8, 0x0800, true);
      ch.setUint16(10, ce.method, true);
      ch.setUint16(12, ce.dt.time, true);
      ch.setUint16(14, ce.dt.date, true);
      ch.setUint32(16, ce.crc, true);
      ch.setUint32(20, ce.compSize, true);
      ch.setUint32(24, ce.size, true);
      ch.setUint16(28, ce.nameBytes.length, true);
      ch.setUint16(30, 0, true);
      ch.setUint16(32, 0, true);
      ch.setUint16(34, 0, true);
      ch.setUint16(36, 0, true);
      ch.setUint32(38, 0, true);
      ch.setUint32(42, ce.offset, true);
      parts.push(ch.buffer, ce.nameBytes);
      cdSize += 46 + ce.nameBytes.length;
    }

    var eocd = new DataView(new ArrayBuffer(22));
    eocd.setUint32(0, 0x06054b50, true);
    eocd.setUint16(4, 0, true);
    eocd.setUint16(6, 0, true);
    eocd.setUint16(8, central.length, true);
    eocd.setUint16(10, central.length, true);
    eocd.setUint32(12, cdSize, true);
    eocd.setUint32(16, cdStart, true);
    eocd.setUint16(20, 0, true);
    parts.push(eocd.buffer);
    return new Blob(parts, { type: 'application/zip' });
  }

  root.GS2Zip = { readZip: readZip, makeZip: makeZip, crc32: crc32, cleanPath: cleanPath, JUNK: JUNK };
})(typeof self !== 'undefined' ? self : this);
