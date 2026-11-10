package com.alts.phone;

/* ALTS for phone: shows a saved chat (the .html file saved earlier). Its own little screen, so the
   back button returns to Claude exactly where you were. No JavaScript in here: it's just a page. */
import android.app.Activity;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.File;

public class ViewerActivity extends Activity {
    private WebView web;

    @Override protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        String path = getIntent().getStringExtra("file");
        String title = getIntent().getStringExtra("title");
        setTitle(title == null || title.isEmpty() ? "Saved chat" : title);
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#1b1b20"));
        web.getSettings().setAllowFileAccess(true); // it only ever opens ALTS's own saved file below
        web.getSettings().setBuiltInZoomControls(true);
        web.getSettings().setDisplayZoomControls(false);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                try { startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW, r.getUrl())); } catch (Exception e) { /* fine */ }
                return true; // links inside a saved chat open outside; this screen stays the saved chat
            }
        });
        setContentView(web);
        if (path == null || !new File(path).exists()) { finish(); return; }
        web.loadUrl(Uri.fromFile(new File(path)).toString());
    }

    @Override public void onBackPressed() { finish(); }

    @Override protected void onDestroy() {
        super.onDestroy();
        if (web != null) web.destroy();
    }
}
