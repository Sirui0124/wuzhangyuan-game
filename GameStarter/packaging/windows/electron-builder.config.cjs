const path = require('node:path');
const fs = require('node:fs');

// Runtime paths are provided by build-release.mjs; the payload itself is staged
// from the explicit runtime allowlist, never the full repository.
module.exports = function configuration({ stage, output, version, label } = {}) {
  if (!stage || !output) throw new Error('Windows packaging requires an explicit stage and output directory');
  return {
    appId: 'com.wuzhangyuan.game',
    productName: '逆转五丈原',
    executableName: 'Wuzhangyuan',
    electronVersion: '45.0.0',
    electronDist: path.join(__dirname, 'node_modules', 'electron', 'dist'),
    extraMetadata: version ? { version } : {},
    directories: { output, buildResources: path.join(__dirname, 'resources') },
    asar: true,
    files: [
      'main.cjs', 'preload.cjs', 'backend-child.cjs', 'runtime/**/*', 'resources/icon.png', 'package.json',
      '!node_modules/**/*', '!**/*.test.*', '!**/*.spec.*'
    ],
    extraResources: [
      { from: path.join(stage, 'game'), to: 'game', filter: ['**/*'] },
      // Match ws from its own root: electron-builder prunes nested node_modules
      // while traversing a generic resource tree, although it is runtime data.
      { from: path.join(stage, 'game/node_modules/ws'), to: 'game/node_modules/ws', filter: ['**/*'] }
    ],
    afterPack: context => require('./verify-payload.cjs')({ stage, applicationRoot: context.appOutDir, report: path.join(output, 'after-pack-payload-check.json') }),
    npmRebuild: false,
    // Lossless archive compression reduces the runtime and uncompressed audio.
    compression: 'normal',
    forceCodeSigning: false,
    publish: null,
    win: {
      target: [{ target: 'nsis', arch: ['x64'] }],
      requestedExecutionLevel: 'asInvoker',
      signAndEditExecutable: true,
      ...(fs.existsSync(path.join(__dirname, 'resources', 'icon.ico')) ? { icon: path.join(__dirname, 'resources', 'icon.ico') } : {})
    },
    nsis: {
      oneClick: false,
      perMachine: false,
      allowElevation: false,
      allowToChangeInstallationDirectory: true,
      runAfterFinish: false,
      createDesktopShortcut: true,
      createStartMenuShortcut: true,
      shortcutName: '逆转五丈原',
      deleteAppDataOnUninstall: false,
      packElevateHelper: false,
      differentialPackage: false,
      installerLanguages: ['zh_CN'],
      language: '2052',
      include: path.join(__dirname, 'resources', 'installer.nsh'),
      installerIcon: path.join(__dirname, 'resources', 'icon.ico'),
      uninstallerIcon: path.join(__dirname, 'resources', 'icon.ico'),
      artifactName: `Wuzhangyuan-${version || '${version}'}-${label || 'local'}-win-x64-setup.${'${ext}'}`
    }
  };
};
