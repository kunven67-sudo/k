package com.alts.phone;

/* ALTS for phone: the sticker box. Meme pictures (imgflip's 100 most popular: a pack baked into
   the app so they work with no internet, freshened every few days), your own pictures, and GIPHY
   search once a free key is set. Favorites float to the top. Lives in files/stickers/. */
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONArray;
import org.json.JSONObject;

public class Stickers {
    private final Context app;
    private final File dir, pics;
    private final Object lock = new Object();
    private JSONObject idx;
    private final AtomicBoolean refreshing = new AtomicBoolean(false);

    public Stickers(Context context) {
        app = context.getApplicationContext();
        dir = new File(app.getFilesDir(), "stickers");
        pics = new File(dir, "pics");
        pics.mkdirs();
        idx = Store.parseStickers(Store.read(new File(dir, "stickers.json")));
        if (idx.optJSONArray("list").length() == 0) unpackBuiltin();
    }

    private void save() {
        synchronized (lock) { Store.write(new File(dir, "stickers.json"), idx.toString()); }
    }

    /** The pack baked into the APK (assets/stickers/): works offline from the first start. */
    private void unpackBuiltin() {
        try {
            String listing = assetText("stickers/pack.json");
            if (listing.isEmpty()) return;
            JSONArray pack = new JSONArray(listing);
            synchronized (lock) {
                for (int i = 0; i < pack.length(); i++) {
                    JSONObject m = pack.optJSONObject(i);
                    String id = Store.safeId(m.optString("id")), name = m.optString("name"), file = m.optString("file");
                    File out = new File(pics, id + ext(file));
                    try (InputStream in = app.getAssets().open("stickers/" + file); FileOutputStream o = new FileOutputStream(out)) {
                        byte[] buf = new byte[16384];
                        int n;
                        while ((n = in.read(buf)) > 0) o.write(buf, 0, n);
                    }
                    thumb(out);
                    Store.stickerAdd(idx, id, name, "meme", out.getName());
                }
                Store.put(idx, "updated", 0L); // baked at build time: check for fresher ones soon
            }
            save();
        } catch (Exception e) { /* no pack inside this build: memes come with the first refresh */ }
    }

    private String assetText(String name) {
        try (InputStream in = app.getAssets().open(name)) {
            return new String(Store.readAll(in, 4 << 20), java.nio.charset.StandardCharsets.UTF_8);
        } catch (Exception e) {
            return "";
        }
    }

    private static String ext(String name) {
        String n = name.toLowerCase();
        return n.endsWith(".png") ? ".png" : n.endsWith(".gif") ? ".gif" : n.endsWith(".webp") ? ".webp" : ".jpg";
    }

    /** A small preview (144px JPEG) next to each picture, so the grid opens fast. */
    private void thumb(File pic) {
        try {
            BitmapFactory.Options probe = new BitmapFactory.Options();
            probe.inJustDecodeBounds = true;
            BitmapFactory.decodeFile(pic.getPath(), probe);
            int side = Math.max(probe.outWidth, probe.outHeight);
            BitmapFactory.Options o = new BitmapFactory.Options();
            o.inSampleSize = Math.max(1, Integer.highestOneBit(side / 144));
            Bitmap b = BitmapFactory.decodeFile(pic.getPath(), o);
            if (b == null) return;
            float scale = 144f / Math.max(b.getWidth(), b.getHeight());
            if (scale < 1) {
                Bitmap s = Bitmap.createScaledBitmap(b, Math.max(1, Math.round(b.getWidth() * scale)), Math.max(1, Math.round(b.getHeight() * scale)), true);
                if (s != b) b.recycle();
                b = s;
            }
            FileOutputStream out = new FileOutputStream(thumbFile(pic.getName()));
            b.compress(Bitmap.CompressFormat.JPEG, 70, out);
            out.close();
            b.recycle();
        } catch (Exception e) { /* the grid falls back to the full picture */ }
    }

    private File thumbFile(String picName) {
        return new File(pics, picName.replaceAll("\\.\\w+$", "") + ".thumb.jpg");
    }

