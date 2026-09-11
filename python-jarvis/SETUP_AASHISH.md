# J.A.R.V.I.S. (Python) — Mark-LIII engine, your settings

Full feature set comes from **Mark-LIII** (FatihMakes), CC BY-NC 4.0 — personal use, credit the author.

## Why Python?

Mark-LIII is **Python + Gemini Live**. That is what unlocks wake word, browser control, vision, undo, plugins, phone QR dashboard, etc.

Your Electron app (Groq + Fish) cannot run that live engine without a full rewrite.

**For all Mark features → install this Python JARVIS.**

## Windows install (step by step)

1. Install **Python 3.11+** from https://www.python.org/downloads/  
   Check **Add python.exe to PATH**.

2. Open **cmd**:

```bat
cd C:\Users\Asus\Downloads
git clone https://github.com/FatihMakes/Mark-LIII.git JARVIS-python
cd JARVIS-python
```

3. Optional: replace `core\prompt.txt` with the one from this repo (`python-jarvis/prompt.txt`) so JARVIS always calls you **sir**.

4. Install:

```bat
python setup.py
python main.py
```

5. Paste a **free Gemini API key** when asked:  
   https://aistudio.google.com/apikey

6. When Windows asks for **microphone**, click **Allow**.

7. Settings → enable **Wake Word** (“Hey Jarvis”) if you want sleep/wake.

## Your identity (in prompt.txt)

- Name: **J.A.R.V.I.S.**
- Address: **sir**
- MCU tone, fast, “On it, sir” before long tasks

## Fish Audio / Groq

Mark speaks with **Gemini Live voices**.  
Fish voice id `14129c3e320149449d6bada6862f7338` is for the Electron app, not plugged into Gemini Live here.

- Full PC features + live voice → **this Python app**  
- Fish-only voice HUD → Electron `npm start`

## Phone

Mark has **Remote Dashboard** (QR) in Settings after launch.

## Credit

Engine/actions: **FatihMakes / Mark-LIII**.  
Customization: your JARVIS prompt + this setup guide.
