#!/usr/bin/env python3
"""使用固定本机证书打包、校验并按需安装 macOS 应用。"""

import argparse
import json
import os
from pathlib import Path
import plistlib
import re
import shutil
import subprocess
import tempfile
import uuid

ROOT = Path(__file__).resolve().parents[1]
APP_NAME = "潮汐渔场.app"
BUNDLE_ID = "com.allan.tidalfishing"
OUTPUT = ROOT / "exports/macos" / APP_NAME
INSTALL = Path("/Applications") / APP_NAME
RETIRED = ROOT / ".tools/retired-apps"


def signing_identity():
    path = ROOT / ".local-signing.json"
    if not path.is_file():
        raise SystemExit("Local signing is not configured: " + str(path))
    config = json.loads(path.read_text())
    identity = config.get("identity", "")
    if not isinstance(identity, str) or not re.fullmatch(r"[0-9A-Fa-f]{40}", identity):
        raise SystemExit("Signing identity must be an exact certificate SHA-1 fingerprint")
    if config.get("bundle_id") != BUNDLE_ID:
        raise SystemExit("Signing configuration does not match the bundle identifier")
    identity = identity.upper()
    result = subprocess.run(["/usr/bin/security", "find-identity", "-v", "-p", "codesigning"],
                            check=True, capture_output=True, text=True)
    identities = re.findall(r'\d+\) ([0-9A-Fa-f]{40}) "[^"\n]+"', result.stdout)
    if identity not in {value.upper() for value in identities}:
        raise SystemExit("Pinned signing certificate is unavailable; ad hoc fallback is disabled")
    return identity


def verify(app, identity):
    info = plistlib.loads((app / "Contents/Info.plist").read_bytes())
    if info.get("CFBundleIdentifier") != BUNDLE_ID:
        raise SystemExit("Refusing an unrelated application: " + str(app))
    requirement = '=identifier "' + BUNDLE_ID + '" and certificate leaf = H"' + identity + '"'
    subprocess.run(["/usr/bin/codesign", "--verify", "--deep", "--strict", "-R",
                    requirement, str(app)], check=True)
    result = subprocess.run(["/usr/bin/codesign", "--display", "-r", "-", str(app)],
                            check=True, capture_output=True, text=True)
    text = result.stdout + result.stderr
    if "designated =>" not in text or "cdhash" in text:
        raise SystemExit("Expected a stable certificate-based designated requirement")


def require_stopped(app):
    if app.is_symlink():
        raise SystemExit("Refusing an app symlink: " + str(app))
    if not app.exists():
        return
    info = plistlib.loads((app / "Contents/Info.plist").read_bytes())
    if info.get("CFBundleIdentifier") != BUNDLE_ID:
        raise SystemExit("Refusing to replace an unrelated application: " + str(app))
    executable = app / "Contents/MacOS" / info["CFBundleExecutable"]
    running = subprocess.run(["/usr/bin/pgrep", "-f", "^" + re.escape(str(executable)) + "($| )"],
                             capture_output=True)
    if running.returncode == 0:
        raise SystemExit("Quit the app before updating: " + str(app))
    if running.returncode != 1:
        raise SystemExit("Cannot determine whether the application is running")


def publish(source, destination, identity):
    require_stopped(destination)
    verify(source, identity)
    backup = RETIRED / (destination.stem + "-" + uuid.uuid4().hex + ".app")
    if destination.exists():
        RETIRED.mkdir(parents=True, exist_ok=True)
        destination.rename(backup)
    try:
        source.rename(destination)
    except BaseException:
        if backup.exists():
            backup.rename(destination)
        raise
    if backup.exists():
        print("Previous build preserved: " + str(backup))


def build(identity):
    engine = Path(os.environ.get("GODOT_BIN", str(ROOT / ".tools/Godot.app/Contents/MacOS/Godot")))
    if not engine.is_file():
        raise SystemExit("Godot 4.5.1 not found; set GODOT_BIN")
    version = subprocess.run([str(engine), "--version"], check=True, capture_output=True, text=True).stdout.strip()
    if version != "4.5.1.stable.official.f62fdbde1":
        raise SystemExit("Expected Godot 4.5.1.stable.official.f62fdbde1, received: " + version)
    if not (ROOT / ".tools/macos.zip").is_file():
        subprocess.run(["python3", "-I", str(ROOT / "tools/fetch_macos_template.py")], check=True)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    require_stopped(OUTPUT)
    with tempfile.TemporaryDirectory(prefix="macos-package-", dir=ROOT / ".tools") as temporary:
        staged = Path(temporary) / APP_NAME
        subprocess.run([str(engine), "--headless", "--path", str(ROOT), "--export-release", "macOS", str(staged)], check=True)
        info = plistlib.loads((staged / "Contents/Info.plist").read_bytes())
        if info.get("CFBundleIdentifier") != BUNDLE_ID:
            raise SystemExit("Exported bundle identifier does not match signing configuration")
        subprocess.run(["/usr/bin/codesign", "--force", "--sign", identity,
                        "--identifier", BUNDLE_ID, "--options", "runtime", "--timestamp=none", str(staged)], check=True)
        verify(staged, identity)
        archive = Path(temporary) / "潮汐渔场-macOS.zip"
        subprocess.run(["/usr/bin/ditto", "-c", "-k", "--sequesterRsrc", "--keepParent", str(staged), str(archive)], check=True)
        publish(staged, OUTPUT, identity)
        archive.replace(OUTPUT.parent / archive.name)
    print("Built and signed: " + str(OUTPUT))
    print("Archive: " + str(OUTPUT.parent / "潮汐渔场-macOS.zip"))


def install(identity):
    verify(OUTPUT, identity)
    require_stopped(INSTALL)
    register = Path("/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister")
    # 在 /Applications 同一卷暂存完整副本后切换，失败时恢复原包。
    with tempfile.TemporaryDirectory(prefix=".tidalfishing-install-", dir=INSTALL.parent) as temporary:
        staged = Path(temporary) / APP_NAME
        shutil.copytree(OUTPUT, staged)
        verify(staged, identity)
        backup = Path(temporary) / ("Previous-" + APP_NAME)
        installed = False
        try:
            if INSTALL.exists():
                INSTALL.rename(backup)
            staged.rename(INSTALL)
            installed = True
            verify(INSTALL, identity)
        except BaseException:
            if installed and INSTALL.exists():
                shutil.rmtree(INSTALL)
            if backup.exists():
                backup.rename(INSTALL)
            raise
        if backup.exists():
            RETIRED.mkdir(parents=True, exist_ok=True)
            shutil.move(str(backup), RETIRED / ("Installed-" + uuid.uuid4().hex + ".app"))
    INSTALL.touch()
    subprocess.run([str(register), "-f", str(INSTALL)], check=True)
    print("Installed: " + str(INSTALL))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--install", action="store_true")
    parser.add_argument("--skip-build", action="store_true")
    parser.add_argument("--verify", action="store_true")
    args = parser.parse_args()
    identity = signing_identity()
    if args.verify:
        verify(OUTPUT, identity)
        if args.install:
            verify(INSTALL, identity)
        print("Verified signing certificate: " + identity)
        return
    if not args.skip_build:
        build(identity)
    if args.install:
        install(identity)
    print("Signing certificate: " + identity)


if __name__ == "__main__":
    main()
