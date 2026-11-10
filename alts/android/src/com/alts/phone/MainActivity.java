package com.alts.phone;

/* ALTS for phone 2.0: the PC app on your phone.
   - Accounts like the PC side list: each one its own login (a separate WebView profile), switch in
     the ALTS sheet. Your old login from 1.x stays (it lives in the default profile = "Main").
   - Same page mods as the PC (page.js + extras.js): save chat, Continue on another account, quick
     buttons, Send later, Fresh chat, usage, counter. The shell around them is assets/phone.js.
   - Stickers with favorites (Stickers.java), saved chats with search, a ping when the limit is back.
   Built with plain build tools (build.sh), no Android Studio. */
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlarmManager;
import android.app.AlertDialog;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.text.InputType;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.JsPromptResult;
import android.webkit.JsResult;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;
import java.io.File;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayDeque;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

public class MainActivity extends Activity {
    static final String VERSION = "2.0";
    static final String OLD_APP = "com.alts.phone";
    private FrameLayout frame;
    private final Map<String, WebView> views = new HashMap<>();
    private final ArrayDeque<String> warm = new ArrayDeque<>(); // accounts whose WebView is alive, oldest first
    private WebView web; // the one on screen
    private JSONObject accounts;
    private boolean profilesOk = false;
    private Stickers stickers;
    private SharedPreferences prefs;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final ExecutorService workers = Executors.newFixedThreadPool(3);
    private ValueCallback<Uri[]> pick;
    private String pickRpcToken = null;
    private WebView pickRpcView = null;
    private static final int PICK = 7, PICK_STICKER = 8, ASK_NOTIFY = 9;
    private String js = "";
    /* Android shows the bridge to every frame in the page, including claude.ai's artifacts (anyone's
       HTML). Only ALTS's own script, put into claude.ai's main frame, gets this key; calls without it
       do nothing. A new one every start. */
    private final String key = newKey();

    private static String newKey() {
        byte[] b = new byte[16];
        new java.security.SecureRandom().nextBytes(b);
        StringBuilder sb = new StringBuilder();
        for (byte x : b) sb.append(String.format(java.util.Locale.ROOT, "%02x", x));
        return sb.toString();
    }

    private File accountsFile() { return new File(getFilesDir(), "accounts.json"); }
    private File chatsDir() { File d = new File(getFilesDir(), "chats"); d.mkdirs(); return d; }
    private File chatsFile() { return new File(chatsDir(), "chats.json"); }
    private File pendingFile() { return new File(getFilesDir(), "pending-continue.json"); }

