package io.github.andhikamarcella.ytconv;

import android.Manifest;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.text.TextUtils;
import android.view.View;
import android.webkit.CookieManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.yausername.ffmpeg.FFmpeg;
import com.yausername.youtubedl_android.YoutubeDL;
import com.yausername.youtubedl_android.YoutubeDLException;
import com.yausername.youtubedl_android.YoutubeDLRequest;

import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.util.Arrays;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

import kotlin.Unit;
import kotlin.jvm.functions.Function3;

public final class MainActivity extends AppCompatActivity {
    private static final String PROCESS_ID = "ytconv-android-download";
    private static final int STORAGE_REQUEST = 1067;
    private static final Set<String> MEDIA_EXTENSIONS = new HashSet<>(Arrays.asList(
            "mp3", "m4a", "aac", "opus", "ogg", "flac", "wav",
            "mp4", "mkv", "webm", "mov", "m4v",
            "jpg", "jpeg", "png", "webp", "gif"
    ));

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final AtomicBoolean downloading = new AtomicBoolean(false);
    private EditText urlInput;
    private Spinner modeSpinner;
    private Button downloadButton;
    private Button loginButton;
    private Button stopButton;
    private ProgressBar progressBar;
    private TextView statusView;
    private File browserCookieFile;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setTitle("YTConv " + BuildConfig.VERSION_NAME);
        setContentView(buildContentView());
        initializeEngines();
        applySharedUrl(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        applySharedUrl(intent);
    }

    private View buildContentView() {
        int padding = Math.round(20 * getResources().getDisplayMetrics().density);
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(padding, padding, padding, padding);

        TextView heading = new TextView(this);
        heading.setText("YTConv " + BuildConfig.VERSION_NAME);
        heading.setTextSize(28);
        heading.setTextColor(0xFF111111);
        content.addView(heading, matchWrap());

        TextView tagline = new TextView(this);
        tagline.setText("Social media downloader · private browser login · local conversion");
        tagline.setTextSize(16);
        tagline.setPadding(0, 0, 0, padding / 2);
        content.addView(tagline, matchWrap());

        TextView help = new TextView(this);
        help.setText("Paste a supported social-media URL. Public access is attempted first. Use Browser login only when the provider requires an authenticated session. Subtitles stay off by default.");
        help.setTextSize(15);
        help.setPadding(0, 0, 0, padding);
        content.addView(help, matchWrap());

        urlInput = new EditText(this);
        urlInput.setHint("https://youtube.com/…  https://instagram.com/…");
        urlInput.setSingleLine(false);
        urlInput.setMinLines(2);
        content.addView(urlInput, matchWrap());

        modeSpinner = new Spinner(this);
        ArrayAdapter<String> adapter = new ArrayAdapter<>(
                this,
                android.R.layout.simple_spinner_dropdown_item,
                new String[]{"AUTO best available", "MP4 video", "MP3 audio", "Images / gallery"}
        );
        modeSpinner.setAdapter(adapter);
        content.addView(modeSpinner, matchWrap());

        LinearLayout actions = new LinearLayout(this);
        actions.setOrientation(LinearLayout.HORIZONTAL);
        actions.setPadding(0, padding / 2, 0, padding / 2);

        downloadButton = new Button(this);
        downloadButton.setText("Download");
        downloadButton.setOnClickListener(view -> startDownload());
        actions.addView(downloadButton, weightedWrap());

        loginButton = new Button(this);
        loginButton.setText("Browser login");
        loginButton.setOnClickListener(view -> openBrowserLogin());
        actions.addView(loginButton, weightedWrap());

        stopButton = new Button(this);
        stopButton.setText("Stop");
        stopButton.setEnabled(false);
        stopButton.setOnClickListener(view -> stopDownload());
        actions.addView(stopButton, weightedWrap());
        content.addView(actions, matchWrap());

        progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setMax(100);
        content.addView(progressBar, matchWrap());

        statusView = new TextView(this);
        statusView.setText("Initializing bundled yt-dlp and FFmpeg...");
        statusView.setTextIsSelectable(true);
        statusView.setPadding(0, padding / 2, 0, padding);
        content.addView(statusView, matchWrap());

        TextView providers = new TextView(this);
        providers.setText("AUTO supports yt-dlp providers including YouTube, Instagram, Facebook, TikTok, X, Reddit, Pinterest, Threads, Twitch, SoundCloud, Vimeo, Bilibili and more.");
        providers.setTextSize(13);
        providers.setTextColor(0xFF555555);
        content.addView(providers, matchWrap());

        TextView footer = new TextView(this);
        footer.setText("© 2026 YTConv Project · Android " + BuildConfig.VERSION_NAME
                + " · help.ytconv@proton.me");
        footer.setTextSize(13);
        footer.setTextColor(0xFF666666);
        footer.setPadding(0, padding, 0, 0);
        content.addView(footer, matchWrap());

        ScrollView scroll = new ScrollView(this);
        scroll.addView(content);
        return scroll;
    }

