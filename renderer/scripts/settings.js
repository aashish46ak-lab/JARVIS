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
        <option value="gemini" ${config.aiProvider === 'gemini' ? 'selected' : ''}>Gemini</option>
        <option value="openai" ${config.aiProvider === 'openai' ? 'selected' : ''}>OpenAI</option>
        <option value="anthropic" ${config.aiProvider === 'anthropic' ? 'selected' : ''}>Anthropic</option>
      </select>

      <label>Gemini API Key</label>
      <input id="s-gemini" type="password" value="${config.geminiApiKey || ''}" placeholder="AIza..." />

      <label>ElevenLabs API Key</label>
      <input id="s-eleven" type="password" value="${config.elevenLabsApiKey || ''}" placeholder="sk_..." />

      <label>ElevenLabs Voice ID</label>
      <input id="s-voiceid" type="text" value="${config.elevenLabsVoiceId || ''}" />

      <label>Voice Output</label>
      <select id="s-voiceEnabled">
        <option value="true" ${config.voiceEnabled ? 'selected' : ''}>Enabled</option>
        <option value="false" ${!config.voiceEnabled ? 'selected' : ''}>Disabled</option>
      </select>

      <label>Listening Mode</label>
      <select id="s-listen">
        <option value="continuous" ${config.listeningMode === 'continuous' ? 'selected' : ''}>Continuous (wake word)</option>
        <option value="push-to-talk" ${config.listeningMode === 'push-to-talk' ? 'selected' : ''}>Push-to-talk</option>
      </select>

      <label>Wake Word</label>
      <input id="s-wake" type="text" value="${config.wakeWord || 'jarvis'}" />

      <label>Wake Word Enabled</label>
      <select id="s-wakeEnabled">
        <option value="true" ${config.wakeWordEnabled ? 'selected' : ''}>Yes</option>
        <option value="false" ${!config.wakeWordEnabled ? 'selected' : ''}>No</option>
      </select>

      <label>Animation Intensity</label>
      <select id="s-anim">
        <option value="low" ${config.animationIntensity === 'low' ? 'selected' : ''}>Low</option>
        <option value="normal" ${config.animationIntensity === 'normal' ? 'selected' : ''}>Normal</option>
        <option value="high" ${config.animationIntensity === 'high' ? 'selected' : ''}>High</option>
      </select>

      <label>Permission Mode</label>
      <select id="s-perm">
        <option value="dangerous-only" ${config.permissionMode === 'dangerous-only' ? 'selected' : ''}>Dangerous only</option>
        <option value="always" ${config.permissionMode === 'always' ? 'selected' : ''}>Always ask</option>
        <option value="never" ${config.permissionMode === 'never' ? 'selected' : ''}>Never ask</option>
      </select>

      <button id="s-save">Save Settings</button>
      <button id="s-test-ai">Test AI Connection</button>
      <button id="s-test-voice">Test Voice</button>
    `;

    document.getElementById('settings-drawer').classList.remove('hidden');

    document.getElementById('s-save').onclick = async () => {
      const partial = {
        aiProvider: document.getElementById('s-provider').value,
        geminiApiKey: document.getElementById('s-gemini').value || undefined,
        elevenLabsApiKey: document.getElementById('s-eleven').value || undefined,
        elevenLabsVoiceId: document.getElementById('s-voiceid').value,
        voiceEnabled: document.getElementById('s-voiceEnabled').value === 'true',
        listeningMode: document.getElementById('s-listen').value,
        wakeWord: document.getElementById('s-wake').value,
        wakeWordEnabled: document.getElementById('s-wakeEnabled').value === 'true',
        animationIntensity: document.getElementById('s-anim').value,
        permissionMode: document.getElementById('s-perm').value,
        firstRunComplete: true,
      };
      if (partial.geminiApiKey && partial.geminiApiKey.includes('••••')) delete partial.geminiApiKey;
      if (partial.elevenLabsApiKey && partial.elevenLabsApiKey.includes('••••')) delete partial.elevenLabsApiKey;

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
      <p style="margin-bottom:1rem;color:var(--muted)">Enter at least a Gemini API key to continue. You can add ElevenLabs later for voice.</p>
      <label style="display:block;text-align:left;margin:0.5rem 0 0.2rem">Gemini API Key *</label>
      <input id="su-gemini" type="password" style="width:100%;padding:0.5rem;margin-bottom:0.8rem;background:#0c1520;border:1px solid var(--border);color:var(--text);border-radius:4px" />
      <label style="display:block;text-align:left;margin:0.5rem 0 0.2rem">ElevenLabs API Key (optional)</label>
      <input id="su-eleven" type="password" style="width:100%;padding:0.5rem;margin-bottom:0.8rem;background:#0c1520;border:1px solid var(--border);color:var(--text);border-radius:4px" />
    `;
    const finish = document.getElementById('setup-finish');
    finish.disabled = false;
    finish.onclick = async () => {
      const gemini = document.getElementById('su-gemini').value.trim();
      const eleven = document.getElementById('su-eleven').value.trim();
      if (!gemini) { alert('Gemini API key is required.'); return; }
      await window.jarvis.config.update({
        geminiApiKey: gemini,
        elevenLabsApiKey: eleven || undefined,
        firstRunComplete: true,
        voiceEnabled: !!eleven,
      });
      onDone();
    };
  }

  return { openDrawer, wireDrawer, initSetupWizard, get config() { return config; } };
})();
