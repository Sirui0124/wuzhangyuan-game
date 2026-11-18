'use strict';
const { app, BrowserWindow, Menu, dialog, shell, session, utilityProcess } = require('electron');
const { resolve, join } = require('node:path');
const { pathToFileURL } = require('node:url');
const { mkdirSync, writeFileSync, appendFileSync, existsSync } = require('node:fs');

const option = name => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const customData = option('user-data-dir');
const reportFile = option('smoke-report');
const userData = customData ? resolve(customData) : join(app.getPath('appData'), 'Wuzhangyuan');
mkdirSync(userData, { recursive: true });
app.setPath('userData', userData);
app.setName('逆转五丈原');
app.setAppUserModelId('com.wuzhangyuan.game');
const logDir = join(userData, 'logs');mkdirSync(logDir, { recursive: true });
const log = message => { try { appendFileSync(join(logDir, 'desktop.log'), `[${new Date().toISOString()}] ${message}\n`); } catch {} };
const report = value => { if (reportFile) { mkdirSync(require('node:path').dirname(resolve(reportFile)), { recursive: true });writeFileSync(resolve(reportFile), JSON.stringify(value, null, 2)); } };
const webUrl = 'http://127.0.0.1:8812/';
const apiUrl = 'http://127.0.0.1:8787';
let mainWindow, staticServer, apiChild, apiPort, staticPort, quitting = false;
const payload = app.isPackaged ? join(process.resourcesPath, 'game') : resolve(option('game-root') || join(__dirname, '.stage/game'));

function cleanBackendEnvironment() {
  const env = {};
  // Never inherit development providers, NODE_OPTIONS or workspace state paths.
  const basic = /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|USERPROFILE|HOMEDRIVE|HOMEPATH|APPDATA|LOCALAPPDATA|PROGRAMDATA|PROGRAMFILES|PROGRAMFILES\(X86\)|COMMONPROGRAMFILES|USERNAME|USERDOMAIN|OS|PROCESSOR_ARCHITECTURE|NUMBER_OF_PROCESSORS)$/i;
  for (const [key, value] of Object.entries(process.env)) if (basic.test(key) && value !== undefined) env[key] = value;
  return { ...env, NODE_ENV: 'production', PORT: '0',
    GAME_SETTINGS_FILE: join(userData, 'settings', '.env') };
}

async function startBackend() {
  mkdirSync(join(userData, 'settings'), { recursive: true });
  apiChild = utilityProcess.fork(join(__dirname, 'backend-child.cjs'), [join(payload, 'GameStarter/server/server.mjs')], {
    cwd: userData, env: cleanBackendEnvironment(), stdio: 'pipe', serviceName: 'Wuzhangyuan local game service',
  });
  apiChild.stdout?.on('data', chunk => log(String(chunk).trim()));
  apiChild.stderr?.on('data', chunk => log(String(chunk).trim()));
  return new Promise((accept, reject) => {
    let ready = false;
    const timer = setTimeout(() => reject(new Error('本机游戏服务启动超时。')), 20000);
    apiChild.on('message', message => {
      if (message?.type === 'ready' && Number.isInteger(message.port) && message.port > 0) {
        ready = true; clearTimeout(timer);apiPort = message.port;accept(message);
      } else if (message?.type === 'failed') { clearTimeout(timer);reject(new Error('本机游戏服务未能启动，请查看应用日志。')); }
    });
    apiChild.on('exit', code => {
      clearTimeout(timer);
      if (!ready) reject(new Error(`本机游戏服务未能启动（${code}）。`));
      else if (!quitting) log(`Backend exited unexpectedly: ${code}`);
    });
  });
}

