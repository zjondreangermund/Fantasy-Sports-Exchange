package com.fantasyfc.app;

import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.ViewGroup;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.FrameLayout;
import android.widget.ImageView;

import androidx.core.splashscreen.SplashScreen;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String NATIVE_APP_UA = "FantasyArenaNative/1.1.9";
    private static final String APP_BASE_URL = "https://fantasy-sports-exchange-production-d05c.up.railway.app";
    private FrameLayout launchOverlay;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Android 12+ always masks the system splash icon. Keep that system phase
        // plain black, then render the complete Fantasy Arena artwork ourselves so
        // Samsung/Android cannot crop the crown or wordmark into a circle.
        SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
        showBrandLaunchOverlay();

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

    private void showBrandLaunchOverlay() {
        final FrameLayout overlay = new FrameLayout(this);
        overlay.setBackgroundColor(Color.BLACK);
        overlay.setClickable(true);
        overlay.setFocusable(true);

        final ImageView logo = new ImageView(this);
        logo.setImageResource(R.mipmap.fantasy_arena_logo);
        logo.setScaleType(ImageView.ScaleType.FIT_CENTER);
        logo.setAdjustViewBounds(true);
        logo.setContentDescription("Fantasy Arena");

        final int logoSize = dp(220);
        FrameLayout.LayoutParams logoParams = new FrameLayout.LayoutParams(logoSize, logoSize, Gravity.CENTER);
        overlay.addView(logo, logoParams);

        addContentView(
            overlay,
            new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        );
        overlay.bringToFront();
        launchOverlay = overlay;

        // The remote app normally paints well before this. The short branded hold
        // prevents a flash of the WebView while still keeping launch responsive.
        overlay.postDelayed(() -> dismissBrandLaunchOverlay(overlay), 1150L);
    }

    private void dismissBrandLaunchOverlay(FrameLayout overlay) {
        if (launchOverlay != overlay || isFinishing()) return;
        overlay.animate()
            .alpha(0f)
            .setDuration(220L)
            .withEndAction(() -> {
                if (overlay.getParent() instanceof ViewGroup) {
                    ((ViewGroup) overlay.getParent()).removeView(overlay);
                }
                if (launchOverlay == overlay) launchOverlay = null;
            })
            .start();
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
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
