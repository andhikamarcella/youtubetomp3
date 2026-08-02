#!/usr/bin/env python3
"""YTConv 1.5.8 compatibility and account frontend for iSH/Alpine."""

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

VERSION = "1.5.8"
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
    print("  ytconv login --local")
    print("  ytconv login --cloud-only")
    print("  ytconv auth status")
    print("  ytconv logout")
    print("\nCloud login falls back to a private local CLI profile when the account server is unavailable.")
    print("Account server: %s" % API_BASE)


def local_login(reason=None):
    if reason:
        print("\nCloud sign-in is unavailable (%s)." % reason)
    fallback_name = os.environ.get("USER") or socket.gethostname() or "YTConv user"
    if sys.stdin.isatty() and sys.stdout.isatty():
        try:
            answer = input("Display name [%s]: " % fallback_name).strip()
            display_name = answer or fallback_name
        except (EOFError, KeyboardInterrupt):
            display_name = fallback_name
    else:
        display_name = fallback_name
    saved_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    session = {
        "schemaVersion": 2,
        "mode": "local",
        "accessToken": "local:%s" % os.urandom(24).hex(),
        "tokenId": "local-device",
        "user": {
            "id": "local-%s" % os.urandom(12).hex(),
            "email": "",
            "displayName": display_name,
            "role": "local",
        },
        "deviceName": "%s (iSH %s)" % (socket.gethostname() or "iPhone/iPad", platform.machine() or "Alpine"),
        "apiBase": None,
        "savedAt": saved_at,
        "lastValidatedAt": saved_at,
        "expiresAt": None,
    }
    save_auth(session)
    print("\n+----------------------------------------------------------+")
    print("| YTConv local profile ready                              |")
    print("+----------------------------------------------------------+")
    print("  Account: %s" % account_label(session["user"]))
    print("  Mode: local CLI fallback")
    print("  Returning to YTConv CLI...")
    return 0


def cloud_login():
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
                "schemaVersion": 1,
                "accessToken": token,
                "tokenId": result.get("tokenId") or "",
                "user": result.get("user") or {},
                "deviceName": device_name,
                "apiBase": API_BASE,
                "savedAt": saved_at,
                "lastValidatedAt": saved_at,
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


def login(prefer_local=False, allow_local_fallback=True):
    if prefer_local:
        return local_login()
    try:
        return cloud_login()
    except RuntimeError as error:
        if not allow_local_fallback:
            raise
        return local_login(str(error))


def validate_auth(quiet=False):
    session = load_auth()
    if not session:
        return None
    if session.get("mode") == "local" or str(session.get("accessToken", "")).startswith("local:"):
        session["mode"] = "local"
        session["lastValidatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        save_auth(session)
        return session
    try:
        current = request_json("/api/cli-auth/me", token=session["accessToken"])
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


def auth_status():
    session = validate_auth(quiet=True)
    if not session:
        print("Not signed in. Run: ytconv login")
        return 1
    user = session.get("user") or {}
    print("YTConv account")
    print("Status      signed in")
    print("Mode        %s" % ("local CLI fallback" if session.get("mode") == "local" else "cloud account"))
    print("Account     %s" % account_label(user))
    if user.get("email"):
        print("Email       %s" % user["email"])
    if user.get("role"):
        print("Role        %s" % user["role"])
    print("Device      %s" % session.get("deviceName", "-"))
    print("Token       %s" % session.get("tokenId", "-"))
    print("API         %s" % ("not required" if session.get("mode") == "local" else session.get("apiBase", API_BASE)))
    return 0


def logout():
    session = load_auth()
    if session and session.get("mode") != "local":
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
    if first not in ("auth", "account"):
        return None
    action = (argv[1] if len(argv) > 1 else "status").lower()
    if action in ("login", "signin", "sign-in"):
        return "login"
    if action in ("logout", "signout", "sign-out"):
        return "logout"
    if action in ("status", "whoami"):
        return "status"
    return "help"


def safe_without_login(argv):
    if not argv:
        return False
    first = argv[0].lower()
    return first in SAFE_COMMANDS or first in SAFE_FLAGS or any(value.lower() in SAFE_FLAGS for value in argv)


def run_account_frontend(argv):
    command = auth_command(argv)
    if command == "login":
        exit_code = login(prefer_local="--local" in argv, allow_local_fallback="--cloud-only" not in argv)
        if exit_code == 0 and sys.stdin.isatty() and sys.stdout.isatty() and "--no-launch" not in argv:
            sys.argv = [sys.argv[0]]
            session = validate_auth()
            if session:
                os.environ["YTCONV_AUTH_TOKEN"] = session["accessToken"]
                os.environ["YTCONV_AUTH_MODE"] = session.get("mode", "cloud")
                os.environ["YTCONV_ACCOUNT_LABEL"] = account_label(session.get("user") or {})
            return None
        return exit_code
    if command == "logout":
        return logout()
    if command == "status":
        return auth_status()
    if command == "help":
        auth_help()
        return 0
    session = validate_auth(quiet=True)
    if session:
        os.environ["YTCONV_AUTH_TOKEN"] = session["accessToken"]
        os.environ["YTCONV_AUTH_MODE"] = session.get("mode", "cloud")
        os.environ["YTCONV_USER_ID"] = (session.get("user") or {}).get("id", "")
        os.environ["YTCONV_USER_EMAIL"] = (session.get("user") or {}).get("email", "")
        os.environ["YTCONV_ACCOUNT_LABEL"] = account_label(session.get("user") or {})
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
    'VERSION = "1.5.0-beta.1"': 'VERSION = "1.5.8"',
    'codex/add-ytconv-cli': 'release/ytconv-1.5.8-cli-only-final',
    'YTConv 1.5.0 Beta native frontend for iSH/Alpine and Python-only shells.': 'YTConv 1.5.8 native frontend for iSH/Alpine and Python-only shells.',
    'description="YTConv 1.5.0 Beta for iSH/Alpine."': 'description="YTConv 1.5.8 for iSH/Alpine."',
    'YTConv iSH Beta doctor': 'YTConv iSH doctor',
}

for old, new in replacements.items():
    source = source.replace(old, new)

namespace = {
    "__name__": "__main__",
    "__file__": str(TARGET),
    "__package__": None,
}
exec(compile(source, str(TARGET), "exec"), namespace)
