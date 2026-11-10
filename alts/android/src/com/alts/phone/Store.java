package com.alts.phone;

/* ALTS for phone: the plain logic (accounts list, sticker list, saved-chat list, reading what
   imgflip and GIPHY answer). No Android in here, so it runs and gets tested on a normal computer
   too (test/StoreTest.java). Android glue lives in MainActivity/Stickers. */
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

public class Store {

    // ---------------------------------------------------------------- files

    public static String read(File f) {
        try {
            byte[] b = new byte[(int) Math.min(f.length(), 64 << 20)];
            java.io.FileInputStream in = new java.io.FileInputStream(f);
            int off = 0, n;
            while (off < b.length && (n = in.read(b, off, b.length - off)) > 0) off += n;
            in.close();
            return new String(b, 0, off, StandardCharsets.UTF_8);
        } catch (Exception e) {
            return "";
        }
    }

    /** Writes the whole file, or nothing (never a half file): temp + rename. */
    public static boolean write(File f, String text) {
        try {
            File dir = f.getParentFile();
            if (dir != null) dir.mkdirs();
            File tmp = new File(f.getPath() + ".tmp");
            FileOutputStream o = new FileOutputStream(tmp);
            o.write(text.getBytes(StandardCharsets.UTF_8));
            o.getFD().sync();
            o.close();
            if (!tmp.renameTo(f)) {
                f.delete();
                return tmp.renameTo(f);
            }
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    public static byte[] readAll(InputStream in, int max) throws Exception {
        java.io.ByteArrayOutputStream b = new java.io.ByteArrayOutputStream();
        byte[] buf = new byte[16384];
        int n;
        while ((n = in.read(buf)) > 0) {
            b.write(buf, 0, n);
            if (b.size() > max) throw new Exception("too big");
        }
        return b.toByteArray();
    }

    /** A safe file name: letters/digits/dash only (ids from the internet go into file names). */
    public static String safeId(String s) {
        StringBuilder b = new StringBuilder();
        for (char c : s.toCharArray()) {
            if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '-' || c == '_') b.append(c);
        }
        String out = b.toString();
        return out.isEmpty() || out.length() > 40 ? ("x" + Math.abs(s.hashCode())) : out;
    }

    public static String safeName(String s) {
        String out = s == null ? "" : s.replaceAll("[\\\\/:*?\"<>|\\x00-\\x1f]+", " ").trim();
        if (out.length() > 80) out = out.substring(0, 80).trim();
        return out.isEmpty() ? "Chat" : out;
    }

    // ---------------------------------------------------------------- accounts

    public static final String[] COLORS = {"#d97757", "#4f9df5", "#3dbe8b", "#b58cf5", "#f5c04f", "#ef5b8b", "#22D3EE", "#9aa4bf"};

    public static JSONObject newAccounts() {
        JSONObject o = new JSONObject();
        JSONArray list = new JSONArray();
        list.put(account("default", "Main", COLORS[0]));
        put(o, "list", list);
        put(o, "active", "default");
        return o;
    }

    public static JSONObject account(String id, String name, String color) {
        JSONObject a = new JSONObject();
        put(a, "id", id);
        put(a, "name", name);
        put(a, "color", color);
        return a;
    }

    public static JSONObject parseAccounts(String json) {
        try {
            JSONObject o = new JSONObject(json);
            if (o.optJSONArray("list") == null || o.optJSONArray("list").length() == 0) return newAccounts();
            if (find(o, o.optString("active")) == null) put(o, "active", o.optJSONArray("list").optJSONObject(0).optString("id"));
            return o;
        } catch (Exception e) {
            return newAccounts();
        }
    }

    public static JSONObject find(JSONObject accounts, String id) {
        JSONArray l = accounts.optJSONArray("list");
        for (int i = 0; i < l.length(); i++) {
            JSONObject a = l.optJSONObject(i);
            if (a != null && a.optString("id").equals(id)) return a;
        }
        return null;
    }

    /** Adds an account with an unused color; returns its id. */
    public static String addAccount(JSONObject accounts, String name) {
        JSONArray l = accounts.optJSONArray("list");
        // Each id names a login folder: never reuse one, even for two added in the same millisecond.
        String base = "a" + Long.toString(System.currentTimeMillis(), 36), id = base;
        for (int n = 2; find(accounts, id) != null; n++) id = base + "-" + n;
        String color = COLORS[l.length() % COLORS.length];
        for (String c : COLORS) {
            boolean used = false;
            for (int i = 0; i < l.length(); i++) used |= c.equals(l.optJSONObject(i).optString("color"));
            if (!used) { color = c; break; }
        }
        String nm = safeName(name);
        if (nm.equals("Chat")) nm = "Account " + (l.length() + 1);
        l.put(account(id, nm, color));
        put(accounts, "active", id);
        return id;
    }

    public static boolean removeAccount(JSONObject accounts, String id) {
        JSONArray l = accounts.optJSONArray("list");
        if (l.length() <= 1 || "default".equals(id)) return false; // the first login stays
        JSONArray out = new JSONArray();
        boolean hit = false;
        for (int i = 0; i < l.length(); i++) {
            JSONObject a = l.optJSONObject(i);
            if (a.optString("id").equals(id)) { hit = true; continue; }
            out.put(a);
        }
        if (!hit) return false;
        put(accounts, "list", out);
        if (accounts.optString("active").equals(id)) put(accounts, "active", out.optJSONObject(0).optString("id"));
        return true;
    }

    // ---------------------------------------------------------------- stickers

    /** stickers.json: {updated: ms, list: [{id, name, kind: meme|mine|giphy, file, fav, at}]} */
    public static JSONObject parseStickers(String json) {
        try {
            JSONObject o = new JSONObject(json);
            if (o.optJSONArray("list") == null) throw new Exception("no list");
            return o;
        } catch (Exception e) {
            JSONObject o = new JSONObject();
            put(o, "updated", 0L);
            put(o, "list", new JSONArray());
            return o;
        }
    }

    public static JSONObject stickerFind(JSONObject idx, String id) {
        JSONArray l = idx.optJSONArray("list");
        for (int i = 0; i < l.length(); i++) {
            JSONObject s = l.optJSONObject(i);
            if (s != null && s.optString("id").equals(id)) return s;
        }
        return null;
    }

    public static JSONObject stickerAdd(JSONObject idx, String id, String name, String kind, String file) {
        JSONObject s = stickerFind(idx, id);
        if (s == null) {
            s = new JSONObject();
            put(s, "id", id);
            put(s, "fav", false);
            put(s, "at", System.currentTimeMillis());
            idx.optJSONArray("list").put(s);
        }
        put(s, "name", name);
        put(s, "kind", kind);
        put(s, "file", file);
        return s;
    }

    public static boolean memesStale(JSONObject idx) {
        long updated = idx.optLong("updated", 0);
        boolean any = false;
        JSONArray l = idx.optJSONArray("list");
        for (int i = 0; i < l.length(); i++) any |= "meme".equals(l.optJSONObject(i).optString("kind"));
        return !any || System.currentTimeMillis() - updated > 72L * 3600 * 1000;
    }

    public static class Meme {
        public final String id, name, url;
        public Meme(String id, String name, String url) { this.id = id; this.name = name; this.url = url; }
    }

    /** Reads imgflip's get_memes answer (the 100 most popular meme pictures). */
    public static List<Meme> parseImgflip(String json) {
        List<Meme> out = new ArrayList<>();
        try {
            JSONArray memes = new JSONObject(json).getJSONObject("data").getJSONArray("memes");
            for (int i = 0; i < memes.length(); i++) {
                JSONObject m = memes.optJSONObject(i);
                if (m == null) continue;
                String id = safeId(m.optString("id"));
                String url = m.optString("url");
                String name = m.optString("name").trim();
                if (id.isEmpty() || !url.startsWith("https://") || name.isEmpty()) continue;
                out.add(new Meme("meme-" + id, name, url));
            }
        } catch (Exception e) { /* a bad answer adds nothing */ }
        return out;
    }

    public static class Giphy {
        public final String id, name, thumbUrl, sendUrl;
        public Giphy(String id, String name, String thumbUrl, String sendUrl) { this.id = id; this.name = name; this.thumbUrl = thumbUrl; this.sendUrl = sendUrl; }
    }

    /** Reads GIPHY's search answer: a small still picture to show, a reasonable gif to send. */
    public static List<Giphy> parseGiphy(String json) {
        List<Giphy> out = new ArrayList<>();
        try {
            JSONArray data = new JSONObject(json).getJSONArray("data");
            for (int i = 0; i < data.length(); i++) {
                JSONObject g = data.optJSONObject(i);
                if (g == null) continue;
                JSONObject imgs = g.optJSONObject("images");
                if (imgs == null) continue;
                String thumb = pickUrl(imgs, "fixed_width_still", "480w_still", "fixed_width");
                String send = pickUrl(imgs, "downsized", "fixed_width", "original");
                String id = safeId(g.optString("id"));
                if (thumb.isEmpty() || send.isEmpty() || id.isEmpty()) continue;
                String name = g.optString("title", "sticker").replaceAll("\\s*(GIF|Sticker)\\s*(by.*)?$", "").trim();
                if (name.isEmpty()) name = "sticker";
                out.add(new Giphy("giphy-" + id, name, thumb, send));
            }
        } catch (Exception e) { /* nothing */ }
        return out;
    }

    private static String pickUrl(JSONObject imgs, String... keys) {
        for (String k : keys) {
            JSONObject o = imgs.optJSONObject(k);
            String u = o == null ? "" : o.optString("url");
            if (u.startsWith("https://")) return u;
        }
        return "";
    }

    // ---------------------------------------------------------------- saved chats

    /** chats.json: {list: [{id, account, title, url, words, at, file, md}]} newest first. */
    public static JSONObject parseChats(String json) {
        try {
            JSONObject o = new JSONObject(json);
            if (o.optJSONArray("list") == null) throw new Exception("no list");
            return o;
        } catch (Exception e) {
            JSONObject o = new JSONObject();
            put(o, "list", new JSONArray());
            return o;
        }
    }

    /** The same chat saved again replaces its entry (same account + chat link). */
    public static JSONObject chatAdd(JSONObject idx, String account, String title, String url, int words) {
        JSONArray l = idx.optJSONArray("list");
        String key = url == null ? "" : url.split("[?#]")[0];
        JSONObject c = null;
        for (int i = 0; i < l.length(); i++) {
            JSONObject x = l.optJSONObject(i);
            if (x.optString("account").equals(account) && x.optString("url").split("[?#]")[0].equals(key) && !key.isEmpty()) c = x;
        }
        if (c == null) {
            c = new JSONObject();
            put(c, "id", "c" + Long.toString(System.currentTimeMillis(), 36) + l.length());
            put(c, "account", account);
            l.put(c);
        }
        put(c, "title", safeName(title));
        put(c, "url", url == null ? "" : url);
        put(c, "words", words);
        put(c, "at", System.currentTimeMillis());
        put(c, "file", c.optString("id") + ".html");
        put(c, "md", c.optString("id") + ".md");
        return c;
    }

    public static class Hit {
        public final JSONObject chat;
        public final String snippet;
        public Hit(JSONObject chat, String snippet) { this.chat = chat; this.snippet = snippet; }
    }

    /** Search saved chats: title first, then the words inside (reader reads each .md). */
    public static List<Hit> chatSearch(JSONObject idx, String q, java.util.function.Function<JSONObject, String> readMd) {
        List<Hit> out = new ArrayList<>();
        String needle = q == null ? "" : q.trim().toLowerCase(Locale.ROOT);
        JSONArray l = idx.optJSONArray("list");
        List<JSONObject> all = new ArrayList<>();
        for (int i = 0; i < l.length(); i++) all.add(l.optJSONObject(i));
        all.sort((a, b) -> Long.compare(b.optLong("at"), a.optLong("at")));
        for (JSONObject c : all) {
            if (needle.isEmpty()) { out.add(new Hit(c, "")); continue; }
            if (c.optString("title").toLowerCase(Locale.ROOT).contains(needle)) { out.add(new Hit(c, "")); continue; }
            String md = readMd == null ? "" : readMd.apply(c);
            if (md == null) md = "";
            int at = md.toLowerCase(Locale.ROOT).indexOf(needle);
            if (at < 0) continue;
            int from = Math.max(0, at - 40), to = Math.min(md.length(), at + needle.length() + 60);
            out.add(new Hit(c, md.substring(from, to).replaceAll("\\s+", " ").trim()));
        }
        return out;
    }

    // ---------------------------------------------------------------- little JSON helpers

    public static void put(JSONObject o, String k, Object v) {
        try { o.put(k, v); } catch (Exception e) { /* only throws on bad numbers */ }
    }

    public static String jsString(String s) {
        StringBuilder b = new StringBuilder("\"");
        for (char c : (s == null ? "" : s).toCharArray()) {
            if (c == '"' || c == '\\') b.append('\\').append(c);
            else if (c == '\n') b.append("\\n");
            else if (c == '\r') b.append("\\r");
            else if (c == '<') b.append("\\u003c");
            else if (c == ' ') b.append("\\u2028");
            else if (c == ' ') b.append("\\u2029");
            else if (c < ' ') b.append(String.format(Locale.ROOT, "\\u%04x", (int) c));
            else b.append(c);
        }
        return b.append('"').toString();
    }
}
