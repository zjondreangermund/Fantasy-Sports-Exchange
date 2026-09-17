package com.fantasyfc.app;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Locale;

@CapacitorPlugin(name = "FantasyArenaUpdater")
public class FantasyArenaUpdaterPlugin extends Plugin {
    private static final String APK_MIME = "application/vnd.android.package-archive";
    private static final long MAX_APK_BYTES = 50L * 1024L * 1024L;

    @PluginMethod
    public void installUpdate(PluginCall call) {
        String url = safe(call.getString("url"));
        String version = safe(call.getString("version"));
        String expectedSha256 = safe(call.getString("sha256")).toLowerCase(Locale.US);

        if (!url.startsWith("https://playfantasyarena.com/api/android/update/apk")) {
            call.reject("Fantasy Arena update URL is not trusted");
            return;
        }
        if (!version.matches("\\d+\\.\\d+\\.\\d+")) {
            call.reject("A valid Fantasy Arena version is required");
            return;
        }
        if (!expectedSha256.matches("[a-f0-9]{64}")) {
            call.reject("Fantasy Arena update integrity value is missing");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getContext().getPackageManager().canRequestPackageInstalls()) {
            Intent permissionIntent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
            permissionIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(permissionIntent);
            JSObject result = new JSObject();
            result.put("permissionRequired", true);
            result.put("message", "Allow Fantasy Arena to install its signed update, then tap Update again.");
            call.resolve(result);
            return;
        }

        new Thread(() -> downloadAndInstall(call, url, version, expectedSha256), "fantasy-arena-updater").start();
    }

    private void downloadAndInstall(PluginCall call, String urlValue, String version, String expectedSha256) {
        HttpURLConnection connection = null;
        File target = new File(getContext().getCacheDir(), "Fantasy-Arena-" + version + ".apk");
        try {
            URL url = new URL(urlValue);
            connection = (HttpURLConnection) url.openConnection();
            connection.setInstanceFollowRedirects(true);
            connection.setConnectTimeout(15_000);
            connection.setReadTimeout(45_000);
            connection.setRequestProperty("Accept", APK_MIME);
            connection.setRequestProperty("User-Agent", "FantasyArenaNativeUpdater");
            connection.connect();

            int responseCode = connection.getResponseCode();
            if (responseCode < 200 || responseCode >= 300) {
                throw new IllegalStateException("Update server returned " + responseCode);
            }
            long declaredLength = connection.getContentLengthLong();
            if (declaredLength > MAX_APK_BYTES) throw new IllegalStateException("Update package is unexpectedly large");

            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            long total = 0L;
            byte[] buffer = new byte[32 * 1024];
            try (InputStream input = new BufferedInputStream(connection.getInputStream());
                 FileOutputStream output = new FileOutputStream(target, false)) {
                int read;
                while ((read = input.read(buffer)) != -1) {
                    total += read;
                    if (total > MAX_APK_BYTES) throw new IllegalStateException("Update package is unexpectedly large");
                    output.write(buffer, 0, read);
                    digest.update(buffer, 0, read);
                }
                output.flush();
            }

            if (total < 4L) throw new IllegalStateException("Downloaded update is incomplete");
            String actualSha256 = toHex(digest.digest());
            if (!expectedSha256.equals(actualSha256)) throw new IllegalStateException("Update integrity verification failed");

            PackageInfo archiveInfo;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                archiveInfo = getContext().getPackageManager().getPackageArchiveInfo(target.getAbsolutePath(), android.content.pm.PackageManager.PackageInfoFlags.of(0));
            } else {
                archiveInfo = getContext().getPackageManager().getPackageArchiveInfo(target.getAbsolutePath(), 0);
            }
            if (archiveInfo == null || !getContext().getPackageName().equals(archiveInfo.packageName)) {
                throw new IllegalStateException("Downloaded package is not Fantasy Arena");
            }

            Uri contentUri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                target
            );
            Intent installIntent = new Intent(Intent.ACTION_VIEW);
            installIntent.setDataAndType(contentUri, APK_MIME);
            installIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);

            getActivity().runOnUiThread(() -> {
                try {
                    getContext().startActivity(installIntent);
                    JSObject result = new JSObject();
                    result.put("permissionRequired", false);
                    result.put("installerOpened", true);
                    result.put("version", version);
                    call.resolve(result);
                } catch (Exception error) {
                    call.reject("Android could not open the Fantasy Arena updater", error);
                }
            });
        } catch (Exception error) {
            if (target.exists()) target.delete();
            call.reject("Fantasy Arena update failed: " + safe(error.getMessage()), error);
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private static String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private static String toHex(byte[] bytes) {
        StringBuilder builder = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) builder.append(String.format(Locale.US, "%02x", value & 0xff));
        return builder.toString();
    }
}
