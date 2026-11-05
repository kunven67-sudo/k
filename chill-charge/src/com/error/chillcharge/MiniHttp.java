package com.error.chillcharge;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/** Tiny web server for the PC link (plain Java, no libraries). */
final class MiniHttp {
    interface Handler { Res handle(String method, String path, Map<String, String> q, Map<String, String> h, byte[] body) throws Exception; }

    static final class Res {
        int code = 200; String type = "text/plain; charset=utf-8"; InputStream in; byte[] data; long len = -1;
        Map<String, String> headers = new HashMap<>();
        static Res text(int code, String type, String s) { Res r = new Res(); r.code = code; r.type = type; r.data = s.getBytes(StandardCharsets.UTF_8); return r; }
    }

    private ServerSocket ss;
    private volatile boolean on;

    void start(int port, Handler h) throws Exception {
        ss = new ServerSocket(port);
        on = true;
        Thread t = new Thread(() -> {
            while (on) {
                try {
                    Socket s = ss.accept();
                    Thread w = new Thread(() -> serve(s, h));
                    w.setDaemon(true);
                    w.start();
                } catch (Exception e) { if (!on) break; }
            }
        }, "pc-link");
        t.setDaemon(true);
        t.start();
    }

    void stop() {
        on = false;
        try { if (ss != null) ss.close(); } catch (Exception ignored) { }
    }

    private static String line(InputStream in) throws Exception {
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        int c;
        while ((c = in.read()) != -1) {
            if (c == '\n') break;
            if (c != '\r') b.write(c);
            if (b.size() > 8192) throw new Exception("line too long");
        }
        if (c == -1 && b.size() == 0) return null;
        return b.toString("UTF-8");
    }

    private static void serve(Socket s, Handler h) {
        try (Socket sock = s) {
            sock.setSoTimeout(15000);
            InputStream in = sock.getInputStream();
            OutputStream out = sock.getOutputStream();
            String first = line(in);
            if (first == null) return;
            String[] parts = first.split(" ");
            if (parts.length < 2) return;
            Map<String, String> hd = new HashMap<>();
            String l;
            while ((l = line(in)) != null && !l.isEmpty()) {
                int i = l.indexOf(':');
                if (i > 0) hd.put(l.substring(0, i).trim().toLowerCase(), l.substring(i + 1).trim());
            }
            int n = 0;
            try { n = Integer.parseInt(hd.getOrDefault("content-length", "0")); } catch (Exception ignored) { }
            if (n > 1_000_000) n = 0;
            byte[] body = new byte[n];
            int got = 0;
            while (got < n) { int k = in.read(body, got, n - got); if (k < 0) break; got += k; }
            String target = parts[1], path = target, qs = "";
            int qi = target.indexOf('?');
            if (qi >= 0) { path = target.substring(0, qi); qs = target.substring(qi + 1); }
            Map<String, String> q = new HashMap<>();
            for (String kv : qs.split("&")) {
                if (kv.isEmpty()) continue;
                int e = kv.indexOf('=');
                q.put(URLDecoder.decode(e < 0 ? kv : kv.substring(0, e), "UTF-8"), e < 0 ? "" : URLDecoder.decode(kv.substring(e + 1), "UTF-8"));
            }
            Res r;
            try { r = h.handle(parts[0], path, q, hd, body); } catch (Exception e) { r = Res.text(500, "text/plain", "error"); }
            if (r == null) r = Res.text(404, "text/plain", "not found");
            long len = r.data != null ? r.data.length : r.len;
            StringBuilder sb = new StringBuilder("HTTP/1.1 ").append(r.code).append(r.code == 200 ? " OK" : r.code == 206 ? " Partial Content" : " X").append("\r\n");
            sb.append("Content-Type: ").append(r.type).append("\r\n");
            if (len >= 0) sb.append("Content-Length: ").append(len).append("\r\n");
            sb.append("Cache-Control: no-store\r\nConnection: close\r\n");
            for (Map.Entry<String, String> e : r.headers.entrySet()) sb.append(e.getKey()).append(": ").append(e.getValue()).append("\r\n");
            sb.append("\r\n");
            out.write(sb.toString().getBytes(StandardCharsets.UTF_8));
            if (!"HEAD".equals(parts[0])) {
                if (r.data != null) out.write(r.data);
                else if (r.in != null) {
                    byte[] buf = new byte[32768]; long left = len < 0 ? Long.MAX_VALUE : len; int k;
                    while (left > 0 && (k = r.in.read(buf, 0, (int) Math.min(buf.length, left))) > 0) { out.write(buf, 0, k); left -= k; }
                    r.in.close();
                }
            }
            out.flush();
        } catch (Exception ignored) { }
    }
}
