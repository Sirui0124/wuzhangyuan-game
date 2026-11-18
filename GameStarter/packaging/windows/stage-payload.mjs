import ts from 'typescript';
import { readdirSync, readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, lstatSync, rmSync } from 'node:fs';
import { resolve, dirname, relative, sep, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { prepareReleaseWeb } from './release-profile.mjs';

export const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const slash = value => value.replaceAll('\\', '/');
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const comparisonPages = new Set(['art-review.html', 'modal-suite.html', 'thought-options.html', 'menu-button-options.html']);
const comparisonModules = new Set(['art-review.js', 'art-review-layout.js', 'modal-suite.js', 'thought-options.js']);
const backendFiles = ['server.mjs', 'model-profiles.mjs', 'model-transport.mjs', 'package.json', 'chapter-one-ai.mjs', 'chapter-one-http.mjs'];

export function excludedReason(path) {
    path = slash(path);
    const parts = path.split('/');
    if (path.startsWith('yiling-rescue/')) return 'retired-nine-route-demo';
    if (parts.some(part => /^\.env(?:\.|$)/i.test(part) || /^(?:api-defaults|.*credentials.*)\.json$/i.test(part))
        || /\.(?:key|pem|p12|pfx|keystore|jks)$/i.test(path)) return 'credentials-or-private-configuration';
    if (parts.some(part => ['.git', '.cache', 'library', 'temp', 'node_modules', 'outputs'].includes(part))) return 'development-or-cache-directory';
    if (path.startsWith('playtest/')) return 'isolated-playtest-save';
    if (path.startsWith('art-review/') && !['art-review/themes.css', 'art-review/mindmap.css'].includes(path)) return 'design-comparison-only';
    if (comparisonPages.has(path)) return 'design-comparison-page';
    if (path.startsWith('GameStarter/web-demo/src/') && comparisonModules.has(path.slice('GameStarter/web-demo/src/'.length))) return 'design-comparison-module';
    if (/\.(?:ts|tsbuildinfo|map)$/i.test(path)) return 'source-or-build-metadata';
    return null;
}

function walk(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const path = resolve(directory, entry.name);
        if (entry.isSymbolicLink()) throw new Error(`Symbolic links are not accepted in release payloads: ${path}`);
        return entry.isDirectory() ? walk(path) : [path];
    });
}

export function validatedStageDirectory(stageRoot, root = workspaceRoot) {
    const target = resolve(stageRoot), allowed = resolve(root, '.cache');
    if (!target.startsWith(allowed + sep)) throw new Error('Release staging must be a named directory inside this workspace .cache');
    const game = resolve(target, 'game');
    if (!game.startsWith(target + sep) || game === allowed) throw new Error('Unsafe staging target');
    return { target, game };
}