    private LinearLayout.LayoutParams matchWrap() {
        return new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
    }

    private LinearLayout.LayoutParams weightedWrap() {
        return new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
    }

    private void initializeEngines() {
        progressBar.setIndeterminate(true);
        executor.submit(() -> {
            try {
                YoutubeDL.getInstance().init(getApplicationContext());
                FFmpeg.getInstance().init(getApplicationContext());
                runOnUiThread(() -> {
                    progressBar.setIndeterminate(false);
                    statusView.setText("Ready. Downloads are saved to Download/YTConv.");
                });
            } catch (YoutubeDLException error) {
                runOnUiThread(() -> {
                    progressBar.setIndeterminate(false);
                    showError("Engine initialization failed: " + safeMessage(error));
                });
            }
        });
    }

    private void applySharedUrl(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;
        CharSequence text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
        if (text != null) urlInput.setText(text.toString().trim());
    }

    private void openBrowserLogin() {
        String mediaUrl = urlInput.getText().toString().trim();
        if (!validHttpUrl(mediaUrl)) {
            urlInput.setError("Enter the media URL before opening browser login.");
            return;
        }

        String loginUrl = loginUrlFor(mediaUrl);
        WebView webView = new WebView(this);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.setWebViewClient(new WebViewClient());
        CookieManager manager = CookieManager.getInstance();
        manager.setAcceptCookie(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            manager.setAcceptThirdPartyCookies(webView, true);
        }

        AlertDialog dialog = new AlertDialog.Builder(this)
                .setTitle("Official browser login")
                .setMessage("Finish login, OTP, or 2FA in this local browser window. Then tap Use session.")
                .setView(webView)
                .setPositiveButton("Use session", null)
                .setNegativeButton("Cancel", (value, which) -> webView.destroy())
                .create();

        dialog.setOnShowListener(ignored -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(view -> {
            try {
                browserCookieFile = exportBrowserCookies(mediaUrl, loginUrl, webView.getUrl());
                statusView.setText("Browser session saved temporarily for this app. Start the download again.");
                Toast.makeText(this, "Authenticated browser session ready", Toast.LENGTH_LONG).show();
                dialog.dismiss();
                webView.destroy();
            } catch (Exception error) {
                showError("Could not save browser session: " + safeMessage(error));
            }
        }));

        dialog.show();
        webView.loadUrl(loginUrl);
    }

    private File exportBrowserCookies(String... urls) throws IOException {
        CookieManager manager = CookieManager.getInstance();
        manager.flush();
        File target = new File(getCacheDir(), "ytconv-browser-cookies.txt");
        long expires = (System.currentTimeMillis() / 1000L) + (30L * 24L * 60L * 60L);
        Set<String> rows = new LinkedHashSet<>();
        rows.add("# Netscape HTTP Cookie File");
        rows.add("# Generated locally by YTConv Android. Deleted when the app closes.");

        for (String value : urls) {
            if (!validHttpUrl(value)) continue;
            Uri uri = Uri.parse(value);
            String host = uri.getHost();
            String raw = manager.getCookie(value);
            if (TextUtils.isEmpty(host) || TextUtils.isEmpty(raw)) continue;
            boolean secure = "https".equalsIgnoreCase(uri.getScheme());
            for (String item : raw.split(";")) {
                String cookie = item.trim();
                int separator = cookie.indexOf('=');
                if (separator <= 0) continue;
                String name = cookie.substring(0, separator).trim();
                String cookieValue = cookie.substring(separator + 1).trim();
                if (name.isEmpty()) continue;
                rows.add("." + host + "\tTRUE\t/\t" + (secure ? "TRUE" : "FALSE")
                        + "\t" + expires + "\t" + name + "\t" + cookieValue);
            }
        }

        if (rows.size() <= 2) throw new IOException("No login cookies were available yet.");
        try (FileWriter writer = new FileWriter(target, false)) {
            for (String row : rows) writer.write(row + "\n");
        }
        target.setReadable(true, true);
        target.setWritable(true, true);
        return target;
    }

