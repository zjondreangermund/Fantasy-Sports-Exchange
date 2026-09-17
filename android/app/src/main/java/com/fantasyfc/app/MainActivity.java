package com.fantasyfc.app;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.Gravity;
import android.view.ViewGroup;
import android.view.ViewParent;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.FrameLayout;
import android.widget.ImageView;

import androidx.core.content.FileProvider;
import androidx.core.splashscreen.SplashScreen;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class MainActivity extends BridgeActivity {
    private static final String NATIVE_APP_UA = "FantasyArenaNative/1.1.11";
    private static final String APP_BASE_URL = "https://fantasy-sports-exchange-production-d05c.up.railway.app";
    private static final String APP_UPDATE_URL = APP_BASE_URL + "/api/android/releases/latest.apk";
    private static final long MIN_APK_BYTES = 1024L * 1024L;
    private static final long MAX_APK_BYTES = 100L * 1024L * 1024L;
    private FrameLayout launchOverlay;
    private boolean rendererRecoveryScheduled = false;
    private volatile boolean updateDownloadRunning = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        bridgeBuilder.addWebViewListener(new WebViewListener() {
            @Override
            public boolean onRenderProcessGone(WebView webView, RenderProcessGoneDetail detail) {
                recoverFromRendererLoss(webView);
                return true;
            }
        });

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

        // The updater exposes no arbitrary URL/file access to web content. Its only
        // action is downloading Fantasy Arena's fixed, same-origin signed APK route.
        webView.addJavascriptInterface(new FantasyArenaUpdater(webView), "FantasyArenaUpdater");

        handleAuthIntent(getIntent());
    }

    private final class FantasyArenaUpdater {
        private final WebView webView;

        FantasyArenaUpdater(WebView webView) {
            this.webView = webView;
        }

        @JavascriptInterface
        public void installLatestUpdate() {
            if (updateDownloadRunning) return;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !getPackageManager().canRequestPackageInstalls()) {
                dispatchUpdateState(webView, "permission_required", "Allow Fantasy Arena to install its own verified updates, then return and tap Update again.");
                runOnUiThread(() -> {
                    Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + getPackageName()));
                    startActivity(intent);
                });
                return;
            }

            updateDownloadRunning = true;
            dispatchUpdateState(webView, "downloading", "Preparing the verified Fantasy Arena update…");
            new Thread(() -> downloadAndInstallUpdate(webView), "FantasyArenaUpdater").start();
        }
    }

    private void downloadAndInstallUpdate(WebView webView) {
        File apk = new File(getCacheDir(), "Fantasy-Arena-Update.apk");
        HttpURLConnection connection = null;
        try {
            if (apk.exists() && !apk.delete()) {
                throw new IllegalStateException("Could not prepare update storage");
            }

            connection = (HttpURLConnection) new URL(APP_UPDATE_URL).openConnection();
            connection.setInstanceFollowRedirects(true);
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(45000);
            connection.setRequestProperty("Accept", "application/vnd.android.package-archive");
            connection.setRequestProperty("User-Agent", NATIVE_APP_UA);
            connection.connect();

            int status = connection.getResponseCode();
            if (status != HttpURLConnection.HTTP_OK) {
                throw new IllegalStateException("Update server returned " + status);
            }

            long expectedLength = connection.getContentLengthLong();
            if (expectedLength > MAX_APK_BYTES) {
                throw new IllegalStateException("Update package is unexpectedly large");
            }

            long total = 0L;
            try (InputStream input = connection.getInputStream();
                 FileOutputStream output = new FileOutputStream(apk)) {
                byte[] buffer = new byte[64 * 1024];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    total += count;
                    if (total > MAX_APK_BYTES) throw new IllegalStateException("Update package is unexpectedly large");
                    output.write(buffer, 0, count);
                }
                output.getFD().sync();
            }

            if (total < MIN_APK_BYTES || (expectedLength > 0 && total != expectedLength)) {
                throw new IllegalStateException("The downloaded update package is incomplete");
            }

            PackageInfo archive = getPackageManager().getPackageArchiveInfo(apk.getAbsolutePath(), 0);
            if (archive == null || archive.packageName == null) {
                throw new IllegalStateException("Android could not read the downloaded update package");
            }
            if (!getPackageName().equals(archive.packageName)) {
                throw new IllegalStateException("The update package does not belong to Fantasy Arena");
            }

            long archiveVersion = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                ? archive.getLongVersionCode()
                : archive.versionCode;
            PackageInfo installed = getPackageManager().getPackageInfo(getPackageName(), 0);
            long installedVersion = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                ? installed.getLongVersionCode()
                : installed.versionCode;
            if (archiveVersion <= installedVersion) {
                throw new IllegalStateException("Fantasy Arena is already up to date");
            }

            dispatchUpdateState(webView, "ready", "Update downloaded. Android will now confirm the app update.");
            Uri apkUri = FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", apk);
            Intent install = new Intent(Intent.ACTION_VIEW);
            install.setDataAndType(apkUri, "application/vnd.android.package-archive");
            install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            runOnUiThread(() -> startActivity(install));
        } catch (PackageManager.NameNotFoundException error) {
            dispatchUpdateState(webView, "error", "Fantasy Arena could not verify the installed app version.");
        } catch (Exception error) {
            if (apk.exists()) apk.delete();
            dispatchUpdateState(webView, "error", String.valueOf(error.getMessage() == null ? "The update could not be prepared." : error.getMessage()));
        } finally {
            if (connection != null) connection.disconnect();
            updateDownloadRunning = false;
        }
    }

    private void dispatchUpdateState(WebView webView, String state, String message) {
        if (webView == null) return;
        String script = "window.dispatchEvent(new CustomEvent('fantasy-arena:update-state',{detail:{state:"
            + JSONObject.quote(state) + ",message:" + JSONObject.quote(message) + "}}));";
        webView.post(() -> webView.evaluateJavascript(script, null));
    }

    private void recoverFromRendererLoss(WebView webView) {
        if (rendererRecoveryScheduled) return;
        rendererRecoveryScheduled = true;

        runOnUiThread(() -> {
            try {
                ViewParent parent = webView.getParent();
                if (parent instanceof ViewGroup) {
                    ((ViewGroup) parent).removeView(webView);
                }
                webView.destroy();
            } catch (Exception ignored) {
                // The renderer is already gone; cleanup is best-effort before restart.
            }

            if (!isFinishing() && !isDestroyed()) recreate();
        });
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

        addContentView(overlay, new ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));
        overlay.bringToFront();
        launchOverlay = overlay;
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