    /** Everything for the picker, favorites first: [{id,name,kind,fav,thumb(b64 jpeg)}]. */
    public String listJson() {
        synchronized (lock) {
            JSONArray out = new JSONArray();
            JSONArray l = idx.optJSONArray("list");
            for (int i = 0; i < l.length(); i++) {
                JSONObject s = l.optJSONObject(i);
                File pic = new File(pics, s.optString("file"));
                if (!pic.exists()) continue;
                File th = thumbFile(pic.getName());
                byte[] bytes;
                try {
                    bytes = Store.readAll(new java.io.FileInputStream(th.exists() ? th : pic), 2 << 20);
                } catch (Exception e) {
                    continue;
                }
                JSONObject o = new JSONObject();
                Store.put(o, "id", s.optString("id"));
                Store.put(o, "name", s.optString("name"));
                Store.put(o, "kind", s.optString("kind"));
                Store.put(o, "fav", s.optBoolean("fav"));
                Store.put(o, "at", s.optLong("at"));
                Store.put(o, "thumb", Base64.encodeToString(bytes, Base64.NO_WRAP));
                out.put(o);
            }
            JSONObject r = new JSONObject();
            Store.put(r, "list", out);
            Store.put(r, "updated", idx.optLong("updated"));
            return r.toString();
        }
    }

    /** The full picture, to paste into the chat: {b64, name, type}. */
    public String getJson(String id) {
        synchronized (lock) {
            JSONObject s = Store.stickerFind(idx, id);
            if (s == null) return "";
            File pic = new File(pics, s.optString("file"));
            try {
                byte[] bytes = Store.readAll(new java.io.FileInputStream(pic), 24 << 20);
                JSONObject o = new JSONObject();
                Store.put(o, "b64", Base64.encodeToString(bytes, Base64.NO_WRAP));
                Store.put(o, "name", Store.safeName(s.optString("name")) + ext(pic.getName()));
                Store.put(o, "type", mime(pic.getName()));
                return o.toString();
            } catch (Exception e) {
                return "";
            }
        }
    }

    private static String mime(String name) {
        String e = ext(name);
        return e.equals(".png") ? "image/png" : e.equals(".gif") ? "image/gif" : e.equals(".webp") ? "image/webp" : "image/jpeg";
    }

    public boolean fav(String id, boolean on) {
        synchronized (lock) {
            JSONObject s = Store.stickerFind(idx, id);
            if (s == null) return false;
            Store.put(s, "fav", on);
        }
        save();
        return true;
    }

    public boolean remove(String id) {
        synchronized (lock) {
            JSONObject s = Store.stickerFind(idx, id);
            if (s == null) return false;
            File pic = new File(pics, s.optString("file"));
            pic.delete();
            thumbFile(pic.getName()).delete();
            JSONArray l = idx.optJSONArray("list"), out = new JSONArray();
            for (int i = 0; i < l.length(); i++) if (!l.optJSONObject(i).optString("id").equals(id)) out.put(l.optJSONObject(i));
            Store.put(idx, "list", out);
        }
        save();
        return true;
    }

    public boolean memesStale() {
        synchronized (lock) { return Store.memesStale(idx); }
    }

