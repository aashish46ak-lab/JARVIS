# J.A.R.V.I.S. — Voice-First Desktop AI Assistant

A voice-first Electron desktop assistant with an MCU-inspired personality, real tool-calling control over your computer, and a reactive HUD interface.

> **Visual design note**  
> The central visualizer is an **original** glowing AI-core design (rotating rings, energy bars, dual eye-lights that pulse with speech, subtle head-motion while speaking).  
> It is **inspired by** the composition of classic HUD interfaces but deliberately does **not** reproduce the Iron Man helmet or any copyrighted Marvel/Disney character likeness.  
> Reproducing the exact helmet would violate copyright; this project stays original while delivering the same cinematic feel.

---

## Features

- **Talk-first**: greets you on launch and speaks every reply (ElevenLabs TTS).
- **Continuous listening** with configurable wake word, plus automatic fallback to **push-to-talk** + Gemini audio transcription when the browser SpeechRecognition engine is unreliable.
- **Audio-reactive HUD**: core pulse, eye lights, and waveform bars are driven by real microphone / TTS energy levels.
- **Multi-provider brain**: Gemini (default), with architecture ready for OpenAI / Anthropic.
- **Real tools**: open apps/URLs, web & YouTube search, system telemetry, shell commands (with confirmation), memory, file listing.
- **Permission system**: dangerous tools require in-HUD AUTHORIZE / CANCEL.
- **Proactive nudges**: low disk, low battery, sustained high CPU.
- **Settings drawer**, memory, and activity feed.

---

## Quick start

```bash
git clone https://github.com/aashish46ak-lab/JARVIS.git
cd JARVIS
npm install
npm start
```

On first launch a short setup wizard asks for your **Gemini API key** (required) and optionally an **ElevenLabs API key** (for spoken replies).

You can also copy `.env.example` → `.env` and fill the keys before the first run. Anything set later in the in-app Settings panel overrides `.env`.

### Required keys

| Service        | Purpose                          | Where to get it                  |
|----------------|----------------------------------|----------------------------------|
| Google Gemini  | Chat + fallback STT              | https://aistudio.google.com/apikey |
| ElevenLabs     | Natural text-to-speech (optional)| https://elevenlabs.io            |

---

## Project layout

```
main.js                 Electron main process, IPC, proactive checks
preload.js              Secure bridge to renderer
src/
  core/                 EventBus, ConfigManager, Logger, MemoryStore
  ai/                   ConversationManager, GeminiClient, SystemPrompt
  tools/                ToolRegistry, PermissionManager, system helpers
  voice/                TTSService (ElevenLabs), STTService (Gemini)
  platform/             OS helpers
renderer/
  index.html            HUD layout
  styles/main.css       Cinematic dark theme
  scripts/
    renderer.js         State, canvas visualizer, UI wiring
    voice.js            Mic, SpeechRecognition, MediaRecorder, TTS playback
    settings.js         Settings drawer + first-run wizard
```

---

## Known limitations (honest)

- Electron’s Chromium does not always ship the Google SpeechRecognition API key, so continuous listening can fail with a `network` error on some machines. JARVIS detects this and cleanly switches to push-to-talk + cloud transcription instead of silently failing.
- Only Gemini is fully wired for tool calling in this release; OpenAI/Anthropic providers can be extended later using the same interface.
- Shell / file-delete tools always require explicit authorization (configurable).

---

## License

MIT — free to use, modify, and share.  
Do **not** distribute assets that reproduce copyrighted Marvel character designs.
