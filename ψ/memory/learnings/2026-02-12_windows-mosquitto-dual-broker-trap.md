# Learning: Windows Mosquitto Dual Broker Trap

**Date**: 2026-02-12
**Context**: Setting up MQTT pipeline for Gemini automation on Windows
**Source**: Debugging session — extension connected but no message flow

## The Problem

On Windows, `winget install EclipseFoundation.Mosquitto` installs Mosquitto as a Windows service that auto-starts on port 1883. When you also run a custom Mosquitto instance (e.g., with WebSocket support on port 9001), the custom instance can't bind to 1883 because the service already owns it.

Result: Two brokers running independently. CLI tools (mosquitto_pub) connect to the service on 1883. The Chrome extension connects to the custom broker on 9001. Messages never cross between them — a silent black hole.

## The Fix

Use a different TCP port for the custom broker (e.g., 1884):

```
# ~/.mosquitto/mosquitto-gemini.conf
allow_anonymous true
listener 1884       # Not 1883 (Windows service owns that)
protocol mqtt
listener 9001
protocol websockets
```

## Key Insights

1. **Always check `tasklist | findstr mosquitto`** before debugging message flow
2. **Two brokers = zero message flow** between them (not "partial" — zero)
3. **JavaScript `let` in try{} is block-scoped** — can't access it after catch{}. `tab?.id` doesn't help if `tab` is a ReferenceError; use `typeof tab !== 'undefined'`
4. **Debug MQTT with**: `mosquitto_sub -t "topic/#" -v -C 5` to see all subtopics

## Tags

`mqtt`, `mosquitto`, `windows`, `debugging`, `gemini-pipeline`, `port-conflict`
