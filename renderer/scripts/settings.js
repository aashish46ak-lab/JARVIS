'use strict';

const JarvisSettings = (function () {
  let config = {};
  let onUpdate = null;

  async function openDrawer() {
    config = await window.jarvis.config.getAll();
    const body = document.getElementById('settings-body');
    body.innerHTML = `
      <label>AI Provider</label>
      <select id="s-provider">
        <option value="groq" ${config.aiProvider === 'groq' ? 'selected' : ''}>Groq (recommended)</option>
        <option value="gemini" ${config.aiProvider === 'gemini' ? 'selected' : ''}>Gemini</option>
      </select>

      <label>Groq API Key</label>
      <input id="s-groq" type="password" value="${config.groqApiKey || ''}" placeholder="gsk_..." />

      <label>Fish Audio API Key (voice)</label>
      <input id="s-fish" type="password" value="${config.fishApiKey || ''}" placeholder="Fish API key" />

      <label>Fish Voice ID</label>
      <input id="s-voiceid" type="text" value="${config.fishVoiceId || '14129c3e320149449d6bada6862f7338'}" />

      <label>Listening Mode</label>
      <select id="s-listen">
        <option value="continuous" ${config.listeningMode !== 'push-to-talk' ? 'selected' : ''}>Always listening (talk freely)</option>
        <option value="push-to-talk" ${config.listeningMode === 'push-to-talk' ? 'selected' : ''}>Push-to-talk only</option>
      </select>

      <label>Wake Word Required</label>
      <select id="s-wakeEnabled">
        <option value="false" ${!config.wakeWordEnabled ? 'selected' : ''}>No — just talk</option>
        <option value="true" ${config.wakeWordEnabled ? 'selected' : ''}>Yes — say "jarvis" first</option>
      </select>

      <label>Animation Intensity</label>
      <select id="s-anim">
        <option value="high" ${config.animationIntensity === 'high' ? 'selected' : ''}>High</option>
        <option value="normal" ${config.animationIntensity !== 'high' && config.animationIntensity !== 'low' ? 'selected' : ''}>Normal</option>
        <option value="low" ${config.animationIntensity === 'low' ? 'selected' : ''}>Low</option>
      </select>

      <button id="s-save">Save Settings</button>
      <button id="s-test-ai">Test AI</button>
      <button id="s-test-voice">Test Voice</button>
    `;

    document.getElementById('settings-drawer').classList.remove('hidden');

    document.getElementById('s-save').onclick = async () => {
      const partial = {
        aiProvider: document.getElementById('s-provider').value,
        groqApiKey: document.getElementById('s-groq').value || undefined,
        fishApiKey: document.getElementById('s-fish').value || undefined,
        fishVoiceId: document.getElementById('s-voiceid').value,
        listeningMode: document.getElementById('s-listen').value,
        wakeWordEnabled: document.getElementById('s-wakeEnabled').value === 'true',
        animationIntensity: document.getElementById('s-anim').value,
        voiceEnabled: true,
        firstRunComplete: true,
      };
      if (partial.groqApiKey && partial.groqApiKey.includes('••••')) delete partial.groqApiKey;
      if (partial.fishApiKey && partial.fishApiKey.includes('••••')) delete partial.fishApiKey;

      const updated = await window.jarvis.config.update(partial);
      config = updated;
      if (onUpdate) onUpdate(updated);
      alert('Settings saved.');
    };

    document.getElementById('s-test-ai').onclick = async () => {
      const res = await window.jarvis.config.testAI();
      alert(res.ok ? 'AI online: ' + (res.reply || 'OK') : 'Failed: ' + res.error);
    };
    document.getElementById('s-test-voice').onclick = async () => {
      const res = await window.jarvis.config.testVoice();
      alert(res.ok ? 'Voice OK (' + res.size + ' bytes)' : 'Failed: ' + res.error);
    };
  }

  function wireDrawer(cb) {
    onUpdate = cb;
    document.getElementById('btn-close-settings').onclick = () => {
      document.getElementById('settings-drawer').classList.add('hidden');
    };
  }

  function initSetupWizard(onDone) {
    const steps = document.getElementById('setup-steps');
    steps.innerHTML = `
      <p style="margin-bottom:1rem;color:var(--muted);line-height:1.5">
        Enter your keys. <b>Groq</b> = free fast AI. <b>Fish Audio</b> = JARVIS voice.
      </p>
      <label style="display:block;text-align:left;margin:0.5rem 0 0.2rem">Groq API Key *</label>
      <input id="su-groq" type="password" style="width:100%;padding:0.5rem;margin-bottom:0.8rem;background:#0c1520;border:1px solid var(--border);color:var(--text);border-radius:4px" placeholder="gsk_..." />
      <label style="display:block;text-align:left;margin:0.5rem 0 0.2rem">Fish Audio API Key (for voice)</label>
      <input id="su-fish" type="password" style="width:100%;padding:0.5rem;margin-bottom:0.8rem;background:#0c1520;border:1px solid var(--border);color:var(--text);border-radius:4px" />
      <p style="font-size:0.75rem;color:var(--muted)">Get Groq key: console.groq.com — Fish key: fish.audio</p>
    `;
    const finish = document.getElementById('setup-finish');
    finish.disabled = false;
    finish.onclick = async () => {
      const groq = document.getElementById('su-groq').value.trim();
      const fish = document.getElementById('su-fish').value.trim();
      if (!groq) { alert('Groq API key is required.'); return; }
      await window.jarvis.config.update({
        groqApiKey: groq,
        fishApiKey: fish || undefined,
        fishVoiceId: '14129c3e320149449d6bada6862f7338',
        aiProvider: 'groq',
        firstRunComplete: true,
        voiceEnabled: true,
        listeningMode: 'continuous',
        wakeWordEnabled: false,
      });
      onDone();
    };
  }

  return { openDrawer, wireDrawer, initSetupWizard, get config() { return config; } };
})();
