# J.A.R.V.I.S. (aashish46ak-lab)

Your project — **this repo** is the home for your JARVIS.

## Full features (Python)

Complete computer-control stack (wake word, browser, vision, plugins, phone dashboard, etc.) is the Mark-LIII engine, installed **into this repo** under `python/`.

### Windows — do this

1. Download **this** repo as ZIP:  
   https://github.com/aashish46ak-lab/JARVIS/archive/refs/heads/main.zip  
   Extract → open the folder.

2. Double-click **`GET_FULL_PYTHON.bat`**  
   It downloads all Python source into `python/` and creates `python\config\api_keys.json`.

3. Edit **`python\config\api_keys.json`** — put your Gemini key:  
   https://aistudio.google.com/apikey

4. cmd:

```bat
cd path\to\JARVIS-main\python
python setup.py
python main.py
```

5. Allow **microphone** when Windows asks.

Engine credit: [FatihMakes/Mark-LIII](https://github.com/FatihMakes/Mark-LIII) (CC BY-NC 4.0). Prompt customized for MCU JARVIS ("sir").

## Electron HUD (optional)

```bat
npm install
npm start
```

Groq + Fish voice — lighter feature set than Python.
