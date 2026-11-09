package com.alts.phone;

/* ALTS for phone: claude.ai in its own app, with the same ALTS page code as the PC app (ui/page.js) and a phone shell
   (assets/phone.js): the usage pill at the top (5-hour + week), Save this chat (to Download/ALTS), Top / Bottom.
   Your sign-in stays (it's kept like a browser keeps it). Links that aren't Claude open in Chrome. */
import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

public class MainActivity extends Activity {
    private WebView web;
    private ValueCallback<Uri[]> pick;
    private static final int PICK = 7;
    private String js = "";

    @Override protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        web = new WebView(this);
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);
        js = asset("phone.js") + "\n;\n" + asset("page.js");
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                String host = u.getHost() == null ? "" : u.getHost();
                if (host.equals("claude.ai") || host.endsWith(".claude.ai") || host.endsWith("anthropic.com")) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception e) { /* nothing opens it */ }
                return true;
            }
            @Override public void onPageFinished(WebView v, String url) {
                if (url != null && url.startsWith("https://claude.ai")) v.evaluateJavascript(js, null);
                CookieManager.getInstance().flush();
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (pick != null) pick.onReceiveValue(null);
                pick = cb;
                try { startActivityForResult(p.createIntent(), PICK); } catch (Exception e) { pick = null; return false; }
                return true;
            }
        });
        web.setDownloadListener(new android.webkit.DownloadListener() {
            @Override public void onDownloadStart(String url, String ua, String cd, String mime, long len) {
                try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception e) { /* fine */ }
            }
        });
        web.addJavascriptInterface(new Bridge(), "AltsPhone");
        if (saved != null) web.restoreState(saved); else web.loadUrl("https://claude.ai/new");
    }

    /* the page asks the app to keep a saved chat: Download/ALTS/<name> */
    class Bridge {
        @JavascriptInterface public boolean save(String name, String text) {
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
            } catch (Exception e) { return false; }
        }
    }

    @Override protected void onActivityResult(int req, int res, Intent data) {
        if (req == PICK && pick != null) { pick.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(res, data)); pick = null; }
        else super.onActivityResult(req, res, data);
    }
    @Override protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }
    @Override public void onBackPressed() { if (web.canGoBack()) web.goBack(); else super.onBackPressed(); }
    @Override protected void onPause() { super.onPause(); CookieManager.getInstance().flush(); }

    private String asset(String name) {
        try (InputStream in = getAssets().open(name)) {
            ByteArrayOutputStream b = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) b.write(buf, 0, n);
            return b.toString("UTF-8");
        } catch (Exception e) { return ""; }
    }
}
