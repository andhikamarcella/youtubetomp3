import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const OLD_VERSION = '1.6.6';
const VERSION = '1.6.7';
const OLD_BRANCH = 'release/ytconv-1.6.6-socket-hardening';
const RELEASE_BRANCH = 'release/ytconv-1.6.7-identity-ui';

const read = (relative) => fs.readFile(path.join(ROOT, relative), 'utf8');
const write = async (relative, content) => {
  const target = path.join(ROOT, relative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content.endsWith('\n') ? content : `${content}\n`, 'utf8');
};

function replaceRequired(source, search, replacement, label) {
  if (!source.includes(search)) throw new Error(`Missing ${label || search}`);
  return source.replace(search, replacement);
}

async function replaceFile(relative, replacements) {
  let source = await read(relative);
  for (const [search, replacement, label] of replacements) {
    source = replaceRequired(source, search, replacement, `${relative}: ${label || search}`);
  }
  await write(relative, source);
}

const manifestPath = 'cli/package.json';
const manifest = JSON.parse(await read(manifestPath));
manifest.version = VERSION;
manifest.description = 'Distinctive secure social-media downloader CLI with Figlet branding, Commander command UX, animated download/conversion progress, browser-login cookie recovery, and native desktop/mobile packages.';
manifest.releaseDate = '2026-08-05';
manifest.releaseNotes = 'YTConv 1.6.7 restores the recognizable Figlet terminal identity, adds Commander-powered command help, uses which/isexe for verified executable discovery, adds animated probing/download/conversion progress, keeps subtitles off by default, improves browser-login cookie recovery for social platforms, and refreshes Android packaging and UI for 2026.';
manifest.licenseUrl = manifest.licenseUrl.replace(OLD_BRANCH, RELEASE_BRANCH);
manifest.homepage = manifest.homepage.replace(OLD_BRANCH, RELEASE_BRANCH);
manifest.documentation = Object.fromEntries(
  Object.entries(manifest.documentation).map(([key, value]) => [key, String(value).replace(OLD_BRANCH, RELEASE_BRANCH)]),
);
manifest.releaseNotesUrl = manifest.releaseNotesUrl.replace(OLD_BRANCH, RELEASE_BRANCH);
manifest.installer = Object.fromEntries(
  Object.entries(manifest.installer).map(([key, value]) => [
    key,
    String(value)
      .replaceAll(OLD_VERSION, VERSION)
      .replaceAll('ytconv-v1.6.6', 'ytconv-v1.6.7'),
  ]),
);
manifest.dependencies = {
  commander: '15.0.0',
  figlet: '1.11.4',
  ink: '7.1.1',
  isexe: '4.0.0',
  react: '19.2.8',
  which: '6.0.0',
  ws: '8.21.1',
};
manifest.keywords = [...new Set([
  ...manifest.keywords,
  'commander',
  'figlet',
  'which',
  'isexe',
  'animated-progress',
  'browser-login',
])];
await write(manifestPath, JSON.stringify(manifest, null, 2));

await write('cli/src/branding.js', `import figlet from 'figlet';

const BRAND = 'YTCONV';
const PREFERRED_FONTS = ['ANSI Shadow', 'Slant', 'Standard'];

export function renderBrand({ compact = false, tiny = false, width = 80 } = {}) {
  if (tiny) return BRAND;
  if (compact) return \`\${BRAND} · social media downloader\`;

  for (const font of PREFERRED_FONTS) {
    try {
      return figlet.textSync(BRAND, {
        font,
        horizontalLayout: 'fitted',
        verticalLayout: 'fitted',
        width: Math.max(40, Number(width) || 80),
        whitespaceBreak: true,
      }).trimEnd();
    } catch {
      // Try the next bundled font. The plain brand is the final fallback.
    }
  }

  return BRAND;
}
`);

await write('cli/src/progress-ui.js', `const FRAMES = Object.freeze(['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']);

export function spinnerFrame(index = 0) {
  const normalized = Math.abs(Number(index) || 0) % FRAMES.length;
  return FRAMES[normalized];
}

export function progressPhase(stage = '', statusText = '') {
  const value = String(statusText);
  if (/convert|extractaudio|merger|remux|ffmpeg|post-process|thumbnail/iu.test(value)) return 'Converting';
  if (stage === 'probing') return 'Checking link';
  if (stage === 'downloading') return 'Downloading';
  return 'Working';
}

export function progressSummary(progress = {}) {
  return [
    progress.percent || '0%',
    progress.speed || '',
    progress.eta ? \`ETA \${progress.eta}\` : '',
  ].filter(Boolean).join(' · ');
}
`);

