#!/usr/bin/env python3
"""Load pages in headless Chrome and report console errors + CSP violations.

A screenshot cannot see a blocked script. This drives Chrome over the DevTools
Protocol, collects Runtime.consoleAPICalled / Log.entryAdded, and prints
anything that mentions Content Security Policy or looks like an error.

Usage: csp-check.py URL [URL ...]
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request

try:
    import websocket  # type: ignore
except ImportError:
    print("needs: pip install websocket-client", file=sys.stderr)
    sys.exit(2)

CHROME = next(
    (
        p
        for p in [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
            shutil.which("chromium") or "",
        ]
        if p and os.path.exists(p)
    ),
    None,
)
if not CHROME:
    print("no Chrome found", file=sys.stderr)
    sys.exit(2)

PORT = 9333
profile = tempfile.mkdtemp(prefix="csp-check-")
proc = subprocess.Popen(
    [
        CHROME,
        f"--remote-debugging-port={PORT}",
        f"--user-data-dir={profile}",
        # Chrome 111+ rejects DevTools websocket handshakes whose Origin header
        # it did not expect; without this the connection 403s.
        "--remote-allow-origins=*",
        "--headless=new",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-gpu",
        "--window-size=1440,900",
        "about:blank",
    ],
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
)


def endpoint():
    for _ in range(60):
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json/version", timeout=1) as r:
                return json.load(r)["webSocketDebuggerUrl"]
        except Exception:
            time.sleep(0.25)
    raise SystemExit("chrome never came up")


failures = 0
try:
    ws = websocket.create_connection(endpoint(), timeout=30)
    msg_id = 0

    def send(method, **params):
        global msg_id
        msg_id += 1
        ws.send(json.dumps({"id": msg_id, "method": method, "params": params}))
        return msg_id

    send("Target.setDiscoverTargets", discover=True)

    for url in sys.argv[1:]:
        # A fresh tab per URL keeps one page's errors out of another's report.
        tid = send("Target.createTarget", url="about:blank")
        target_id = None
        while target_id is None:
            m = json.loads(ws.recv())
            if m.get("id") == tid:
                target_id = m["result"]["targetId"]

        sid = send("Target.attachToTarget", targetId=target_id, flatten=True)
        session = None
        while session is None:
            m = json.loads(ws.recv())
            if m.get("id") == sid:
                session = m["result"]["sessionId"]

        def ssend(method, **params):
            global msg_id
            msg_id += 1
            ws.send(
                json.dumps(
                    {"id": msg_id, "sessionId": session, "method": method, "params": params}
                )
            )
            return msg_id

        ssend("Runtime.enable")
        ssend("Log.enable")
        ssend("Page.enable")
        nav = ssend("Page.navigate", url=url)

        problems = []
        deadline = time.time() + 20
        ws.settimeout(2)
        while time.time() < deadline:
            try:
                m = json.loads(ws.recv())
            except Exception:
                continue
            method = m.get("method")
            if method == "Log.entryAdded":
                e = m["params"]["entry"]
                if e.get("level") in ("error", "warning"):
                    problems.append(f"[{e['level']}] {e.get('text','')[:300]}")
            elif method == "Runtime.consoleAPICalled":
                if m["params"].get("type") in ("error", "warning"):
                    args = " ".join(
                        str(a.get("value", a.get("description", "")))
                        for a in m["params"].get("args", [])
                    )
                    problems.append(f"[console] {args[:300]}")
            elif method == "Runtime.exceptionThrown":
                d = m["params"]["exceptionDetails"]
                problems.append(f"[exception] {d.get('text','')} {d.get('exception',{}).get('description','')[:300]}")

        csp = [p for p in problems if "Content Security Policy" in p or "CSP" in p]
        print(f"\n=== {url}")
        if csp:
            failures += 1
            print(f"  CSP VIOLATIONS: {len(csp)}")
            for p in csp[:10]:
                print("   ", p)
        else:
            print("  no CSP violations")
        other = [p for p in problems if p not in csp]
        if other:
            print(f"  other console noise ({len(other)}):")
            for p in other[:8]:
                print("   ", p)

        ssend("Target.closeTarget", targetId=target_id)
        ws.settimeout(30)
finally:
    proc.terminate()
    shutil.rmtree(profile, ignore_errors=True)

sys.exit(1 if failures else 0)