async function startStaticServer() {
  // Chapter-one and command-map handlers run here, outside the API child.
  // They must read the same player configuration and never the development env.
  for (const key of Object.keys(process.env)) if (/^(?:DEEPSEEK|TTS|VOLC|OPENAI|ARK|DOUBAO|GAME_)/i.test(key)) delete process.env[key];
  process.env.GAME_SETTINGS_FILE = join(userData, 'settings', '.env');
  const { createStaticServer } = await import(pathToFileURL(join(payload, 'GameStarter/web-demo/serve.mjs')).href);
  staticServer = createStaticServer({ root: join(payload, 'web'), commandOptions: { directory: join(app.getPath('userData'), 'yiling-command', 'saves') }, rescueOptions: { saveDir: join(app.getPath('userData'), 'yiling-rescue', 'saves'), settingsFile: join(app.getPath('userData'), 'settings', '.env') }, onRequest: async (req, res) => {
    const url = new URL(req.url, webUrl);
    if (req.headers.host !== `127.0.0.1:${staticPort}`) { res.writeHead(403);res.end('Forbidden');return true; }
    if (url.pathname.startsWith('/playtest/') || url.pathname.startsWith('/__local/') || ['/local', '/local/'].includes(url.pathname)) {
      res.writeHead(404);res.end('Not found');return true;
    }
    if (url.searchParams.has('playtest') && !(url.searchParams.get('chapter') === 'yiling' && url.searchParams.get('playtest') === 'command')) {
      url.searchParams.delete('playtest');res.writeHead(302, { Location: url.pathname + url.search, 'Cache-Control': 'no-store' });res.end();return true;
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; media-src 'self' blob:; connect-src 'self' http://127.0.0.1:8787; font-src 'self' data:; object-src 'none'; base-uri 'none'; frame-src 'self'; form-action 'self'");
    return false;
  } });
  await new Promise((accept, reject) => { staticServer.once('error', reject);staticServer.listen(0, '127.0.0.1', accept); });
  staticPort = staticServer.address().port;
}

async function configureBrowser() {
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  ses.setPermissionCheckHandler(() => false);
  // Stable virtual origins keep saves stable across launches, while each app owns
  // random real ports. Existing development servers are never reused or stopped.
  await ses.protocol.handle('http', async request => {
    const url = new URL(request.url);
    const isWeb = url.origin === webUrl.slice(0, -1), isApi = url.origin === apiUrl;
    if (!isWeb && !isApi) return new Response('Forbidden', { status: 403 });
    const target = `http://127.0.0.1:${isWeb ? staticPort : apiPort}${url.pathname}${url.search}`;
    const headers = new Headers(request.headers);
    for (const header of ['host', 'connection', 'content-length']) headers.delete(header);
    if (isApi) headers.set('Origin', webUrl.slice(0, -1));
    else if (url.pathname.startsWith('/api/')) headers.set('Origin', `http://127.0.0.1:${staticPort}`);
    try {
      return await fetch(target, { method: request.method, headers, redirect: 'manual', signal: request.signal,
        ...(!['GET', 'HEAD'].includes(request.method) ? { body: request.body, duplex: 'half' } : {}) });
    } catch {
      return new Response(JSON.stringify({ error: '本机服务暂不可用，请重新启动游戏。' }), { status: 503, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': webUrl.slice(0, -1) } });
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({ title: '逆转五丈原', width: 1440, height: 900, minWidth: 800, minHeight: 450,
    backgroundColor: '#15201e', icon: join(__dirname, 'resources/icon.png'), show: false, autoHideMenuBar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, spellcheck: false, backgroundThrottling: true } });
  const allowed = url => { try { return new URL(url).origin === webUrl.slice(0, -1); } catch { return false; } };
  const external = url => { try { const u = new URL(url);if (['https:', 'http:'].includes(u.protocol) && !['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)) void shell.openExternal(u.href); } catch {} };
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (allowed(url)) void mainWindow.loadURL(url); else external(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => { if (!allowed(url)) { event.preventDefault();external(url); } });
  mainWindow.webContents.on('will-attach-webview', event => event.preventDefault());
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
  return mainWindow.loadURL(webUrl);
}

async function shutdown() {
  try { if (staticServer) { staticServer.closeAllConnections();await new Promise(ok => staticServer.close(ok)); } } catch {}
  if (apiChild) {
    await new Promise(ok => { let timer;const finish = () => { clearTimeout(timer);ok(); };apiChild.once('exit', finish);timer = setTimeout(() => { apiChild.kill();finish(); }, 1800);apiChild.postMessage({ type: 'shutdown' }); });
  }
  try { await session.defaultSession.flushStorageData(); } catch {}
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore();mainWindow.show();mainWindow.focus(); } });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', event => {
    if (quitting) return;
    event.preventDefault();quitting = true;
    void shutdown().finally(() => app.exit(0));
  });
  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    if (!existsSync(join(payload, 'web/index.html'))) throw new Error('游戏资源不完整，请重新安装。');
    const backend = await startBackend();
    await startStaticServer();await configureBrowser();await createWindow();
    report({ ready: true, webUrl, apiUrl, staticPort, apiPort, apiPid: backend.pid, userData, appVersion: app.getVersion(), packaged: app.isPackaged, nodeVersion: backend.node, electronVersion: process.versions.electron });
    log(`Ready ${app.getVersion()}; web ${staticPort}; API ${apiPort}`);
  }).catch(async error => {
    log(error.stack || error.message);report({ ready: false, error: error.message, userData });
    if (!reportFile) dialog.showErrorBox('逆转五丈原未能启动', error.message + '\n日志位置：' + logDir);
    quitting = true;await shutdown();app.exit(1);
  });
}
