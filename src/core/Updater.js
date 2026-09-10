'use strict';

const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

const REPO_OWNER = 'aashish46ak-lab';
const REPO_NAME = 'JARVIS';
const BRANCH = 'main';
const GITHUB_API = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;

class Updater {
  constructor({ appRoot, config, logger, eventBus }) {
    this.appRoot = appRoot;
    this.config = config;
    this.logger = logger;
    this.eventBus = eventBus;
  }

  async fetchJson(url) {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'JARVIS-Desktop-Updater',
        Accept: 'application/vnd.github+json',
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`GitHub ${res.status}: ${text.slice(0, 200)}`);
    }
    return res.json();
  }

  async check() {
    try {
      const commit = await this.fetchJson(`${GITHUB_API}/commits/${BRANCH}`);
      const remoteSha = commit.sha;
      const remoteMsg = (commit.commit && commit.commit.message) || '';
      const remoteDate = (commit.commit && commit.commit.author && commit.commit.author.date) || null;
      const localSha = this.config.get('updateLastSha') || '';
      const localVersion = this.readLocalVersion();
      const hasGit = fs.existsSync(path.join(this.appRoot, '.git'));

      let available = false;
      if (localSha && remoteSha && localSha !== remoteSha) available = true;
      if (!localSha && remoteSha) available = true;

      return {
        ok: true,
        available,
        localSha: localSha || null,
        remoteSha,
        remoteMessage: remoteMsg.split('\n')[0],
        remoteDate,
        localVersion,
        method: hasGit ? 'git' : 'zip',
        repo: `${REPO_OWNER}/${REPO_NAME}`,
        branch: BRANCH,
      };
    } catch (err) {
      if (this.logger) this.logger.error('UPDATE', 'check failed', { error: err.message });
      return { ok: false, error: err.message, available: false };
    }
  }

  readLocalVersion() {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(this.appRoot, 'package.json'), 'utf8'));
      return pkg.version || '0.0.0';
    } catch (_) {
      return '0.0.0';
    }
  }

  async apply() {
    this.eventBus.safeEmit('activity', { text: 'Updating JARVIS from GitHub…', level: 'info' });
    const hasGit = fs.existsSync(path.join(this.appRoot, '.git'));
    try {
      if (hasGit) {
        await this.applyGitPull();
      } else {
        await this.applyZipUpdate();
      }
      const status = await this.check();
      if (status.remoteSha) this.config.set('updateLastSha', status.remoteSha);
      this.config.set('updateLastAt', new Date().toISOString());
      this.eventBus.safeEmit('activity', { text: 'Update applied. Restart required.', level: 'info' });
      return {
        ok: true,
        message: 'Update applied successfully. JARVIS will restart.',
        remoteSha: status.remoteSha,
        needsRestart: true,
      };
    } catch (err) {
      if (this.logger) this.logger.error('UPDATE', 'apply failed', { error: err.message });
      this.eventBus.safeEmit('activity', { text: 'Update failed: ' + err.message, level: 'error' });
      return { ok: false, error: err.message };
    }
  }

  async applyGitPull() {
    await execFileAsync('git', ['fetch', 'origin', BRANCH], { cwd: this.appRoot, timeout: 120000 });
    await execFileAsync('git', ['checkout', BRANCH], { cwd: this.appRoot, timeout: 30000 });
    await execFileAsync('git', ['pull', 'origin', BRANCH], { cwd: this.appRoot, timeout: 120000 });
    try {
      await execFileAsync('npm', ['install', '--omit=dev'], { cwd: this.appRoot, timeout: 300000, shell: true });
    } catch (e) {
      if (this.logger) this.logger.warn('UPDATE', 'npm install after pull', { error: e.message });
    }
  }

  async applyZipUpdate() {
    const zipUrl = `https://github.com/${REPO_OWNER}/${REPO_NAME}/archive/refs/heads/${BRANCH}.zip`;
    const res = await fetch(zipUrl, { headers: { 'User-Agent': 'JARVIS-Desktop-Updater' } });
    if (!res.ok) throw new Error('Failed to download update zip: ' + res.status);
    const buf = Buffer.from(await res.arrayBuffer());

    const os = require('os');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jarvis-update-'));
    const zipPath = path.join(tmpDir, 'update.zip');
    fs.writeFileSync(zipPath, buf);

    const extractDir = path.join(tmpDir, 'extracted');
    fs.mkdirSync(extractDir, { recursive: true });

    if (process.platform === 'win32') {
      await execFileAsync(
        'powershell.exe',
        ['-NoProfile', '-Command', `Expand-Archive -Path "${zipPath}" -DestinationPath "${extractDir}" -Force`],
        { timeout: 120000 }
      );
    } else {
      await execFileAsync('unzip', ['-o', zipPath, '-d', extractDir], { timeout: 120000 });
    }

    const entries = fs.readdirSync(extractDir);
    const rootName = entries.find((e) => e.startsWith(REPO_NAME)) || entries[0];
    if (!rootName) throw new Error('Update archive empty');
    const sourceRoot = path.join(extractDir, rootName);

    const copyList = ['main.js', 'preload.js', 'package.json', 'renderer', 'src', 'assets'];
    for (const item of copyList) {
      const src = path.join(sourceRoot, item);
      const dest = path.join(this.appRoot, item);
      if (!fs.existsSync(src)) continue;
      await this.copyRecursive(src, dest);
    }

    try {
      await execFileAsync('npm', ['install', '--omit=dev'], { cwd: this.appRoot, timeout: 300000, shell: true });
    } catch (e) {
      if (this.logger) this.logger.warn('UPDATE', 'npm install after zip', { error: e.message });
    }

    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (_) {}
  }

  async copyRecursive(src, dest) {
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
      fs.mkdirSync(dest, { recursive: true });
      for (const name of fs.readdirSync(src)) {
        await this.copyRecursive(path.join(src, name), path.join(dest, name));
      }
    } else {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    }
  }
}

module.exports = Updater;