export function validatePayload(gameRoot) {
    const game = resolve(gameRoot), web = resolve(game, 'web');
    const required = [
        'web/index.html', 'web/GameStarter/web-demo/src/entry.js', 'web/GameStarter/assets/scripts/GameApi.js',
        'web/GameStarter/assets/scripts/narrative/state.js', 'web/GameStarter/assets/scripts/narrative/conditions.js',
        'web/story/session-manifest.json', 'web/story/chapter-one.script.json', 'web/story/chapter-one.flow.json',
        'web/story/chapter-one.branch.json', 'web/release-profile.json', 'web/cinematics.json',
        'web/audio/manifest.json', 'web/art-review/themes.css', 'web/art-review/mindmap.css',
        'GameStarter/server/server.mjs', 'GameStarter/server/package.json', 'GameStarter/web-demo/serve.mjs',
        'demos/yiling-ui-prototype-v1/campaign-runtime.mjs', 'demos/yiling-ui-prototype-v1/campaign-engine.mjs',
        'demos/yiling-ui-prototype-v1/model-config.mjs', 'demos/yiling-ui-prototype-v1/crisis-rules.mjs',
    ];
    const errors = [], checks = { requiredFiles: 0, moduleImports: 0, staticReferences: 0 };
    function requireFile(path, message) {
        if (!path.startsWith(game + sep) || !existsSync(path) || !lstatSync(path).isFile()) errors.push(message);
    }
    for (const name of required) { requireFile(resolve(game, name), `Missing runtime dependency: ${name}`); checks.requiredFiles++; }
    for (const path of walk(game)) {
        const name = slash(relative(game, path));
        if (name.startsWith('demos/yiling-rescue/') || name.startsWith('web/yiling-rescue/')) errors.push(`Retired nine-route runtime in current payload: ${name}`);
        if (/(^|\/)\.env(?:\.|$)|\.(?:key|pem|p12|pfx|jks|keystore)$/i.test(name)) errors.push(`Forbidden private file: ${name}`);
        const extension = extname(path);
        if (['.js', '.mjs'].includes(extension) && !name.startsWith('node_modules/')) {
            const content = readFileSync(path, 'utf8');
            const imports = content.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)(['"])(\.[^'"\s]+)\1/g);
            for (const match of imports) {
                requireFile(resolve(dirname(path), match[2]), `Missing import ${match[2]} from ${name}`); checks.moduleImports++;
            }
        }
        if (name.startsWith('web/') && ['.html', '.css'].includes(extension)) {
            const content = readFileSync(path, 'utf8');
            const refs = extension === '.html' ? [...content.matchAll(/(?:src|href)\s*=\s*['"]([^'"]+)['"]/g)].map(match => match[1])
                : [...content.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/g)].map(match => match[1]);
            for (const ref of refs) {
                if (/^(?:[a-z][a-z\d+.-]*:|#|\?)/i.test(ref) || ref.includes('${') || ref.includes('<')) continue;
                const clean = decodeURIComponent(ref.split(/[?#]/)[0]);
                const target = clean.startsWith('/') ? resolve(web, '.' + (clean === '/' ? '/index.html' : clean)) : resolve(dirname(path), clean);
                requireFile(target, `Missing static reference ${ref} from ${name}`); checks.staticReferences++;
            }
        }
    }
    if (errors.length) throw new Error(errors.join('\n'));
    return checks;
}

/** Stage a curated runtime payload. Original media and user data are never modified. */
export function stagePayload(buildRoot, stageRoot, root = workspaceRoot) {
    const build = resolve(buildRoot), { target, game } = validatedStageDirectory(stageRoot, root);
    if (!existsSync(resolve(build, 'index.html'))) throw new Error(`Not a complete web build: ${build}`);
    if (build === game || build.startsWith(game + sep) || game.startsWith(build + sep)) throw new Error('Build and stage payload must not overlap');
    // Only this previously resolved workspace cache target is cleared; release outputs are untouched.
    if (existsSync(game)) rmSync(game, { recursive: true, force: true });
    mkdirSync(game, { recursive: true });
    const files = [], excluded = [];
    function add(source, destination, group) {
        const output = resolve(game, destination);
        if (!output.startsWith(game + sep)) throw new Error(`Invalid destination: ${destination}`);
        if (lstatSync(source).isSymbolicLink()) throw new Error(`Symbolic link input: ${source}`);
        mkdirSync(dirname(output), { recursive: true }); copyFileSync(source, output);
        const size = lstatSync(output).size, sha256 = hash(output);
        if (hash(source) !== sha256) throw new Error(`Copy verification failed: ${source}`);
        files.push({ source: slash(source), destination: `resources/game/${slash(destination)}`, bytes: size, sha256, group });
    }
    const releaseWeb = resolve(target,'release-web');
    if (!releaseWeb.startsWith(target + sep)) throw new Error('Unsafe release web directory');
    if (existsSync(releaseWeb)) rmSync(releaseWeb, {recursive:true,force:true});
    const prepared = prepareReleaseWeb(build, releaseWeb, excludedReason);
    excluded.push(...prepared.report.removed);
    for (const source of walk(prepared.directory)) {
        const name = slash(relative(prepared.directory, source)), reason = excludedReason(name);
        if (reason) excluded.push({ path: name, bytes: lstatSync(source).size, reason });
        else add(source, `web/${name}`, 'web');
    }
    for (const name of backendFiles) add(resolve(root, 'GameStarter/server', name), `GameStarter/server/${name}`, 'backend');
    // The integrated command-map backend must ship without relying on Node's TS loader.
    const generated = resolve(target, 'compiled-runtime'); mkdirSync(generated, { recursive: true });
    for (const name of ['campaign-runtime.mjs', 'campaign-engine.mjs', 'model-config.mjs', 'crisis-rules.mjs', 'crisis-v3.mjs', 'crisis-events.mjs', 'crisis-event-ai.mjs', 'fu-ai.mjs', 'report-ai.mjs', 'route-config.mjs', 'route-ai.mjs']) {
        const source = resolve(root, 'demos/yiling-ui-prototype-v1', name);
        if (name === 'campaign-engine.mjs') {
            const compiled = resolve(generated, name);
            writeFileSync(compiled, readFileSync(source, 'utf8').replace('furong-rescue.ts', 'furong-rescue.mjs'));
            add(compiled, `demos/yiling-ui-prototype-v1/${name}`, 'command-backend');
        } else add(source, `demos/yiling-ui-prototype-v1/${name}`, 'command-backend');
    }
    const designDir = 'docs/design/chapter-four-ai-library-20261117';
    const ruleFile = resolve(generated, 'furong-rescue.mjs');
    writeFileSync(ruleFile, ts.transpileModule(readFileSync(resolve(root, designDir, 'furong-rescue.ts'), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText);
    add(ruleFile, `${designDir}/furong-rescue.mjs`, 'command-rules');
    add(resolve(root, designDir, 'furong-rescue.design.json'), `${designDir}/furong-rescue.design.json`, 'command-rules');
    add(resolve(root, 'GameStarter/web-demo/serve.mjs'), 'GameStarter/web-demo/serve.mjs', 'static-server');
    const checks = validatePayload(game);
    const manifest = { schemaVersion: 1, createdAt: new Date().toISOString(), status: 'staged-runtime-payload', platform: 'win32-x64',
        buildRoot: slash(build), stageRoot: slash(target), totals: { files: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0), excluded: excluded.length },
        optimization: prepared.report,
        validation: checks, files, excluded };
    writeFileSync(resolve(target, 'payload-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    writeFileSync(resolve(target, 'payload-files.txt'), files.map(file => `${file.destination}\t${file.bytes}\t${file.sha256}\t${file.source}`).join('\n') + '\n');
    return manifest;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const [build, stage] = process.argv.slice(2);
    if (!build || !stage) throw new Error('Usage: node stage-payload.mjs <webBuildRoot> <stageRoot>');
    const result = stagePayload(build, stage);
    console.log(JSON.stringify({ status: result.status, stageRoot: result.stageRoot, totals: result.totals, validation: result.validation }, null, 2));
}
