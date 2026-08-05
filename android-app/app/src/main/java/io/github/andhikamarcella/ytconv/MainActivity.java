package io.github.andhikamarcella.ytconv;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.text.TextUtils;
import android.view.View;
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
import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

import kotlin.Unit;
import kotlin.jvm.functions.Function3;

public final class MainActivity extends AppCompatActivity {
    private static final String PROCESS_ID = "ytconv-android-download";
    private static final int STORAGE_REQUEST = 1065;
    private static final Set<String> MEDIA_EXTENSIONS = new HashSet<>(Arrays.asList(
            "mp3", "m4a", "aac", "opus", "ogg", "flac", "wav",
            "mp4", "mkv", "webm", "mov", "m4v"
    ));

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final AtomicBoolean downloading = new AtomicBoolean(false);
    private EditText urlInput;
    private Spinner modeSpinner;
    private Button downloadButton;
    private Button stopButton;
    private ProgressBar progressBar;
    private TextView statusView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setTitle("YTConv 1.6.6");
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
        heading.setText("YTConv – MP4 & MP3 Downloader");
        heading.setTextSize(22);
        heading.setTextColor(0xFF111111);
        content.addView(heading, matchWrap());

        TextView help = new TextView(this);
        help.setText("Paste a public media URL. AUTO uses MP3 for music.youtube.com and MP4 for regular YouTube. No cookies.txt is used by default.");
        help.setTextSize(15);
        help.setPadding(0, padding / 2, 0, padding);
        content.addView(help, matchWrap());

        urlInput = new EditText(this);
        urlInput.setHint("https://www.youtube.com/watch?v=...");
        urlInput.setSingleLine(false);
        urlInput.setMinLines(2);
        content.addView(urlInput, matchWrap());

        modeSpinner = new Spinner(this);
        ArrayAdapter<String> adapter = new ArrayAdapter<>(
                this,
                android.R.layout.simple_spinner_dropdown_item,
                new String[]{"AUTO", "MP4 video", "MP3 audio"}
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
        statusView.setPadding(0, padding / 2, 0, 0);
        content.addView(statusView, matchWrap());

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
        executor.submit(() -> {
            try {
                YoutubeDL.getInstance().init(getApplicationContext());
                FFmpeg.getInstance().init(getApplicationContext());
                runOnUiThread(() -> statusView.setText("Ready. Downloads are saved to Download/YTConv."));
            } catch (YoutubeDLException error) {
                runOnUiThread(() -> showError("Engine initialization failed: " + safeMessage(error)));
            }
        });
    }

    private void applySharedUrl(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;
        CharSequence text = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
        if (text != null) urlInput.setText(text.toString().trim());
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
                statusView.setText((line == null || line.isBlank() ? "Downloading..." : line) + eta);
            });
            return Unit.INSTANCE;
        };

        executor.submit(() -> {
            try {
                YoutubeDL.getInstance().execute(request, PROCESS_ID, callback);
                File result = newestMedia(output, startedAt, mode);
                if (result == null) {
                    throw new IllegalStateException("The engine exited without creating a verified " + mode + " file.");
                }
                runOnUiThread(() -> {
                    setRunning(false, "Completed: " + result.getAbsolutePath());
                    progressBar.setProgress(100);
                    Toast.makeText(this, "Download completed", Toast.LENGTH_LONG).show();
                });
            } catch (Exception error) {
                runOnUiThread(() -> {
                    setRunning(false, "Failed: " + safeMessage(error));
                    showError(safeMessage(error));
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
        request.addOption("--socket-timeout", "30");
        request.addOption("--retries", "10");
        request.addOption("--fragment-retries", "10");
        request.addOption("--output", new File(output, "%(title).180B [%(id)s].%(ext)s").getAbsolutePath());
        request.addOption("--embed-metadata");
        request.addOption("--embed-chapters");

        if ("mp3".equals(mode)) {
            request.addOption("-f", "ba/b");
            request.addOption("--extract-audio");
            request.addOption("--audio-format", "mp3");
            request.addOption("--audio-quality", "0");
            request.addOption("--write-thumbnail");
            request.addOption("--convert-thumbnails", "jpg");
            request.addOption("--embed-thumbnail");
        } else {
            request.addOption(
                    "-f",
                    "bv[height<=1080][ext=mp4][vcodec^=avc1]+ba[ext=m4a]/" +
                            "b[height<=1080][ext=mp4][vcodec^=avc1]/" +
                            "bv[height<=1080][ext=mp4]+ba[ext=m4a]/" +
                            "b[height<=1080][ext=mp4]/bv[height<=1080]+ba/b[height<=1080]"
            );
            request.addOption("--merge-output-format", "mp4");
            request.addOption("--recode-video", "mp4");
        }
        return request;
    }

    private String selectedMode(String url) {
        int selected = modeSpinner.getSelectedItemPosition();
        if (selected == 1) return "mp4";
        if (selected == 2) return "mp3";
        Uri parsed = Uri.parse(url);
        String host = parsed.getHost();
        return host != null && host.equalsIgnoreCase("music.youtube.com") ? "mp3" : "mp4";
    }

    private void stopDownload() {
        try {
            YoutubeDL.getInstance().destroyProcessById(PROCESS_ID);
            statusView.setText("Stopping download...");
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
            if ("mp4".equals(mode) && !extension.equals("mp4")) continue;
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
        executor.shutdownNow();
        super.onDestroy();
    }
}