    @Override protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        prefs = getSharedPreferences("alts", MODE_PRIVATE);
        stickers = new Stickers(this);
        accounts = Store.parseAccounts(Store.read(accountsFile()));
        try {
            profilesOk = androidx.webkit.WebViewFeature.isFeatureSupported(androidx.webkit.WebViewFeature.MULTI_PROFILE);
        } catch (Throwable t) {
            profilesOk = false;
        }
        frame = new FrameLayout(this);
        frame.setBackgroundColor(Color.parseColor("#1b1b20")); // no white flash while claude.ai loads
        setContentView(frame);
        js = asset("phone.js") + "\n;\n" + asset("page.js") + "\n;\n" + asset("extras.js");
        CookieManager.getInstance().setAcceptCookie(true);
        show(accounts.optString("active"), saved);
        workers.execute(() -> { // fresher memes every few days, quietly
            try { if (stickers.memesStale()) stickers.refreshMemes(); } catch (Exception e) { /* next start tries again */ }
        });
    }

    // ---------------------------------------------------------------- accounts & WebViews

    private void saveAccounts() { Store.write(accountsFile(), accounts.toString()); }

    /** Puts [id]'s WebView on screen (making it if needed). Only "default" skips the profile call. */
    private void show(String id, Bundle saved) {
        if (Store.find(accounts, id) == null) id = accounts.optString("active");
        Store.put(accounts, "active", id);
        saveAccounts();
        WebView v = views.get(id);
        if (v == null) {
            v = make(id, saved);
            views.put(id, v);
        }
        warm.remove(id);
        warm.addLast(id);
        while (warm.size() > 3) { // keep at most 3 alive; logins stay (they live in the profile)
            String old = warm.peekFirst();
            if (old.equals(id)) break;
            warm.removeFirst();
            WebView w = views.remove(old);
            if (w != null) { frame.removeView(w); w.destroy(); }
        }
        if (web != null && web != v) web.onPause();
        web = v;
        frame.removeAllViews();
        frame.addView(v, new FrameLayout.LayoutParams(-1, -1));
        v.onResume();
    }

    @SuppressLint("SetJavaScriptEnabled")
    private WebView make(String id, Bundle saved) {
        WebView v = new WebView(this);
        if (profilesOk && !"default".equals(id)) {
            try {
                androidx.webkit.ProfileStore.getInstance().getOrCreateProfile("alts-" + id);
                androidx.webkit.WebViewCompat.setProfile(v, "alts-" + id);
            } catch (Throwable t) { /* stays on the shared login then */ }
        }
        WebSettings s = v.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        v.setBackgroundColor(Color.parseColor("#1b1b20"));
        try { CookieManager.getInstance().setAcceptThirdPartyCookies(v, true); } catch (Throwable t) { /* profile ones manage themselves */ }
        v.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView w, WebResourceRequest r) {
                Uri u = r.getUrl();
                String host = u.getHost() == null ? "" : u.getHost();
                if (host.equals("claude.ai") || host.endsWith(".claude.ai") || host.endsWith("anthropic.com") ||
                    host.endsWith("google.com") || host.endsWith("googleusercontent.com") || host.endsWith("apple.com")) return false; // logins stay inside
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception e) { /* nothing opens it */ }
                return true;
            }
            @Override public void onPageFinished(WebView w, String url) {
                if (url != null && url.startsWith("https://claude.ai")) {
                    w.evaluateJavascript("window.__altsKey=" + Store.jsString(key) + ";\n" + js, null);
                    if (getIntent() != null && getIntent().hasExtra("alts_later")) {
                        getIntent().removeExtra("alts_later");
                        main.postDelayed(() -> w.evaluateJavascript("window.__alts&&window.__alts.laterList&&window.__alts.laterList()", null), 3000);
                    }
                }
                CookieManager.getInstance().flush();
            }
            @Override public void doUpdateVisitedHistory(WebView w, String url, boolean reload) {
                if (url != null && url.startsWith("https://claude.ai")) prefs.edit().putString("url-" + id, url).apply();
            }
        });
        v.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView w, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (pick != null) pick.onReceiveValue(null);
                pick = cb;
                try { startActivityForResult(p.createIntent(), PICK); } catch (Exception e) { pick = null; return false; }
                return true;
            }
            @Override public boolean onJsAlert(WebView w, String url, String message, JsResult res) {
                new AlertDialog.Builder(MainActivity.this).setMessage(message)
                    .setPositiveButton("OK", (d, x) -> res.confirm()).setOnCancelListener(d -> res.cancel()).show();
                return true;
            }
            @Override public boolean onJsConfirm(WebView w, String url, String message, JsResult res) {
                new AlertDialog.Builder(MainActivity.this).setMessage(message)
                    .setPositiveButton("OK", (d, x) -> res.confirm()).setNegativeButton("Cancel", (d, x) -> res.cancel())
                    .setOnCancelListener(d -> res.cancel()).show();
                return true;
            }
            @Override public boolean onJsPrompt(WebView w, String url, String message, String def, JsPromptResult res) {
                EditText in = new EditText(MainActivity.this);
                in.setInputType(InputType.TYPE_CLASS_TEXT);
                in.setText(def == null ? "" : def);
                new AlertDialog.Builder(MainActivity.this).setMessage(message).setView(in)
                    .setPositiveButton("OK", (d, x) -> res.confirm(in.getText().toString()))
                    .setNegativeButton("Cancel", (d, x) -> res.cancel()).setOnCancelListener(d -> res.cancel()).show();
                return true;
            }
        });
        v.setDownloadListener((url, ua, cd, mime, len) -> {
            try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception e) { /* fine */ }
        });
        v.addJavascriptInterface(new Bridge(id, v), "AltsPhone");
        if (saved != null && id.equals(accounts.optString("active")) && v.restoreState(saved) != null) return v;
        String last = prefs.getString("url-" + id, "https://claude.ai/new");
        v.loadUrl(last.startsWith("https://claude.ai") ? last : "https://claude.ai/new");
        return v;
    }

    private void runJs(WebView v, String code) {
        main.post(() -> { if (v != null && v.isAttachedToWindow() || views.containsValue(v)) v.evaluateJavascript(code, null); });
    }

    // ---------------------------------------------------------------- the bridge the page talks to

    class Bridge {
        final String account;
        final WebView view;
        Bridge(String account, WebView view) { this.account = account; this.view = view; }

        /** Who am I + every account (with its last known usage) + what works here. */
        @JavascriptInterface public String info(String k) {
            if (!key.equals(k)) return "";
            JSONObject o = new JSONObject();
            Store.put(o, "version", VERSION);
            Store.put(o, "account", account);
            Store.put(o, "active", accounts.optString("active"));
            Store.put(o, "profiles", profilesOk);
            Store.put(o, "giphy", !prefs.getString("giphy-key", "").isEmpty());
            Store.put(o, "oldApp", oldAppInstalled());
            Store.put(o, "list", accounts.optJSONArray("list"));
            return o.toString();
        }

        @JavascriptInterface public void usage(String k, String json) {
            if (!key.equals(k)) return;
            // remember each account's bars for the sheet
            try {
                JSONObject u = new JSONObject(json);
                Store.put(u, "at", System.currentTimeMillis());
                JSONObject a = Store.find(accounts, account);
                if (a != null) { Store.put(a, "usage", u); saveAccounts(); }
            } catch (Exception e) { /* a bad one changes nothing */ }
        }

        @JavascriptInterface public void switchAccount(String k, String id) {
            if (!key.equals(k)) return;
            main.post(() -> show(id, null)); }

        @JavascriptInterface public void addAccount(String k, String name) {
            if (!key.equals(k)) return;
            main.post(() -> {
                if (!profilesOk) return;
                String id = Store.addAccount(accounts, name);
                saveAccounts();
                show(id, null);
            });
        }

        @JavascriptInterface public void renameAccount(String k, String id, String name) {
            if (!key.equals(k)) return;
            JSONObject a = Store.find(accounts, id);
            if (a != null && !Store.safeName(name).equals("Chat")) { Store.put(a, "name", Store.safeName(name)); saveAccounts(); }
        }

        @JavascriptInterface public void removeAccount(String k, String id) {
            if (!key.equals(k)) return;
            main.post(() -> {
                if (!Store.removeAccount(accounts, id)) return;
                saveAccounts();
                warm.remove(id);
                WebView w = views.remove(id);
                if (w != null) { frame.removeView(w); w.destroy(); }
                // The login folder goes too (the Claude account itself is untouched). Android wants this on
                // the main thread, once no WebView uses it anymore: a moment after the one above is gone.
                main.postDelayed(() -> {
                    try { androidx.webkit.ProfileStore.getInstance().deleteProfile("alts-" + id); } catch (Throwable t) { /* stays until the app is removed */ }
                }, 800);
                prefs.edit().remove("url-" + id).apply();
                show(accounts.optString("active"), null);
            });
        }

        // ---- stickers (sync: files on this phone, fast)
        @JavascriptInterface public String stickers(String k) {
            if (!key.equals(k)) return "";
            return stickers.listJson(); }
        @JavascriptInterface public String stickerGet(String k, String id) {
            if (!key.equals(k)) return "";
            return stickers.getJson(id); }
        @JavascriptInterface public boolean stickerFav(String k, String id, boolean on) {
            if (!key.equals(k)) return false;
            return stickers.fav(id, on); }
        @JavascriptInterface public boolean stickerDel(String k, String id) {
            if (!key.equals(k)) return false;
            return stickers.remove(id); }
        @JavascriptInterface public boolean hasGiphy(String k) {
            if (!key.equals(k)) return false;
            return !prefs.getString("giphy-key", "").isEmpty(); }
        @JavascriptInterface public void setGiphyKey(String k, String value) {
            if (!key.equals(k)) return;
            prefs.edit().putString("giphy-key", value == null ? "" : value.trim()).apply(); }

        // ---- saved chats
        @JavascriptInterface public String chatList(String k) {
            if (!key.equals(k)) return "";
            return Store.parseChats(Store.read(chatsFile())).toString();
        }

        @JavascriptInterface public void chatOpen(String k, String id) {
            if (!key.equals(k)) return;
            JSONObject c = Store.stickerFind(Store.parseChats(Store.read(chatsFile())), id); // same shape: list of {id,...}
            if (c == null) return;
            Intent i = new Intent(MainActivity.this, ViewerActivity.class);
            i.putExtra("file", new File(chatsDir(), c.optString("file")).getPath());
            i.putExtra("title", c.optString("title"));
            main.post(() -> { try { startActivity(i); } catch (Exception e) { /* fine */ } });
        }

        @JavascriptInterface public void openDownloads(String k) {
            if (!key.equals(k)) return;
            main.post(() -> { try { startActivity(new Intent(android.app.DownloadManager.ACTION_VIEW_DOWNLOADS)); } catch (Exception e) { /* fine */ } });
        }

        // ---- Continue on another account
        @JavascriptInterface public void continueTo(String k, String targetId, String payload) {
            if (!key.equals(k)) return;
            Store.write(pendingFile(), payload); // {account,text,md,name,saved}
            main.post(() -> {
                show(targetId, null);
                if (web != null) web.loadUrl("https://claude.ai/new"); // a fresh chat there, not the last one open
            });
        }

        /** ALTS 1.x is a separate app (its signing key is gone): offer to remove it once you're in. */
        @JavascriptInterface public boolean oldApp(String k) {
            if (!key.equals(k)) return false;
            return oldAppInstalled(); }

        @JavascriptInterface public void removeOld(String k) {
            if (!key.equals(k)) return;
            main.post(() -> {
                try { startActivity(new Intent(Intent.ACTION_DELETE, Uri.fromParts("package", OLD_APP, null))); }
                catch (Exception e) {
                    try { startActivity(new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", OLD_APP, null))); }
                    catch (Exception e2) { /* they can hold the icon and pick Uninstall */ }
                }
            });
        }

        @JavascriptInterface public String pendingContinue(String k) {
            if (!key.equals(k)) return "";
            String raw = Store.read(pendingFile());
            if (raw.isEmpty()) return "";
            try {
                JSONObject p = new JSONObject(raw);
                if (!p.optString("account").equals(account)) return "";
                pendingFile().delete();
                return p.toString();
            } catch (Exception e) {
                pendingFile().delete();
                return "";
            }
        }

        // ---- the ping when the limit is back
        @JavascriptInterface public void schedulePing(String k, long atMs, String text) {
            if (!key.equals(k)) return;
            main.post(() -> {
                askNotifications();
                try {
                    AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
                    Intent i = new Intent(MainActivity.this, PingReceiver.class).putExtra("text", text);
                    PendingIntent pi = PendingIntent.getBroadcast(MainActivity.this, 1, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                    long at = Math.max(atMs, System.currentTimeMillis() + 5000);
                    am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
                } catch (Exception e) { /* the in-page chime still happens */ }
            });
        }

        @JavascriptInterface public void cancelPing(String k) {
            if (!key.equals(k)) return;
            try {
                AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
                am.cancel(PendingIntent.getBroadcast(MainActivity.this, 1, new Intent(MainActivity.this, PingReceiver.class), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
            } catch (Exception e) { /* fine */ }
        }

        // ---- slow things (network, big files): answered later via __AltsRpc.done
        @JavascriptInterface public void rpc(String k, String token, String name, String argsJson) {
            if (!key.equals(k)) return;
            workers.execute(() -> {
                String out;
                try {
                    JSONObject args = argsJson == null || argsJson.isEmpty() ? new JSONObject() : new JSONObject(argsJson);
                    Store.put(args, "token", token);
                    out = rpcRun(this, name, args);
                } catch (Exception e) {
                    JSONObject err = new JSONObject();
                    Store.put(err, "error", String.valueOf(e.getMessage() == null ? e : e.getMessage()));
                    out = err.toString();
                }
                if (out == null) return; // someone else answers later (the gallery pick)
                runJs(view, "window.__AltsRpc&&window.__AltsRpc.done(" + Store.jsString(token) + "," + Store.jsString(out) + ")");
            });
        }
    }

    private String rpcRun(Bridge b, String name, JSONObject a) throws Exception {
        switch (name) {
            case "chatSave": {
                JSONObject chats = Store.parseChats(Store.read(chatsFile()));
                JSONObject c = Store.chatAdd(chats, b.account, a.optString("title"), a.optString("url"), a.optInt("words"));
                boolean ok = Store.write(new File(chatsDir(), c.optString("file")), a.optString("html"))
                    && Store.write(new File(chatsDir(), c.optString("md")), a.optString("md"))
                    && Store.write(chatsFile(), chats.toString());
                String stamp = new java.text.SimpleDateFormat("yyyy-MM-dd HH-mm", java.util.Locale.US).format(new java.util.Date());
                String base = Store.safeName(a.optString("title")) + " " + stamp;
                if (!a.optBoolean("skipDownloads")) {
                    saveToDownloads(base + ".html", a.optString("html"));
                    saveToDownloads(base + ".md", a.optString("md"));
                }
                JSONObject r = new JSONObject();
                Store.put(r, "ok", ok);
                Store.put(r, "id", c.optString("id"));
                Store.put(r, "words", a.optInt("words"));
                Store.put(r, "pics", a.optInt("pics"));
                Store.put(r, "why", a.optString("why"));
                return r.toString();
            }
            case "chatSearch": {
                JSONObject chats = Store.parseChats(Store.read(chatsFile()));
                java.util.List<Store.Hit> hits = Store.chatSearch(chats, a.optString("q"),
                    c -> Store.read(new File(chatsDir(), c.optString("md"))));
                org.json.JSONArray out = new org.json.JSONArray();
                for (Store.Hit h : hits.subList(0, Math.min(hits.size(), 50))) {
                    JSONObject o = new JSONObject();
                    for (String k : new String[]{"id", "title", "account", "url"}) Store.put(o, k, h.chat.optString(k));
                    Store.put(o, "words", h.chat.optInt("words"));
                    Store.put(o, "at", h.chat.optLong("at"));
                    Store.put(o, "snippet", h.snippet);
                    out.put(o);
                }
                JSONObject r = new JSONObject();
                Store.put(r, "list", out);
                return r.toString();
            }
            case "chatDelete": {
                JSONObject chats = Store.parseChats(Store.read(chatsFile()));
                JSONObject c = Store.stickerFind(chats, a.optString("id"));
                if (c != null) {
                    new File(chatsDir(), c.optString("file")).delete();
                    new File(chatsDir(), c.optString("md")).delete();
                    org.json.JSONArray l = chats.optJSONArray("list"), out = new org.json.JSONArray();
                    for (int i = 0; i < l.length(); i++) if (!l.optJSONObject(i).optString("id").equals(a.optString("id"))) out.put(l.optJSONObject(i));
                    Store.put(chats, "list", out);
                    Store.write(chatsFile(), chats.toString());
                }
                return "{\"ok\":true}";
            }
            case "giphy": {
                String key = prefs.getString("giphy-key", "");
                if (key.isEmpty()) throw new Exception("no key");
                return stickers.giphySearch(key, a.optString("q"));
            }
            case "giphyTake":
                return stickers.giphyTake(a.optString("id"), a.optString("name"), a.optString("url"), a.optBoolean("keep"));
            case "memeRefresh": {
                int added = stickers.refreshMemes();
                return "{\"added\":" + added + "}";
            }
            case "addPick": {
                main.post(() -> {
                    pickRpcToken = a.optString("token");
                    pickRpcView = b.view;
                    Intent i = new Intent(Intent.ACTION_GET_CONTENT).setType("image/*").addCategory(Intent.CATEGORY_OPENABLE);
                    try { startActivityForResult(Intent.createChooser(i, "Pick a sticker"), PICK_STICKER); }
                    catch (Exception e) { answerPick("{\"error\":\"no gallery\"}"); }
                });
                return null; // answered after the pick
            }
            default:
                throw new Exception("unknown: " + name);
        }
    }

    private void answerPick(String json) {
        if (pickRpcToken == null) return;
        runJs(pickRpcView, "window.__AltsRpc&&window.__AltsRpc.done(" + Store.jsString(pickRpcToken) + "," + Store.jsString(json) + ")");
        pickRpcToken = null;
        pickRpcView = null;
    }

    private boolean saveToDownloads(String name, String text) {
        try {
            ContentValues cv = new ContentValues();
            cv.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
            cv.put(MediaStore.MediaColumns.MIME_TYPE, name.endsWith(".md") ? "text/markdown" : "text/html");
            cv.put(MediaStore.MediaColumns.RELATIVE_PATH, "Download/ALTS");
            Uri u = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
            if (u == null) return false;
            OutputStream o = getContentResolver().openOutputStream(u);
            o.write(text.getBytes("UTF-8"));
            o.close();
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private boolean oldAppInstalled() {
        if (OLD_APP.equals(getPackageName())) return false;
        try {
            getPackageManager().getPackageInfo(OLD_APP, 0);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private void askNotifications() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, ASK_NOTIFY);
        }
    }

    static void notifyNow(Context ctx, String text) {
        try {
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel("alts") == null) {
                nm.createNotificationChannel(new NotificationChannel("alts", "ALTS", NotificationManager.IMPORTANCE_HIGH));
            }
            Intent open = new Intent(ctx, MainActivity.class).putExtra("alts_later", 1).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
            PendingIntent pi = PendingIntent.getActivity(ctx, 2, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            android.app.Notification.Builder nb = Build.VERSION.SDK_INT >= 26
                ? new android.app.Notification.Builder(ctx, "alts") : new android.app.Notification.Builder(ctx);
            nb.setSmallIcon(android.R.drawable.ic_popup_reminder)
                .setContentTitle("ALTS").setContentText(text)
                .setStyle(new android.app.Notification.BigTextStyle().bigText(text))
                .setAutoCancel(true).setContentIntent(pi);
            nm.notify(1, nb.build());
        } catch (Exception e) { /* fine */ }
    }

    public static class PingReceiver extends android.content.BroadcastReceiver {
        @Override public void onReceive(Context ctx, Intent i) {
            notifyNow(ctx, i.getStringExtra("text") == null ? "Your limit is back!" : i.getStringExtra("text"));
        }
    }

    // ---------------------------------------------------------------- plumbing

    @Override protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        setIntent(i);
        if (i != null && i.hasExtra("alts_later") && web != null) {
            i.removeExtra("alts_later");
            main.postDelayed(() -> web.evaluateJavascript("window.__alts&&window.__alts.laterList&&window.__alts.laterList()", null), 1200);
        }
    }

    @Override protected void onActivityResult(int req, int res, Intent data) {
        if (req == PICK && pick != null) {
            pick.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(res, data));
            pick = null;
        } else if (req == PICK_STICKER) {
            Uri u = res == RESULT_OK && data != null ? data.getData() : null;
            if (u == null) { answerPick("{\"error\":\"nothing picked\"}"); return; }
            workers.execute(() -> {
                String out;
                try { out = "{\"id\":" + Store.jsString(stickers.addFromUri(u)) + "}"; }
                catch (Exception e) { out = "{\"error\":\"couldn't read that picture\"}"; }
                final String o = out;
                main.post(() -> answerPick(o));
            });
        } else super.onActivityResult(req, res, data);
    }

    @Override protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        if (web != null) web.saveState(out);
    }

    @Override public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override protected void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
        if (profilesOk) { // each account's login lives in its own profile: save those too
            for (String id : views.keySet()) {
                if ("default".equals(id)) continue;
                try { androidx.webkit.ProfileStore.getInstance().getOrCreateProfile("alts-" + id).getCookieManager().flush(); }
                catch (Throwable t) { /* saved on its own a bit later anyway */ }
            }
        }
    }

    @Override protected void onDestroy() {
        super.onDestroy();
        workers.shutdown();
        for (WebView v : views.values()) v.destroy();
        views.clear();
    }

    private String asset(String name) {
        try (InputStream in = getAssets().open(name)) {
            return new String(Store.readAll(in, 8 << 20), java.nio.charset.StandardCharsets.UTF_8);
        } catch (Exception e) {
            return "";
        }
    }
}
