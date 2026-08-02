#!/usr/bin/env python3
"""YTConv 1.6.0-beta.1 account frontend for iSH/Alpine."""

import json
import os
import platform
import socket
import sys
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path

VERSION = "1.6.0-beta.1"
API_BASE = os.environ.get("YTCONV_API_BASE", "https://ytconv.onrender.com").rstrip("/")
DIRECTORY = Path(__file__).resolve().parent
TARGET = DIRECTORY / "ytconv-core.py"
if not TARGET.is_file():
    TARGET = DIRECTORY / "ytconv-beta.py"

AUTH_DIR = Path.home() / ".ytconv"
AUTH_FILE = AUTH_DIR / "auth.json"
SAFE_COMMANDS = {
    "help", "doctor", "diagnose", "repair", "setup", "update", "config", "profile",
    "history", "completion", "quickstart", "clean", "clear-cache", "shell-info",
    "self-test", "examples", "presets",
}
SAFE_FLAGS = {
    "--help", "-h", "--version", "-v", "--diagnose", "--doctor", "--repair", "--setup",
    "--check-update", "--update", "--list-presets", "--examples", "--shell-info",
    "--clear-cache", "--self-test",
}


def request_json(endpoint, method="GET", token=None, payload=None, timeout=20):
    body = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {"Accept": "application/json", "User-Agent": "ytconv-ish/%s" % VERSION}
    if body is not None:
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = "Bearer " + token
    request = urllib.request.Request(API_BASE + endpoint, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8", "replace") or "{}")
    except urllib.error.HTTPError as error:
        try:
            data = json.loads(error.read().decode("utf-8", "replace") or "{}")
        except (ValueError, json.JSONDecodeError):
            data = {}
        message = data.get("error") or data.get("message") or "HTTP %s" % error.code
        failure = RuntimeError(message)
        failure.status = error.code
        raise failure
    except urllib.error.URLError as error:
        raise RuntimeError("YTConv account server is unreachable: %s" % error.reason)


def load_auth():
    try:
        value = json.loads(AUTH_FILE.read_text(encoding="utf-8"))
        return value if value.get("accessToken") else None
    except (OSError, ValueError, json.JSONDecodeError):
        return None


def save_auth(value):
    AUTH_DIR.mkdir(parents=True, exist_ok=True)
    temporary = AUTH_FILE.with_name(AUTH_FILE.name + ".tmp")
    temporary.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    os.chmod(str(temporary), 0o600)
    temporary.replace(AUTH_FILE)
    os.chmod(str(AUTH_FILE), 0o600)


def clear_auth():
    try:
        AUTH_FILE.unlink()
    except OSError:
        pass


def account_label(user):
    return user.get("displayName") or user.get("display_name") or user.get("email") or user.get("id") or "YTConv user"


def auth_help():
    print("\nAccount commands:")
    print("  ytconv login")
    print("  ytconv auth status [--json]")
    print("  ytconv auth devices [--json]")
    print("  ytconv auth revoke TOKEN_ID")
    print("  ytconv auth revoke all")
    print("  ytconv auth refresh")
    print("  ytconv logout")
    print("\nDownloads and conversions require an active YTConv account.")
    print("Account server: %s" % API_BASE)


def login():
    device_name = "%s (iSH %s)" % (socket.gethostname() or "iPhone/iPad", platform.machine() or "Alpine")
    device = request_json("/api/cli-auth/device", method="POST", payload={
        "deviceName": device_name,
        "platform": "ish",
        "cliVersion": VERSION,
    })
    device_code = device.get("deviceCode")
    user_code = device.get("userCode")
    verification = device.get("verificationUriComplete") or "%s?code=%s" % (device.get("verificationUri"), user_code)
    if not device_code or not user_code or not verification:
        raise RuntimeError("The account server returned an incomplete login response.")

    print("\n+----------------------------------------------------------+")
    print("| YTConv secure device login                              |")
    print("+----------------------------------------------------------+")
    print("  Code: %s" % user_code)
    print("  Link: %s\n" % verification)
    try:
        webbrowser.open(verification)
    except Exception:
        pass
    print("Finish Google login in Safari or another browser, then return to iSH.")
    print("Waiting for approval... Press Ctrl+C to cancel.")

    interval = max(2, int(device.get("interval") or 4))
    deadline = time.time() + min(600, max(60, int(device.get("expiresIn") or 600)))
    while time.time() < deadline:
        time.sleep(interval)
        try:
            result = request_json("/api/cli-auth/token", method="POST", payload={"deviceCode": device_code})
            token = result.get("accessToken")
            if not token:
                raise RuntimeError("Login was approved without an access token.")
            saved_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            session = {
                "schemaVersion": 2,
                "accessToken": token,
                "tokenId": result.get("tokenId") or "",
                "user": result.get("user") or {},
                "deviceName": device_name,
                "apiBase": API_BASE,
                "savedAt": saved_at,
                "lastValidatedAt": saved_at,
                "lastRotatedAt": saved_at,
                "expiresAt": result.get("expiresAt"),
            }
            save_auth(session)
            print("\nLogin complete. Signed in as %s." % account_label(session["user"]))
            print("Session saved securely in %s" % AUTH_FILE)
            return 0
        except RuntimeError as error:
            status = getattr(error, "status", None)
            if status in (400, 404, 428, 429):
                print(".", end="", flush=True)
                continue
            if status in (403, 410):
                raise RuntimeError("The device login expired or was denied.")
            raise
    raise RuntimeError("The device login expired. Run: ytconv login")


def validate_auth(quiet=False):
    session = load_auth()
    if not session:
        return None
    try:
        current = request_json("/api/cli-auth/me", token=session["accessToken"])
        session["schemaVersion"] = 2
        session["user"] = current.get("user") or session.get("user") or {}
        session["tokenId"] = current.get("tokenId") or session.get("tokenId") or ""
        session["expiresAt"] = current.get("expiresAt") or session.get("expiresAt")
        session["lastValidatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        session["apiBase"] = API_BASE
        save_auth(session)
        return session
    except RuntimeError as error:
        if getattr(error, "status", None) in (401, 403, 410):
            clear_auth()
        if quiet:
            return None
        raise


def require_auth():
    session = validate_auth()
    if not session:
        raise RuntimeError("Login is required. Run: ytconv login")
    return session


def auth_status(as_json=False):
    session = validate_auth(quiet=True)
    if not session:
        if as_json:
            print(json.dumps({"signedIn": False}, indent=2))
        else:
            print("Not signed in. Run: ytconv login")
        return 1
    if as_json:
        print(json.dumps({
            "signedIn": True,
            "user": session.get("user") or {},
            "deviceName": session.get("deviceName"),
            "tokenId": session.get("tokenId"),
            "apiBase": session.get("apiBase", API_BASE),
            "expiresAt": session.get("expiresAt"),
            "lastValidatedAt": session.get("lastValidatedAt"),
            "lastRotatedAt": session.get("lastRotatedAt"),
        }, indent=2, ensure_ascii=False))
        return 0
    user = session.get("user") or {}
    print("YTConv account")
    print("Status      signed in")
    print("Account     %s" % account_label(user))
    if user.get("email"):
        print("Email       %s" % user["email"])
    if user.get("role"):
        print("Role        %s" % user["role"])
    print("Device      %s" % session.get("deviceName", "-"))
    print("Token       %s" % session.get("tokenId", "-"))
    print("API         %s" % session.get("apiBase", API_BASE))
    if session.get("expiresAt"):
        print("Expires     %s" % session["expiresAt"])
    return 0


def auth_devices(as_json=False):
    session = require_auth()
    payload = request_json("/api/cli-auth/devices", token=session["accessToken"])
    devices = payload.get("devices") or []
    if as_json:
        print(json.dumps(payload, indent=2, ensure_ascii=False))
        return 0
    if not devices:
        print("No CLI devices were found for this account.")
        return 0
    print("YTConv signed-in devices\n")
    print("%-8s %-24s %-10s %-13s %s" % ("STATE", "DEVICE", "PLATFORM", "VERSION", "TOKEN ID"))
    print("-" * 90)
    for device in devices:
        state = "CURRENT" if device.get("current") else "ACTIVE" if device.get("active") else "REVOKED" if device.get("revokedAt") else "EXPIRED"
        name = str(device.get("deviceName") or "-")[:24]
        print("%-8s %-24s %-10s %-13s %s" % (
            state, name, str(device.get("platform") or "-")[:10],
            str(device.get("cliVersion") or "-")[:13], device.get("tokenId") or "-",
        ))
    print("\nRevoke another device: ytconv auth revoke TOKEN_ID")
    print("Revoke every other device: ytconv auth revoke all")
    return 0


def auth_revoke(target):
    session = require_auth()
    value = str(target or "").strip()
    if not value:
        raise RuntimeError("auth revoke requires TOKEN_ID or all")
    payload = {"all": True} if value.lower() == "all" else {"tokenId": value}
    result = request_json("/api/cli-auth/revoke", method="POST", token=session["accessToken"], payload=payload)
    count = len(result.get("revoked") or [])
    print("Revoked %s YTConv device session%s." % (count, "" if count == 1 else "s"))
    return 0


def auth_refresh():
    session = require_auth()
    result = request_json("/api/cli-auth/refresh", method="POST", token=session["accessToken"])
    token = result.get("accessToken")
    if not token:
        raise RuntimeError("The account server did not return a refreshed token.")
    session["schemaVersion"] = 2
    session["accessToken"] = token
    session["tokenId"] = result.get("tokenId") or session.get("tokenId") or ""
    session["expiresAt"] = result.get("expiresAt") or session.get("expiresAt")
    session["user"] = result.get("user") or session.get("user") or {}
    session["lastRotatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    session["lastValidatedAt"] = session["lastRotatedAt"]
    save_auth(session)
    print("YTConv device token rotated successfully.")
    print("New token ID: %s" % session.get("tokenId", "-"))
    return 0


def logout():
    session = load_auth()
    if session:
        try:
            request_json("/api/cli-auth/logout", method="POST", token=session.get("accessToken"))
        except RuntimeError:
            pass
    clear_auth()
    print("YTConv account was signed out on this device.")
    return 0


def auth_command(argv):
    first = (argv[0] if argv else "").lower()
    if first in ("login", "signin", "sign-in"):
        return "login"
    if first in ("logout", "signout", "sign-out"):
        return "logout"
    if first == "whoami":
        return "status"
    if first == "devices":
        return "devices"
    if first not in ("auth", "account"):
        return None
    action = (argv[1] if len(argv) > 1 else "status").lower()
    if action in ("login", "signin", "sign-in"):
        return "login"
    if action in ("logout", "signout", "sign-out"):
        return "logout"
    if action in ("status", "whoami"):
        return "status"
    if action in ("devices", "sessions"):
        return "devices"
    if action == "revoke":
        return "revoke"
    if action in ("refresh", "rotate"):
        return "refresh"
    return "help"


def safe_without_login(argv):
    if not argv:
        return False
    first = argv[0].lower()
    return first in SAFE_COMMANDS or first in SAFE_FLAGS or any(value.lower() in SAFE_FLAGS for value in argv)


def run_account_frontend(argv):
    command = auth_command(argv)
    if command == "login":
        return login()
    if command == "logout":
        return logout()
    if command == "status":
        return auth_status("--json" in argv)
    if command == "devices":
        return auth_devices("--json" in argv)
    if command == "revoke":
        return auth_revoke(argv[2] if len(argv) > 2 else None)
    if command == "refresh":
        return auth_refresh()
    if command == "help":
        auth_help()
        return 0
    if safe_without_login(argv):
        return None
    session = validate_auth()
    if not session:
        raise RuntimeError("Login is required before downloading or converting media.\nRun: ytconv login\nLogin page: %s/cli-login" % API_BASE)
    os.environ["YTCONV_AUTH_TOKEN"] = session["accessToken"]
    os.environ["YTCONV_USER_ID"] = (session.get("user") or {}).get("id", "")
    os.environ["YTCONV_USER_EMAIL"] = (session.get("user") or {}).get("email", "")
    return None


try:
    account_exit = run_account_frontend(sys.argv[1:])
    if account_exit is not None:
        raise SystemExit(account_exit)
except (OSError, RuntimeError, ValueError, json.JSONDecodeError) as error:
    print("YTConv account: %s" % error, file=sys.stderr)
    auth_help()
    raise SystemExit(4)

if not TARGET.is_file():
    raise SystemExit("YTConv core frontend is missing: %s" % TARGET)

source = TARGET.read_text(encoding="utf-8")
replacements = {
    'VERSION = "1.5.0-beta.1"': 'VERSION = "1.6.0-beta.1"',
    'codex/add-ytconv-cli': 'release/ytconv-1.6.0-beta',
    'YTConv 1.5.0 Beta native frontend for iSH/Alpine and Python-only shells.': 'YTConv 1.6.0-beta.1 native frontend for iSH/Alpine and Python-only shells.',
    'description="YTConv 1.5.0 Beta untuk iSH/Alpine."': 'description="YTConv 1.6.0-beta.1 for iSH/Alpine."',
    'YTConv iSH Beta doctor': 'YTConv iSH beta doctor',
    'Mengunduh installer YTConv iSH beta terbaru...': 'Downloading the latest YTConv iSH beta installer...',
    'Update gagal: %s': 'Update failed: %s',
    'Jalankan manual:': 'Run manually:',
    'Update selesai. Jalankan kembali: ytconv --version': 'Update completed. Run again: ytconv --version',
    'tidak ditemukan': 'not found',
    'gagal dijalankan': 'failed to run',
    'pip gagal memasang yt-dlp/gallery-dl. Periksa internet dan waktu perangkat.': 'pip could not install yt-dlp/gallery-dl. Check the internet connection and device clock.',
    'Masih kurang: %s': 'Still missing: %s',
    'Semua dependency siap.': 'All dependencies are ready.',
    'cookies.txt tidak ditemukan: %s': 'cookies.txt was not found: %s',
    '--output-template harus relatif, tidak boleh \'..\', dan wajib memuat %(ext)s': '--output-template must be relative, must not contain .., and must include %(ext)s',
    '%s belum tersedia. Jalankan ytconv repair': '%s is not available. Run ytconv repair',
    '%s gagal dengan kode %s': '%s failed with exit code %s',
    '%s gagal': '%s failed',
    'Judul: %s\\nUploader: %s': 'Title: %s\\nUploader: %s',
    'gallery-dl gagal; mencoba yt-dlp...': 'gallery-dl failed; trying yt-dlp...',
    'yt-dlp gagal; mencoba gallery-dl...': 'yt-dlp failed; trying gallery-dl...',
    'Belum tersedia: %s\\nJalankan: ytconv repair': 'Missing: %s\\nRun: ytconv repair',
    'Link tidak valid: %s': 'Invalid URL: %s',
    'tersedia %s': '%s available',
    'sudah terbaru (%s)': 'up to date (%s)',
    'Paste link media: ': 'Paste a media URL: ',
    'Tidak ada link. Berikan LINK, batch file, atau pipe melalui stdin.': 'No URL was provided. Pass a URL, batch file, or pipe URLs through stdin.',
    'Gagal: %s': 'Failed: %s',
    'Laporan JSON: %s': 'JSON report: %s',
    'Ringkasan: %s berhasil, %s gagal.': 'Summary: %s succeeded, %s failed.',
    'Jalankan ytconv doctor dan ytconv repair.': 'Run ytconv doctor and ytconv repair.',
    'per profil': 'per profile',
}

for old, new in replacements.items():
    source = source.replace(old, new)

namespace = {
    "__name__": "__main__",
    "__file__": str(TARGET),
    "__package__": None,
}
exec(compile(source, str(TARGET), "exec"), namespace)
