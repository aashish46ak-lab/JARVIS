'use strict';

const JarvisSettings = (function () {
  let config = {};
  let onUpdate = null;

  async function openDrawer() {
    config = await window.jarvis.config.getAll();
    const body = document.getElementById('settings-body');
    body.innerHTML =
      '<div class="s-section">AI ENGINE</div>' +
      '<label>Provider</label>' +
      '<select id="s-provider">' +
      '<option value="groq"' + (config.aiProvider === 'groq' ? ' selected' : '') + '>Groq (fast)</option>' +
      '<option value="gemini"' + (config.aiProvider === 'gemini' ? ' selected' : '') + '>Gemini</option></select>' +
      '<label>Groq API Key</label>' +
      '<input id="s-groq" type="password" value="' + (config.groqApiKey || '') + '" placeholder="gsk_..." />' +
      '<label>Groq Model</label>' +
      '<select id="s-model">' +
      '<option value="llama-3.1-8b-instant">llama-3.1-8b-instant (fast)</option>' +
      '<option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile (smarter)</option>' +
      '<option value="openai/gpt-oss-20b">openai/gpt-oss-20b</option></select>' +
      '<div class="s-section">VOICE</div>' +
      '<label>Fish Audio API Key</label>' +
      '<input id="s-fish" type="password" value="' + (config.fishApiKey || '') + '" placeholder="optional" />' +
      '<label>Fish Voice ID</label>' +
      '<input id="s-voiceid" type="text" value="' + (config.fishVoiceId || '14129c3e320149449d6bada6862f7338') + '" />' +
      '<label>Speech speed</label>' +
      '<input id="s-speed" type="range" min="0.7" max="1.3" step="0.05" value="' + (config.speakingSpeed || 1) + '" />' +
      '<div class="s-section">LISTENING</div>' +
      '<label>Mode</label>' +
      '<select id="s-listen">' +
      '<option value="continuous" selected>Always listening</option>' +
      '<option value="push-to-talk">Push-to-talk only</option></select>' +
      '<label>Wake word required</label>' +
      '<select id="s-wake"><option value="false" selected>No</option><option value="true">Yes — say jarvis</option></select>' +
      '<p class="s-hint">Noise suppression is on. Full speaker-ID lock needs enrollment (later).</p>' +
      '<div class="s-section">DISPLAY</div>' +
      '<label>Animation</label>' +
      '<select id="s-anim"><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></select>' +
      '<button id="s-save" class="s-primary">Save</button>' +
      '<button id="s-test-ai">Test AI</button>' +
      '<button id="s-test-voice">Test voice</button>';

    document.getElementById('settings-drawer').classList.remove('hidden');
    if (config.groqModel) document.getElementById('s-model').value = config.groqModel;
    if (config.listeningMode === 'push-to-talk') document.getElementById('s-listen').value = 'push-to-talk';
    if (config.wakeWordEnabled) document.getElementById('s-wake').value = 'true';
    if (config.animationIntensity) document.getElementById('s-anim').value = config.animationIntensity;

    document.getElementById('s-save').onclick = async function () {
      const partial = {
        aiProvider: document.getElementById('s-provider').value,
        groqApiKey: document.getElementById('s-groq').value || undefined,
        groqModel: document.getElementById('s-model').value,
        fishApiKey: document.getElementById('s-fish').value || undefined,
        fishVoiceId: document.getElementById('s-voiceid').value,
        speakingSpeed: parseFloat(document.getElementById('s-speed').value) || 1,
        listeningMode: document.getElementById('s-listen').value,
        wakeWordEnabled: document.getElementById('s-wake').value === 'true',
        animationIntensity: document.getElementById('s-anim').value,
        voiceEnabled: true,
        firstRunComplete: true,
      };
      if (partial.groqApiKey && partial.groqApiKey.indexOf('••••') !== -1) delete partial.groqApiKey;
      if (partial.fishApiKey && partial.fishApiKey.indexOf('••••') !== -1) delete partial.fishApiKey;
      const updated = await window.jarvis.config.update(partial);
      config = updated;
      if (onUpdate) onUpdate(updated);
      alert('Saved.');
    };
    document.getElementById('s-test-ai').onclick = async function () {
      const res = await window.jarvis.config.testAI();
      alert(res.ok ? 'AI OK: ' + (res.reply || 'connected') : 'Failed: ' + res.error);
    };
    document.getElementById('s-test-voice').onclick = async function () {
      const res = await window.jarvis.config.testVoice();
      alert(res.ok ? 'Voice OK' : 'Failed: ' + res.error);
    };
  }

  function wireDrawer(cb) {
    onUpdate = cb;
    document.getElementById('btn-close-settings').onclick = function () {
      document.getElementById('settings-drawer').classList.add('hidden');
    };
  }

  function initSetupWizard(onDone) {
    const steps = document.getElementById('setup-steps');
    steps.innerHTML =
      '<p style="margin-bottom:1rem;color:var(--muted)">Groq = AI brain. Fish Audio = optional JARVIS voice.</p>' +
      '<label style="display:block;text-align:left">Groq API Key *</label>' +
      '<input id="su-groq" type="password" style="width:100%;padding:0.5rem;margin:0.3rem 0 0.8rem;background:#0c1520;border:1px solid var(--border);color:var(--text);border-radius:4px" placeholder="gsk_..." />' +
      '<label style="display:block;text-align:left">Fish Audio Key (optional)</label>' +
      '<input id="su-fish" type="password" style="width:100%;padding:0.5rem;margin:0.3rem 0 0.8rem;background:#0c1520;border:1px solid var(--border);color:var(--text);border-radius:4px" />';
    const finish = document.getElementById('setup-finish');
    finish.disabled = false;
    finish.onclick = async function () {
      const groq = document.getElementById('su-groq').value.trim();
      const fish = document.getElementById('su-fish').value.trim();
      if (!groq) { alert('Groq key required'); return; }
      await window.jarvis.config.update({
        groqApiKey: groq,
        fishApiKey: fish || undefined,
        fishVoiceId: '14129c3e320149449d6bada6862f7338',
        groqModel: 'llama-3.1-8b-instant',
        aiProvider: 'groq',
        firstRunComplete: true,
        voiceEnabled: true,
        listeningMode: 'continuous',
        wakeWordEnabled: false,
      });
      onDone();
    };
  }

  return { openDrawer: openDrawer, wireDrawer: wireDrawer, initSetupWizard: initSetupWizard };
})();