    /** Downloads one link (12 s, 20 MB max). */
    public static byte[] get(String link) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(link).openConnection();
        c.setConnectTimeout(12000);
        c.setReadTimeout(12000);
        c.setRequestProperty("User-Agent", "ALTS-phone/2.0");
        try (InputStream in = c.getInputStream()) {
            return Store.readAll(in, 20 << 20);
        } finally {
            c.disconnect();
        }
    }

    /** Freshens the meme pack (new popular ones appear, names stay current). Returns how many are new. */
    public int refreshMemes() throws Exception {
        if (!refreshing.compareAndSet(false, true)) return 0;
        try {
            List<Store.Meme> memes = Store.parseImgflip(new String(get("https://api.imgflip.com/get_memes"), java.nio.charset.StandardCharsets.UTF_8));
            if (memes.isEmpty()) throw new Exception("imgflip answered with nothing");
            int added = 0;
            for (Store.Meme m : memes) {
                boolean have;
                synchronized (lock) { have = Store.stickerFind(idx, m.id) != null; }
                if (!have) {
                    try {
                        byte[] bytes = get(m.url);
                        File out = new File(pics, Store.safeId(m.id) + ext(m.url));
                        try (FileOutputStream o = new FileOutputStream(out)) { o.write(bytes); }
                        thumb(out);
                        synchronized (lock) { Store.stickerAdd(idx, m.id, m.name, "meme", out.getName()); }
                        added++;
                    } catch (Exception e) { /* one missing picture is fine */ }
                } else {
                    synchronized (lock) { Store.put(Store.stickerFind(idx, m.id), "name", m.name); }
                }
            }
            synchronized (lock) { Store.put(idx, "updated", System.currentTimeMillis()); }
            save();
            return added;
        } finally {
            refreshing.set(false);
        }
    }

    /** GIPHY sticker search (transparent ones first, then normal gifs if few). */
    public String giphySearch(String key, String q) throws Exception {
        String enc = java.net.URLEncoder.encode(q, "UTF-8");
        String base = "https://api.giphy.com/v1/stickers/search?limit=24&rating=pg-13&api_key=" + java.net.URLEncoder.encode(key, "UTF-8") + "&q=" + enc;
        List<Store.Giphy> list = Store.parseGiphy(new String(get(base), java.nio.charset.StandardCharsets.UTF_8));
        if (list.size() < 8) {
            try {
                List<Store.Giphy> more = Store.parseGiphy(new String(get(base.replace("/stickers/", "/gifs/")), java.nio.charset.StandardCharsets.UTF_8));
                for (Store.Giphy g : more) {
                    boolean dup = false;
                    for (Store.Giphy h : list) dup |= h.id.equals(g.id);
                    if (!dup) list.add(g);
                }
            } catch (Exception e) { /* stickers alone then */ }
        }
        JSONArray out = new JSONArray();
        for (Store.Giphy g : list) {
            byte[] th;
            try { th = get(g.thumbUrl); } catch (Exception e) { continue; }
            JSONObject o = new JSONObject();
            Store.put(o, "id", g.id);
            Store.put(o, "name", g.name);
            Store.put(o, "thumb", Base64.encodeToString(th, Base64.NO_WRAP));
            Store.put(o, "url", g.sendUrl);
            out.put(o);
        }
        JSONObject r = new JSONObject();
        Store.put(r, "list", out);
        return r.toString();
    }

    /** Downloads a GIPHY pick. keep=true also puts it in the box (so it works offline next time). */
    public String giphyTake(String id, String name, String url, boolean keep) throws Exception {
        if (!url.startsWith("https://")) throw new Exception("bad link");
        byte[] bytes = get(url);
        String type = bytes.length > 3 && bytes[0] == 'G' && bytes[1] == 'I' && bytes[2] == 'F' ? "image/gif" : "image/webp";
        if (keep) {
            String sid = Store.safeId(id);
            File out = new File(pics, sid + (type.equals("image/gif") ? ".gif" : ".webp"));
            try (FileOutputStream o = new FileOutputStream(out)) { o.write(bytes); }
            thumb(out);
            synchronized (lock) { Store.stickerAdd(idx, sid, name, "giphy", out.getName()); }
            save();
        }
        JSONObject o = new JSONObject();
        Store.put(o, "b64", Base64.encodeToString(bytes, Base64.NO_WRAP));
        Store.put(o, "name", Store.safeName(name) + (type.equals("image/gif") ? ".gif" : ".webp"));
        Store.put(o, "type", type);
        return o.toString();
    }

    /** A picture from the gallery becomes a sticker (shrunk so it pastes fast). */
    public String addFromUri(android.net.Uri uri) throws Exception {
        byte[] raw;
        try (InputStream in = app.getContentResolver().openInputStream(uri)) {
            raw = Store.readAll(in, 40 << 20);
        }
        String id = "mine-" + Long.toString(System.currentTimeMillis(), 36);
        boolean gif = raw.length > 3 && raw[0] == 'G' && raw[1] == 'I' && raw[2] == 'F';
        File out = new File(pics, id + (gif ? ".gif" : ".jpg"));
        if (gif) { // keep a gif moving
            try (FileOutputStream o = new FileOutputStream(out)) { o.write(raw); }
        } else {
            Bitmap b = BitmapFactory.decodeByteArray(raw, 0, raw.length);
            if (b == null) throw new Exception("not a picture");
            float scale = 1280f / Math.max(b.getWidth(), b.getHeight());
            if (scale < 1) {
                Bitmap s = Bitmap.createScaledBitmap(b, Math.round(b.getWidth() * scale), Math.round(b.getHeight() * scale), true);
                if (s != b) b.recycle();
                b = s;
            }
            FileOutputStream o = new FileOutputStream(out);
            b.compress(Bitmap.CompressFormat.JPEG, 88, o);
            o.close();
            b.recycle();
        }
        thumb(out);
        synchronized (lock) { Store.stickerAdd(idx, id, "Your sticker", "mine", out.getName()); }
        save();
        return id;
    }
}