    private String loginUrlFor(String mediaUrl) {
        String host = Uri.parse(mediaUrl).getHost();
        String value = host == null ? "" : host.toLowerCase(Locale.ROOT);
        if (value.contains("instagram.com")) return "https://www.instagram.com/accounts/login/";
        if (value.contains("facebook.com") || value.equals("fb.watch")) return "https://www.facebook.com/login/";
        if (value.contains("tiktok.com")) return "https://www.tiktok.com/login";
        if (value.equals("x.com") || value.contains("twitter.com")) return "https://x.com/i/flow/login";
        if (value.contains("reddit.com") || value.equals("redd.it")) return "https://www.reddit.com/login/";
        if (value.contains("pinterest.com") || value.equals("pin.it")) return "https://www.pinterest.com/login/";
        if (value.contains("threads.net") || value.contains("threads.com")) return "https://www.threads.net/login";
        if (value.contains("linkedin.com")) return "https://www.linkedin.com/login";
        if (value.contains("bilibili.com")) return "https://passport.bilibili.com/login";
        return mediaUrl;
    }

    private void startDownload() {
        if (!downloading.compareAndSet(false, true)) {
            Toast.makeText(this, "A download is already running.", Toast.LENGTH_SHORT).show();
            return;
        }
        if (!storagePermissionReady()) {
            downloading.set(false);
            return;
        }

        String url = urlInput.getText().toString().trim();
        if (!validHttpUrl(url)) {
            downloading.set(false);
            urlInput.setError("Enter a valid http:// or https:// URL.");
            return;
        }

        File output = new File(
                Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
                "YTConv"
        );
        if (!output.exists() && !output.mkdirs()) {
            downloading.set(false);
            showError("Cannot create " + output.getAbsolutePath());
            return;
        }

        String mode = selectedMode(url);
        YoutubeDLRequest request = buildRequest(url, output, mode);
        long startedAt = System.currentTimeMillis() - 1000L;
        setRunning(true, "Starting " + mode.toUpperCase(Locale.ROOT) + " download...");

        Function3<Float, Long, String, Unit> callback = (progress, etaSeconds, line) -> {
            runOnUiThread(() -> {
                progressBar.setProgress(Math.max(0, Math.min(100, Math.round(progress))));
                String eta = etaSeconds != null && etaSeconds >= 0 ? " · ETA " + etaSeconds + "s" : "";
                String phase = line != null && line.matches("(?i).*(merger|extractaudio|ffmpeg|remux|convert|thumbnail).*")
                        ? "Converting · " : "Downloading · ";
                statusView.setText(phase + (line == null || line.isBlank() ? "please wait" : line) + eta);
            });
            return Unit.INSTANCE;
        };

        executor.submit(() -> {
            try {
                YoutubeDL.getInstance().execute(request, PROCESS_ID, callback);
                File result = newestMedia(output, startedAt, mode);
                if (result == null) {
                    throw new IllegalStateException("The engine exited without creating a verified media file.");
                }
                runOnUiThread(() -> {
                    setRunning(false, "Completed: " + result.getAbsolutePath());
                    progressBar.setProgress(100);
                    Toast.makeText(this, "Download completed", Toast.LENGTH_LONG).show();
                });
            } catch (Exception error) {
                runOnUiThread(() -> {
                    setRunning(false, "Failed: " + safeMessage(error));
                    String message = safeMessage(error);
                    if (message.matches("(?i).*(login|cookie|authentication|private|sign in).*")) {
                        message += " Use Browser login, finish the official sign-in, then retry.";
                    }
                    showError(message);
                });
            } finally {
                downloading.set(false);
            }
        });
    }

