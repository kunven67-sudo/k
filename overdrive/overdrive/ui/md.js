"use strict";
/* OVERDRIVE answers (Piece 2): safe markdown -> HTML, split into numbered "pieces" you can copy.
   Safe: every bit of text is escaped FIRST, then only OVERDRIVE's own tags are added.
   A piece = one paragraph, one top-level list item (with its sub-items), one table, one code block or one quote.
   Headings and lines aren't pieces. Works in the window and in node (for the tests). No outside libraries. */
(function (root) {
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const COPY_ICON = `<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="9" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M3.5 10.5h-.4A1.6 1.6 0 0 1 1.5 8.9V3.1c0-.9.7-1.6 1.6-1.6h5.8c.9 0 1.6.7 1.6 1.6v.4" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>`;

  /* ---------------------------------------------------------------- inline */
  function inline(raw) {
    let s = esc(raw);
    const keep = [];
    const hold = (html) => { keep.push(html); return `\u0001${keep.length - 1}\u0002`; };
    s = s.replace(/`([^`\n]+)`/g, (m, c) => hold(`<code>${c}</code>`));
    s = s.replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, (m, t, u) => hold(`<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`));
    s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)\u0001]+[^\s<).,;:!?\u0001])/g, (m, pre, u) => pre + hold(`<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>`));
    s = s.replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>").replace(/__([^_\n]+)__/g, "<b>$1</b>");
    s = s.replace(/(^|[^*\w])\*([^*\s][^*\n]*?)\*(?![*\w])/g, "$1<i>$2</i>").replace(/(^|[^_\w])_([^_\s][^_\n]*?)_(?![_\w])/g, "$1<i>$2</i>");
    s = s.replace(/~~([^~\n]+)~~/g, "<s>$1</s>");
    return s.replace(/\u0001(\d+)\u0002/g, (m, i) => keep[Number(i)]);
  }

  /* what a piece copies: the words, without the markdown marks */
  function plain(raw) {
    return String(raw ?? "")
      .replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, "$1 ($2)")
      .replace(/`([^`\n]+)`/g, "$1").replace(/\*\*([^*\n]+)\*\*/g, "$1").replace(/__([^_\n]+)__/g, "$1")
      .replace(/(^|[^*\w])\*([^*\s][^*\n]*?)\*(?![*\w])/g, "$1$2").replace(/~~([^~\n]+)~~/g, "$1");
  }

  /* ---------------------------------------------------------------- blocks */
  const RE = {
    fence: /^\s{0,3}(```|~~~)\s*([\w+#.-]*)\s*$/,
    h: /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/,
    hr: /^\s{0,3}([-*_])(\s*\1){2,}\s*$/,
    li: /^(\s*)([-*+•]|\d{1,3}[.)])\s+(.*)$/,
    quote: /^\s{0,3}>\s?(.*)$/,
    tsep: /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/,
  };
  const cells = (line) => { let t = line.trim(); if (t.startsWith("|")) t = t.slice(1); if (t.endsWith("|") && !t.endsWith("\\|")) t = t.slice(0, -1); return t.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|")); };

  function parse(text) {
    const lines = String(text || "").replace(/\r\n?/g, "\n").split("\n");
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      let m;
      if (!line.trim()) { i++; continue; }
      if ((m = line.match(RE.fence))) {
        const fence = m[1], body = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith(fence)) body.push(lines[i++]);
        i++;                                                  // the closing fence (or the end while streaming)
        out.push({ type: "code", lang: m[2] || "", text: body.join("\n") });
        continue;
      }
      if ((m = line.match(RE.h))) { out.push({ type: "h", level: m[1].length, text: m[2] }); i++; continue; }
      if (RE.hr.test(line)) { out.push({ type: "hr" }); i++; continue; }
      if (line.includes("|") && i + 1 < lines.length && RE.tsep.test(lines[i + 1]) && lines[i + 1].includes("-")) {
        const head = cells(line);
        const align = cells(lines[i + 1]).map((c) => (c.startsWith(":") && c.endsWith(":") ? "center" : c.endsWith(":") ? "right" : ""));
        const rows = [];
        i += 2;
        while (i < lines.length && lines[i].includes("|") && lines[i].trim()) rows.push(cells(lines[i++]));
        out.push({ type: "table", head, align, rows });
        continue;
      }
      if (RE.quote.test(line)) {
        const body = [];
        while (i < lines.length && (m = lines[i].match(RE.quote))) { body.push(m[1]); i++; }
        out.push({ type: "quote", text: body.join("\n") });
        continue;
      }
      if ((m = line.match(RE.li))) {
        const ordered = /\d/.test(m[2]);
        const base = m[1].replace(/\t/g, "    ").length;
        const list = { type: "list", ordered, start: ordered ? parseInt(m[2], 10) : 1, items: [] };
        while (i < lines.length) {
          const l = lines[i];
          const lm = l.match(RE.li);
          if (lm) {
            const ind = lm[1].replace(/\t/g, "    ").length;
            const depth = Math.max(0, Math.min(3, Math.floor((ind - base) / 2)));
            if (depth === 0 && /\d/.test(lm[2]) !== ordered) break;         // a different kind of list starts
            let txt = lm[3], task = null;
            const tm = txt.match(/^\[([ xX])\]\s+(.*)$/);
            if (tm) { task = tm[1] !== " "; txt = tm[2]; }
            list.items.push({ depth, text: txt, task });
            i++;
          } else if (l.trim() && /^\s{2,}\S/.test(l) && list.items.length) {   // a wrapped line of the item above
            list.items[list.items.length - 1].text += "\n" + l.trim();
            i++;
          } else if (!l.trim() && i + 1 < lines.length && RE.li.test(lines[i + 1]) &&
                     (lines[i + 1].match(RE.li)[1].replace(/\t/g, "    ").length > base || /\d/.test(lines[i + 1].match(RE.li)[2]) === ordered)) {
            i++;                                                             // blank line between items: same list
          } else break;
        }
        out.push(list);
        continue;
      }
      const para = [];
      while (i < lines.length && lines[i].trim() && !RE.fence.test(lines[i]) && !RE.h.test(lines[i]) && !RE.quote.test(lines[i]) &&
             !(para.length === 0 ? false : RE.li.test(lines[i])) &&
             !(lines[i].includes("|") && i + 1 < lines.length && RE.tsep.test(lines[i + 1]) && lines[i + 1].includes("-"))) {
        if (para.length && RE.hr.test(lines[i])) break;
        para.push(lines[i++]);
      }
      if (!para.length) para.push(lines[i++]);                               // safety: always move on
      out.push({ type: "p", text: para.join("\n") });
    }
    return out;
  }

  /* ---------------------------------------------------------------- render */
  function render(text, opts) {
    const numbered = !!(opts && opts.pieces);
    const pieces = [];
    const btn = (n) => numbered ? `<button type="button" class="pc-copy" data-copy="${n}" title="Copy piece ${n}" aria-label="Copy piece ${n}"><span class="pc-n">${n}</span>${COPY_ICON}</button>` : "";
    const add = (type, copyText) => { pieces.push({ type, text: copyText }); return pieces.length; };
    const lineHtml = (t) => t.split("\n").map(inline).join("<br>");
    let html = "";
    for (const b of parse(text)) {
      if (b.type === "h") {
        const lv = Math.min(4, Math.max(2, b.level + 1));
        html += `<h${lv}>${inline(b.text)}</h${lv}>`;
      } else if (b.type === "hr") {
        html += "<hr>";
      } else if (b.type === "p") {
        const n = add("text", plain(b.text));
        html += `<p class="pc" data-pc="${n}">${btn(n)}${lineHtml(b.text)}</p>`;
      } else if (b.type === "quote") {
        const n = add("quote", plain(b.text));
        html += `<blockquote class="pc" data-pc="${n}">${btn(n)}${lineHtml(b.text)}</blockquote>`;
      } else if (b.type === "code") {
        const n = add("code", b.text);
        html += `<div class="pc code" data-pc="${n}">${btn(n)}<div class="code-head"><span>${esc(b.lang || "code")}</span></div><pre><code>${esc(b.text)}</code></pre></div>`;
      } else if (b.type === "table") {
        const n = add("table", [b.head, ...b.rows].map((r) => r.map(plain).join("\t")).join("\n"));
        const al = (k) => (b.align[k] ? ` style="text-align:${b.align[k]}"` : "");
        html += `<div class="pc tbl" data-pc="${n}">${btn(n)}<div class="tbl-scroll"><table><thead><tr>${b.head.map((c, k) => `<th${al(k)}>${inline(c)}</th>`).join("")}</tr></thead>` +
          `<tbody>${b.rows.map((r) => `<tr>${b.head.map((_, k) => `<td${al(k)}>${inline(r[k] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table></div></div>`;
      } else if (b.type === "list") {
        const tag = b.ordered ? "ol" : "ul";
        html += `<${tag}${b.ordered && b.start !== 1 ? ` start="${b.start}"` : ""}>`;
        let k = 0;
        while (k < b.items.length) {
          const top = b.items[k];
          const kids = [];
          k++;
          while (k < b.items.length && b.items[k].depth > 0) kids.push(b.items[k++]);
          const box = (it) => (it.task === null ? "" : `<span class="tick${it.task ? " on" : ""}">${it.task ? "&#10003;" : ""}</span>`);
          const copy = [plain(top.text)].concat(kids.map((c) => "  ".repeat(c.depth) + "- " + plain(c.text))).join("\n");
          const n = add("item", copy);
          const sub = kids.length ? `<ul class="sub">${kids.map((c) => `<li style="margin-left:${(c.depth - 1) * 18}px">${box(c)}${lineHtml(c.text)}</li>`).join("")}</ul>` : "";
          html += `<li class="pc" data-pc="${n}">${btn(n)}${box(top)}${lineHtml(top.text)}${sub}</li>`;
        }
        html += `</${tag}>`;
      }
    }
    return { html, pieces };
  }

  /* ---------------------------------------------------------------- "copy 1 and 2" */
  // Returns null when the message isn't ONLY a copy command (then it goes to OVERDRIVE as normal).
  function parseCopy(msg, pieces) {
    const m = String(msg || "").trim().match(/^copy\s+(.+?)[\s.!]*$/i);
    if (!m) return null;
    let rest = m[1].toLowerCase()
      .replace(/(\d+)\s*(?:-|–|to|through|thru)\s*(\d+)/g, "$1~$2")
      .replace(/\b(?:pieces?|lines?|blocks?|numbers?|parts?|nums?|no\.?|the|of|them|please|pls|bro)\b|#/g, " ");
    const toks = rest.split(/\s*(?:,|\band\b|&|\+|\bplus\b)\s*|\s+/).filter(Boolean);
    if (!toks.length) return null;
    const count = pieces.length;
    const want = [], missing = [];
    const push = (n) => { if (n >= 1 && n <= count) { if (!want.includes(n)) want.push(n); } else if (!missing.includes(n)) missing.push(n); };
    for (const t of toks) {
      if (/^\d+$/.test(t)) push(parseInt(t, 10));
      else if (/^\d+~\d+$/.test(t)) {
        let [a, b] = t.split("~").map(Number);
        if (a > b) [a, b] = [b, a];
        if (b - a > 200) return null;
        for (let n = a; n <= b; n++) push(n);
      } else if (/^(all|everything|it|whole|answer)$/.test(t)) { for (let n = 1; n <= count; n++) push(n); }
      else if (/^(code|codes)$/.test(t)) { pieces.forEach((p, i) => { if (p.type === "code") push(i + 1); }); if (!pieces.some((p) => p.type === "code")) missing.push("code"); }
      else if (/^(tables?)$/.test(t)) { pieces.forEach((p, i) => { if (p.type === "table") push(i + 1); }); if (!pieces.some((p) => p.type === "table")) missing.push("table"); }
      else if (/^(last)$/.test(t)) push(count);
      else if (/^(first)$/.test(t)) push(1);
      else return null;                                  // some other word: it's a real message, not a copy command
    }
    return { idx: want, missing, text: want.map((n) => pieces[n - 1].text).join("\n\n") };
  }

  const api = { render, parse, parseCopy, inline, plain, esc };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.OD_MD = api;
})(typeof window !== "undefined" ? window : globalThis);
