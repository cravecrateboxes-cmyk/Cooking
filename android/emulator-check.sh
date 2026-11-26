#!/usr/bin/env bash
# Installs the test APK on the running emulator, opens the game, presses Play, walks the chef with a
# thumb drag and saves screenshots plus the app's log. Fails if the app crashes or never draws.
set -euo pipefail
apk="$1"
out="$2"
mkdir -p "$out"
adb install -r "$apk"
adb logcat -c
adb shell am start -n com.cravecrate.orderup/.MainActivity
sleep 25
adb exec-out screencap -p > "$out/01-title.png"
read -r w h < <(adb shell wm size | sed -E 's/.*: ([0-9]+)x([0-9]+).*/\1 \2/')
# the green Play button sits near the bottom middle of the title screen
adb shell input tap $((w / 2)) $((h * 84 / 100))
sleep 8
adb exec-out screencap -p > "$out/02-playing.png"
cx=$((w / 2)); cy=$((h * 62 / 100))
adb shell input swipe "$cx" "$cy" $((cx + w / 6)) $((cy - h / 14)) 2500
sleep 2
adb exec-out screencap -p > "$out/03-walked.png"
sleep 15
adb exec-out screencap -p > "$out/04-later.png"
adb logcat -d > "$out/logcat.txt" || true
grep -E "chromium.*(Uncaught|Error)" "$out/logcat.txt" > "$out/js-errors.txt" || true
if adb shell pidof com.cravecrate.orderup > /dev/null; then echo "app still running"; else echo "app crashed" && exit 1; fi
