# Learning: MQTT Debugging Checklist & Windows Binary Paths

**Date**: 2026-02-12
**Context**: Debugging Gemini MQTT pipeline on Windows — wasted time on wrong diagnostic order
**Source**: rrr: oracle-v2

## MQTT Debugging Checklist (Do This First!)

When MQTT messages aren't flowing:

1. **How many brokers?** `tasklist | findstr mosquitto` (Windows) or `ps aux | grep mosquitto` (macOS/Linux)
2. **Who owns which port?** `netstat -an | findstr PORT`
3. **Same-port test**: pub/sub on the SAME TCP port to verify broker works at all
4. **Cross-listener test**: pub on TCP, sub on TCP, while extension uses WS — confirm routing
5. **Check topic names**: `mosquitto_sub -t "topic/#" -v` to see all traffic

## Windows Binary Path Pattern

Bun scripts using `Bun.spawn(["mosquitto_pub", ...])` fail on Windows because system binaries aren't in Git Bash PATH.

Fix:
```typescript
const MOSQUITTO_PUB = process.platform === "win32"
  ? "C:/Program Files/mosquitto/mosquitto_pub.exe"
  : "mosquitto_pub";
```

Apply to ALL scripts that shell out to system binaries, not just the one that failed.

## Tags

`mqtt`, `debugging`, `windows`, `path`, `checklist`, `gemini-pipeline`