    private YoutubeDLRequest buildRequest(String url, File output, String mode) {
        YoutubeDLRequest request = new YoutubeDLRequest(url);
        request.addOption("--ignore-config");
        request.addOption("--no-colors");
        request.addOption("--no-remote-components");
        request.addOption("--newline");
        request.addOption("--no-playlist");
        request.addOption("--no-write-subs");
        request.addOption("--socket-timeout", "30");
        request.addOption("--retries", "10");
        request.addOption("--fragment-retries", "10");
        request.addOption("--output", new File(output, "%(title).180B [%(id)s].%(ext)s").getAbsolutePath());
        request.addOption("--embed-metadata");
        request.addOption("--embed-chapters");
        if (browserCookieFile != null && browserCookieFile.isFile() && browserCookieFile.length() > 0) {
            request.addOption("--cookies", browserCookieFile.getAbsolutePath());
        }

        if ("mp3".equals(mode)) {
            request.addOption("-f", "ba/b");
            request.addOption("--extract-audio");
            request.addOption("--audio-format", "mp3");
            request.addOption("--audio-quality", "0");
            request.addOption("--write-thumbnail");
            request.addOption("--convert-thumbnails", "jpg");
            request.addOption("--embed-thumbnail");
        } else if ("image".equals(mode)) {
            request.addOption("--skip-download");
            request.addOption("--write-all-thumbnails");
            request.addOption("--convert-thumbnails", "jpg");
        } else {
            request.addOption("-f", "bv*[height<=1080]+ba/b[height<=1080]/best");
            request.addOption("--merge-output-format", "mp4");
            request.addOption("--recode-video", "mp4");
        }
        return request;
    }

    private String selectedMode(String url) {
        int selected = modeSpinner.getSelectedItemPosition();
        if (selected == 1) return "mp4";
        if (selected == 2) return "mp3";
        if (selected == 3) return "image";
        Uri parsed = Uri.parse(url);
        String host = parsed.getHost();
        return host != null && host.equalsIgnoreCase("music.youtube.com") ? "mp3" : "mp4";
    }

    private void stopDownload() {
        try {
            YoutubeDL.getInstance().destroyProcessById(PROCESS_ID);
            statusView.setText("Stopping download safely...");
        } catch (Exception error) {
            showError("Could not stop: " + safeMessage(error));
        }
    }

    private boolean storagePermissionReady() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) return true;
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE)
                == PackageManager.PERMISSION_GRANTED) return true;
        ActivityCompat.requestPermissions(
                this,
                new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE},
                STORAGE_REQUEST
        );
        return false;
    }

    @Override
    public void onRequestPermissionsResult(
            int requestCode,
            @NonNull String[] permissions,
            @NonNull int[] grantResults
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == STORAGE_REQUEST && grantResults.length > 0
                && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            startDownload();
        } else if (requestCode == STORAGE_REQUEST) {
            showError("Storage permission is required on this Android version.");
        }
    }

    private void setRunning(boolean running, String message) {
        downloadButton.setEnabled(!running);
        loginButton.setEnabled(!running);
        stopButton.setEnabled(running);
        if (!running && progressBar.getProgress() < 100) progressBar.setProgress(0);
        statusView.setText(message);
    }

    private File newestMedia(File directory, long startedAt, String mode) {
        File newest = null;
        File[] files = directory.listFiles();
        if (files == null) return null;
        for (File file : files) {
            if (file.isDirectory()) {
                File nested = newestMedia(file, startedAt, mode);
                if (nested != null && (newest == null || nested.lastModified() > newest.lastModified())) newest = nested;
                continue;
            }
            String name = file.getName();
            int dot = name.lastIndexOf('.');
            String extension = dot >= 0 ? name.substring(dot + 1).toLowerCase(Locale.ROOT) : "";
            if (!MEDIA_EXTENSIONS.contains(extension) || file.length() <= 0 || file.lastModified() < startedAt) continue;
            if ("mp3".equals(mode) && !extension.equals("mp3")) continue;
            if ("mp4".equals(mode) && !(extension.equals("mp4") || extension.equals("mkv") || extension.equals("webm"))) continue;
            if ("image".equals(mode) && !(extension.equals("jpg") || extension.equals("jpeg") || extension.equals("png") || extension.equals("webp") || extension.equals("gif"))) continue;
            if (newest == null || file.lastModified() > newest.lastModified()) newest = file;
        }
        return newest;
    }

    private boolean validHttpUrl(String value) {
        if (TextUtils.isEmpty(value)) return false;
        Uri uri = Uri.parse(value);
        return ("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme()))
                && !TextUtils.isEmpty(uri.getHost());
    }

    private String safeMessage(Throwable error) {
        String value = error.getMessage();
        return value == null || value.isBlank() ? error.getClass().getSimpleName() : value;
    }

    private void showError(String message) {
        Toast.makeText(this, message, Toast.LENGTH_LONG).show();
    }

    @Override
    protected void onDestroy() {
        try {
            YoutubeDL.getInstance().destroyProcessById(PROCESS_ID);
        } catch (Exception ignored) {
            // No active process.
        }
        if (browserCookieFile != null) browserCookieFile.delete();
        executor.shutdownNow();
        super.onDestroy();
    }
}
