package com.fantasyfc.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;

import androidx.core.splashscreen.SplashScreen;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String NATIVE_APP_UA = "FantasyArenaNative/1.1.6";
    private static final String APP_BASE_URL = "https://fantasy-sports-exchange-production-d05c.up.railway.app";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);

        WebView webView = getBridge().getWebView();
        if (webView == null) return;

        WebSettings settings = webView.getSettings();
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setTextZoom(100);
        settings.setSupportZoom(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);
        String userAgent = settings.getUserAgentString();
        if (userAgent == null) userAgent = "";
        if (!userAgent.contains("FantasyArenaNative/")) {
            settings.setUserAgentString((userAgent + " " + NATIVE_APP_UA).trim());
        }
        webView.setLayerType(WebView.LAYER_TYPE_HARDWARE, null);

        handleAuthIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleAuthIntent(intent);
    }

    private void handleAuthIntent(Intent intent) {
        if (intent == null || intent.getData() == null || getBridge() == null) return;
        Uri data = intent.getData();
        if (!"fantasyarena".equalsIgnoreCase(data.getScheme())) return;
        if (!"auth".equalsIgnoreCase(data.getHost())) return;
        if (!"/callback".equals(data.getPath())) return;

        WebView webView = getBridge().getWebView();
        if (webView == null) return;

        String ticket = data.getQueryParameter("ticket");
        if (ticket != null && !ticket.trim().isEmpty()) {
            String url = APP_BASE_URL + "/api/auth/native/complete?ticket=" + Uri.encode(ticket.trim());
            webView.post(() -> webView.loadUrl(url));
            return;
        }

        String error = data.getQueryParameter("error");
        String errorCode = error == null || error.trim().isEmpty() ? "native" : error.trim();
        String url = APP_BASE_URL + "/?auth_error=" + Uri.encode(errorCode);
        webView.post(() -> webView.loadUrl(url));
    }
}