await write('cli/src/command-program.js', `import { Command } from 'commander';

function buildProgram(version) {
  const program = new Command();
  program
    .name('ytconv')
    .description('Download and convert media from YouTube and supported social platforms.')
    .version(version, '-v, --version', 'print the installed YTConv version')
    .option('-h, --help', 'show complete command help')
    .option('--audio', 'download or convert to audio')
    .option('--video', 'download or convert to video')
    .option('--image', 'download images or social-media galleries')
    .option('--platform <name>', 'select a social platform or AUTO detection')
    .option('--cookies-browser <browser>', 'read an authenticated browser session when required')
    .option('--subtitles', 'enable subtitles (off by default)')
    .option('--no-update-check', 'skip the non-blocking update check')
    .allowUnknownOption(true)
    .allowExcessArguments(true)
    .showHelpAfterError();

  program.addHelpText('after', \`
Examples:
  ytconv
  ytconv "https://youtu.be/..." --video
  ytconv "https://www.instagram.com/reel/..." --platform instagram
  ytconv login instagram
  ytconv social help

Privacy:
  Public access is attempted first. Browser login is requested only when a provider
  requires authentication. Passwords and OTP codes are never entered into YTConv.
\`);
  return program;
}

export function commanderHelpText(version) {
  return buildProgram(version).helpInformation().trimEnd();
}
`);

await write('cli/src/command-path.js', `import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { isexe } from 'isexe';
import { which } from 'which';

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function pathImplementation(platform) {
  return platform === 'win32' ? path.win32 : path.posix;
}

function windowsExtensions(environment) {
  const configured = String(environment.PATHEXT || '.COM;.EXE;.BAT;.CMD')
    .split(';')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => value.startsWith('.') ? value : \`.\${value}\`);
  return unique(['', ...configured, ...configured.map((value) => value.toLowerCase())]);
}

async function portableExecutable(candidate, platform, environment) {
  if (platform === process.platform) {
    return isexe(candidate, {
      ignoreErrors: true,
      pathExt: platform === 'win32' ? String(environment.PATHEXT || '') : undefined,
    });
  }

  try {
    const stats = await fs.stat(candidate);
    if (!stats.isFile()) return false;
    if (platform === 'win32') return true;
    await fs.access(candidate, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function candidateNames(name, platform, environment, pathApi) {
  if (platform !== 'win32' || pathApi.extname(name)) return [name];
  return windowsExtensions(environment).map((extension) => \`\${name}\${extension}\`);
}

async function resolveWithWhich(name, environment) {
  try {
    return await which(name, {
      nothrow: true,
      path: String(environment.PATH || environment.Path || environment.path || ''),
      pathExt: String(environment.PATHEXT || ''),
    });
  } catch {
    return null;
  }
}

export async function resolveCommandPath(names, {
  environment = process.env,
  platform = process.platform,
  currentDirectory = process.cwd(),
} = {}) {
  const requested = Array.isArray(names) ? names : [names];
  const pathApi = pathImplementation(platform);
  const delimiter = platform === 'win32' ? ';' : ':';
  const searchPath = String(environment.PATH || environment.Path || environment.path || '');
  const directories = unique(searchPath.split(delimiter).map((directory) => directory.trim()).filter(Boolean));

  for (const rawName of requested) {
    const name = String(rawName || '').trim();
    if (!name || name.includes('\\0')) continue;
    const explicitPath = pathApi.isAbsolute(name) || name.includes('/') || name.includes('\\\\');

    if (!explicitPath && platform === process.platform) {
      const resolved = await resolveWithWhich(name, environment);
      if (resolved && await portableExecutable(resolved, platform, environment)) return resolved;
    }

    const bases = explicitPath ? [''] : directories;
    for (const base of bases) {
      for (const candidateName of candidateNames(name, platform, environment, pathApi)) {
        const candidate = explicitPath
          ? pathApi.resolve(currentDirectory, candidateName)
          : pathApi.join(base, candidateName);
        if (await portableExecutable(candidate, platform, environment)) return candidate;
      }
    }
  }
  return null;
}
`);

let ui = await read('cli/src/ui.js');
ui = replaceRequired(
  ui,
  "import { Box, Text, render, useApp, useInput } from 'ink';\n",
  "import { Box, Text, render, useApp, useInput } from 'ink';\nimport { renderBrand } from './branding.js';\nimport { progressPhase, progressSummary, spinnerFrame } from './progress-ui.js';\n",
  'ui branding imports',
);
ui = ui.replace(/const LOGO_WIDE = \[[\s\S]*?const LOGO_COMPACT = 'YTCONV';\n\n/u, '');
ui = ui.replace(
  /function Logo\(\{ compact, tiny, account, showTagline \}\) \{[\s\S]*?\n\}\n\nfunction HomeScreen/u,
  `function Logo({ compact, tiny, account, showTagline }) {
  const logo = renderBrand({ compact, tiny, width: process.stdout.columns || 80 });
  return h(
    Box,
    { flexDirection: 'column', alignItems: 'center' },
    h(Text, { bold: true }, logo),
    showTagline ? h(Text, { bold: true }, 'paste a social link · download · convert · done') : null,
    showTagline && !tiny ? h(Text, { dimColor: true }, 'YouTube · Instagram · Facebook · TikTok · X · Pinterest · Reddit · 30+ platforms') : null,
    h(Box, { marginTop: tiny ? 0 : 1 },
      h(Text, { bold: true }, \`● \${safeText(account || 'local user', 160)}\`),
      h(Text, { dimColor: true }, \` · private browser recovery · v\${CLI_VERSION}\`)),
  );
}

function HomeScreen`,
);
ui = ui.replace(
  /function WorkingScreen\(\{ stage, media, progress, statusText, panelWidth \}\) \{[\s\S]*?\n\}\n\nfunction DoneScreen/u,
  `function WorkingScreen({ stage, media, progress, statusText, panelWidth }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((current) => current + 1), 90);
    return () => clearInterval(timer);
  }, []);

  const phase = progressPhase(stage, statusText);
  const percent = progress.percent || '0%';
  const width = Math.max(10, Math.min(42, panelWidth - 6));

  return h(
    Box,
    { flexDirection: 'column', alignItems: 'center', marginTop: 1, width: panelWidth },
    h(MediaCard, { media, panelWidth }),
    h(Box, {
      marginTop: 1,
      width: panelWidth,
      borderStyle: 'round',
      paddingX: 1,
      flexDirection: 'column',
      alignItems: 'center',
    },
    h(Text, { bold: true }, \`\${spinnerFrame(tick)} \${phase}\`),
    h(Text, { bold: true }, progressBar(percent, width)),
    h(Text, { dimColor: true }, progressSummary(progress)),
    h(Text, { wrap: 'truncate-end' }, safeText(statusText || (stage === 'probing'
      ? 'detecting platform and selecting the best engine'
      : 'downloading media and preparing the selected output'))),
    h(Text, { dimColor: true }, stage === 'probing'
      ? 'Public access is checked first; browser login appears only when required.'
      : 'Download and conversion progress update automatically.'),
    ),
    h(Text, { dimColor: true }, 'Esc/Ctrl+C cancels safely'),
  );
}

function DoneScreen`,
);
ui = ui.replace(
  /function logoLines\(\{ compactLogo, tinyLogo \}\) \{[\s\S]*?\n\}/u,
  `function logoLines({ compactLogo, tinyLogo }) {
  return renderBrand({
    compact: compactLogo,
    tiny: tinyLogo,
    width: process.stdout.columns || 80,
  }).split('\\n').filter(Boolean).length;
}`,
);
ui = replaceRequired(
  ui,
  "              if (/Saved:/u.test(line)) setStatusText(line);\n              else if (/gallery|image|carousel|Merger|ExtractAudio|VideoRemuxer|SponsorBlock/iu.test(line)) setStatusText(line);",
  "              if (/Saved:|Destination:|Downloading/iu.test(line)) setStatusText(line);\n              else if (/gallery|image|carousel|Merger|ExtractAudio|VideoRemuxer|FFmpeg|Converting|SponsorBlock/iu.test(line)) setStatusText(line);",
  'progress log status',
);
await write('cli/src/ui.js', ui);

await replaceFile('cli/bin/ytconv.js', [
  [
    "import { commandSummaryText, normalizeCommandArgs } from '../src/commands.js';\n",
    "import { commandSummaryText, normalizeCommandArgs } from '../src/commands.js';\nimport { commanderHelpText } from '../src/command-program.js';\n",
    'Commander import',
  ],
  [
    "function fullHelpText() {\n  return `${commandSummaryText()}${stableDefaultsHelpText()}${userDataHelpText()}${helpText()}\\n${systemHelpText()}`;\n}",
    "function fullHelpText() {\n  return `${commanderHelpText(CLI_VERSION)}\\n\\n${commandSummaryText()}${stableDefaultsHelpText()}${userDataHelpText()}${helpText()}\\n${systemHelpText()}`;\n}",
    'Commander help',
  ],
]);

const versionFiles = [
  '.github/workflows/ytconv-cli.yml',
  '.github/workflows/ytconv-packages.yml',
  'android-app/README.md',
  'cli/README.md',
  'cli/SECURITY.md',
  'cli/docs/PACKAGES.md',
  'cli/ish/VERSION',
  'cli/ish/ytconv-core.py',
  'cli/ish/ytconv.py',
  'cli/scripts/install-ish.sh',
  'cli/scripts/install-termux.sh',
  'cli/scripts/install-unix.sh',
  'cli/scripts/install-windows.cmd',
  'cli/scripts/install-windows.ps1',
  'cli/scripts/test-ish.py',
  'flake.nix',
  'packaging/alpine/APKBUILD',
  'packaging/build-alpine-apk.sh',
  'packaging/build-android-apk.sh',
  'packaging/build-portable-linux.sh',
  'packaging/build-termux-deb.sh',
  'packaging/build-windows-exe.ps1',
  'packaging/flatpak/io.github.andhikamarcella.YTConv.metainfo.xml',
  'packaging/gentoo/ytconv-1.6.5.ebuild.in',
  'packaging/homebrew/ytconv.rb.in',
  'packaging/nix/ytconv.nix',
  'packaging/patch-core-and-lock.mjs',
  'packaging/snap/snap.yaml',
  'packaging/update-release-docs.mjs',
  'packaging/void/template.in',
  'packaging/windows/install.ps1',
  'packaging/windows/installer.go',
];

for (const relative of versionFiles) {
  try {
    let source = await read(relative);
    source = source
      .replaceAll(OLD_BRANCH, RELEASE_BRANCH)
      .replaceAll('ytconv-v1.6.6', 'ytconv-v1.6.7')
      .replaceAll('YTConv 1.6.6', 'YTConv 1.6.7')
      .replaceAll('1.6.6', '1.6.7');
    await write(relative, source);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

await replaceFile('android-app/app/build.gradle', [
  ["versionCode 10605", "versionCode 10607", 'Android versionCode'],
  ["versionName '1.6.6'", "versionName '1.6.7'", 'Android versionName'],
]);

await write('android-app/app/src/main/java/io/github/andhikamarcella/ytconv/MainActivity.java', `package io.github.andhikamarcella.ytconv;

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
        help.setText("Paste a supported social-media URL. Public access is attempted first. Use Login only when the provider requires an authenticated session. Subtitles stay off by default.");
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
                new String[]{"AUTO best available", "MP4 video", "MP3 audio"}
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

        TextView footer = new TextView(this);
        footer.setText("© 2026 YTConv Project · Android " + BuildConfig.VERSION_NAME);
        footer.setTextSize(13);
        footer.setTextColor(0xFF666666);
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
                rows.add("." + host + "\\tTRUE\\t/\\t" + (secure ? "TRUE" : "FALSE")
                        + "\\t" + expires + "\\t" + name + "\\t" + cookieValue);
            }
        }

        if (rows.size() <= 2) throw new IOException("No login cookies were available yet.");
        try (FileWriter writer = new FileWriter(target, false)) {
            for (String row : rows) writer.write(row + "\\n");
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
                String phase = line != null && line.matches("(?i).*(merger|extractaudio|ffmpeg|remux|convert).*")
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
                    if (message.matches("(?i).*(login|cookie|authentication|private|sign in).*") ) {
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
`);

await replaceFile('cli/test/package-metadata.test.js', [
  ["const releaseBranch = 'release/ytconv-1.6.6-socket-hardening';", "const releaseBranch = 'release/ytconv-1.6.7-identity-ui';"],
  ["test('1.6.6 exposes complete secure typed multi-package metadata'", "test('1.6.7 exposes complete secure typed multi-package metadata'"],
  ["assert.equal(manifest.version, '1.6.6');", "assert.equal(manifest.version, '1.6.7');"],
  ["https://registry.npmjs.org/ytconv/-/ytconv-1.6.6.tgz", "https://registry.npmjs.org/ytconv/-/ytconv-1.6.7.tgz"],
  ["releases/tag/ytconv-v1.6.6", "releases/tag/ytconv-v1.6.7"],
  ["/ytconv-v1\\.6\\.6\\/SHA256SUMS\\.txt$/u", "/ytconv-v1\\.6\\.7\\/SHA256SUMS\\.txt$/u"],
  ["['ink', 'react', 'ws']", "['commander', 'figlet', 'ink', 'isexe', 'react', 'which', 'ws']"],
  ["'1.6.6');", "'1.6.7');"],
  ["/release\\/ytconv-1\\.6\\.6-socket-hardening/u", "/release\\/ytconv-1\\.6\\.7-identity-ui/u"],
  ["/VERSION=\"1\\.6\\.6\"/u", "/VERSION=\"1\\.6\\.7\"/u"],
  ["/blob\\/release\\/ytconv-1\\.6\\.6-socket-hardening\\/cli\\/docs\\/", "/blob\\/release\\/ytconv-1\\.6\\.7-identity-ui\\/cli\\/docs\\/"],
  ["'the 1.6.6 release branch must not contain", "'the 1.6.7 release branch must not contain"],
]);

await replaceFile('cli/test/supply-chain.test.js', [
  ["test('1.6.6 publishes recognized license types", "test('1.6.7 publishes recognized license types"],
  ["assert.equal(manifest.version, '1.6.6');", "assert.equal(manifest.version, '1.6.7');"],
  ["/badge\\.socket\\.dev\\/npm\\/package\\/ytconv\\/1\\.6\\.6/u", "/badge\\.socket\\.dev\\/npm\\/package\\/ytconv\\/1\\.6\\.7/u"],
]);

await write('cli/test/identity-ui.test.js', `import assert from 'node:assert/strict';
import test from 'node:test';
import { renderBrand } from '../src/branding.js';
import { commanderHelpText } from '../src/command-program.js';
import { parseCliOptions } from '../src/cli-options.js';
import { progressPhase, spinnerFrame } from '../src/progress-ui.js';

test('1.6.7 restores a recognizable Figlet terminal identity', () => {
  const brand = renderBrand({ width: 120 });
  assert.match(brand, /Y|T|C|O|N|V/u);
  assert.ok(brand.split('\\n').length >= 2);
});

test('Commander help documents social downloads and browser login', () => {
  const help = commanderHelpText('1.6.7');
  assert.match(help, /ytconv/u);
  assert.match(help, /social platforms/u);
  assert.match(help, /cookies-browser/u);
  assert.match(help, /Subtitles.*off by default/iu);
});

test('subtitles remain disabled unless explicitly requested', () => {
  assert.equal(parseCliOptions([]).subtitles, false);
  assert.equal(parseCliOptions(['--subtitles']).subtitles, true);
});

test('animated progress distinguishes checking downloading and conversion', () => {
  assert.notEqual(spinnerFrame(0), spinnerFrame(1));
  assert.equal(progressPhase('probing', ''), 'Checking link');
  assert.equal(progressPhase('downloading', ''), 'Downloading');
  assert.equal(progressPhase('downloading', '[ExtractAudio] converting'), 'Converting');
});
`);

let changelog = await read('cli/CHANGELOG.md');
if (!changelog.includes('## 1.6.7')) {
  const heading = `## 1.6.7 - 2026-08-05

- Restored the distinctive Figlet YTConv terminal logo with responsive compact fallbacks.
- Added Commander-powered help and command discovery without replacing the existing advanced parser.
- Restored verified executable discovery through pinned which and isexe packages while retaining shell-free execution.
- Added animated probing, downloading, merging, audio extraction, remuxing, and image-conversion feedback.
- Kept subtitles disabled by default in CLI, headless, and Android flows.
- Improved social-platform fallback and browser-login recovery; public access remains the first attempt.
- Refreshed the Android app to version 1.6.7 / 2026 with a clearer UI, progress phases, and temporary local WebView cookie export.

`;
  changelog = changelog.replace(/^# Changelog\s*/u, `# Changelog\n\n${heading}`);
  await write('cli/CHANGELOG.md', changelog);
}

let readme = await read('cli/README.md');
readme = readme
  .replaceAll('1.6.6', '1.6.7')
  .replaceAll(OLD_BRANCH, RELEASE_BRANCH);
if (!readme.includes('Figlet')) {
  readme = readme.replace(
    /(^# YTConv[^\n]*\n)/u,
    `$1\nYTConv 1.6.7 restores the recognizable Figlet terminal identity, Commander-powered help, animated download/conversion progress, and browser-login recovery for social platforms while keeping subtitles off by default.\n`,
  );
}
await write('cli/README.md', readme);

const security = await read('cli/SECURITY.md');
await write('cli/SECURITY.md', security
  .replaceAll('1.6.6', '1.6.7')
  .replaceAll(OLD_BRANCH, RELEASE_BRANCH)
  + `\n## 1.6.7 user-interface dependencies\n\nFiglet, Commander, which, and isexe are pinned to exact versions. They do not add install lifecycle hooks, do not enable shell execution, and are covered by the release test and npm audit gates.\n`);

console.log('Prepared YTConv 1.6.7 source changes.');
