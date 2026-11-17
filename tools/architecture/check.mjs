import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sourceRoots = ['GameStarter/web-demo/src', 'GameStarter/assets/scripts', 'content/schema', 'content/examples'];
const maintainedRoots = [...sourceRoots, 'GameStarter/web-demo/public', 'GameStarter/server', 'GameStarter/scripts',
  'GameStarter/tests', 'tools'];
const skip = new Set(['node_modules', '.build', '.cache', 'library', 'temp', '.work', 'video-history']);
const extensions = new Set(['.ts', '.mjs', '.js', '.py', '.css', '.html']);
const normalize = path => path.replaceAll('\\', '/');
const name = path => normalize(relative(root, path));

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (skip.has(entry.name) || entry.name.startsWith('.')) return [];
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? walk(path) : extensions.has(extname(path)) ? [path] : [];
  });
}

/** Static imports, re-exports and literal dynamic imports, including erased type edges. */
export function imports(path, text) {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const refs = [];
  const visit = node => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      const importing = ts.isImportDeclaration(node);
      const clause = importing ? node.importClause : node.exportClause;
      const named = importing ? clause?.namedBindings : clause;
      const namedTypesOnly = named && (ts.isNamedImports(named) || ts.isNamedExports(named)) &&
        named.elements.length > 0 && named.elements.every(item => item.isTypeOnly);
      const typeOnly = node.isTypeOnly || clause?.isTypeOnly ||
        (namedTypesOnly && (!importing || !clause.name));
      refs.push({ specifier: node.moduleSpecifier.text, typeOnly: !!typeOnly });
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const target = node.arguments[0];
      if (target && (ts.isStringLiteral(target) || ts.isNoSubstitutionTemplateLiteral(target))) {
        refs.push({ specifier: target.text, typeOnly: false });
      }
    }
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) {
      refs.push({ specifier: node.argument.literal.text, typeOnly: true });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return refs;
}

function boundaryError(from, to) {
  const chapter = path => path.match(/\/src\/chapters\/([^/]+)\//)?.[1];
  if (chapter(from) && chapter(to) && chapter(from) !== chapter(to)) return '章节不得导入其他章节实现';
  if (from.includes('/src/legacy/') && (/\/src\/game(?:\/|\.ts)/.test(to) || chapter(to))) return '旧版不得依赖当前关卡实现';
  if (!from.includes('/src/legacy/') && !from.endsWith('/src/app.ts') && to.includes('/src/legacy/')) return '当前代码不得依赖旧版实现';
  if (from.includes('/src/session/') && chapter(to)) return '共享会话契约不得依赖具体章节';
  return '';
}

/** Pure dependency analysis. Tests provide source text without creating project files. */
export function analyzeDependencies(sources, describe = normalize) {
  const files = new Map([...sources].map(([path, text]) => [resolve(path), text]));
  const errors = [], graph = new Map(), allDependencies = new Map();
  for (const [path, text] of files) {
    const dependencies = [], all = [];
    for (const ref of imports(path, text).filter(ref => ref.specifier.startsWith('.'))) {
      const base = resolve(dirname(path), ref.specifier.replace(/\.js$/, ''));
      const target = [base + '.ts', resolve(base, 'index.ts')].find(candidate => files.has(candidate));
      if (!target) { errors.push(`${describe(path)}: 导入不存在 ${ref.specifier}`); continue; }
      all.push(target);
      if (!ref.typeOnly) dependencies.push(target);
    }
    graph.set(path, [...new Set(dependencies)]);
    allDependencies.set(path, [...new Set(all)]);
  }
  // Check every reachable owner, not just the first edge. A facade cannot hide its chapter.
  // Type-only paths also cross ownership boundaries, although they cannot cause runtime cycles.
  for (const origin of allDependencies.keys()) {
    const reached = new Set([origin]), queue = [[origin]];
    for (let index = 0; index < queue.length; index++) {
      const trail = queue[index];
      for (const target of allDependencies.get(trail.at(-1)) ?? []) {
        if (reached.has(target)) continue;
        reached.add(target);
        const route = [...trail, target];
        const error = boundaryError(normalize(origin), normalize(target));
        if (error) errors.push(`${route.map(describe).join(' → ')}: ${error}`);
        else queue.push(route);
      }
    }
  }
  const complete = new Set(), visiting = new Set(), chain = [];
  function visit(path) {
    if (visiting.has(path)) { errors.push(`运行时循环依赖: ${[...chain.slice(chain.indexOf(path)), path].map(describe).join(' → ')}`); return; }
    if (complete.has(path)) return;
    visiting.add(path); chain.push(path);
    for (const dependency of graph.get(path) ?? []) visit(dependency);
    chain.pop(); visiting.delete(path); complete.add(path);
  }
  for (const path of graph.keys()) visit(path);
  return { errors, runtimeModules: graph.size };
}

/** Subtitle presentation has one owner; later chapter styles must not override chapter one. */
export function subtitleStyleErrors(path, source) {
  const file = normalize(path);
  if (!/GameStarter\/web-demo\/(?:public|src)\//.test(file) || !/\.(?:css|html|ts)$/.test(file)) return [];
  const text = source.replace(/\/\*[\s\S]*?\*\//g, '');
  if (!/::cue\b/.test(text)) return [];
  return file.endsWith('/public/subtitles.css') ? []
    : [`${file}: 字幕样式只能定义在 public/subtitles.css；所有章节（包括第三章）沿用第一章标准`];
}

export function checkArchitecture() {
  const errors = [], warnings = [], stats = [], sources = new Map();
  const files = [...new Set(maintainedRoots.flatMap(directory => walk(resolve(root, directory))))];
  const tsFiles = new Set(sourceRoots.flatMap(directory => walk(resolve(root, directory))).filter(path => path.endsWith('.ts')));
  for (const path of files) {
    const text = readFileSync(path, 'utf8');
    errors.push(...subtitleStyleErrors(name(path), text));
    const lines = text.trimEnd().split(/\r?\n/).length;
    const limit = ['.css', '.html'].includes(extname(path)) ? 700 : 500;
    stats.push({ path: name(path), lines, characters: text.length });
    if (lines > limit || text.length > 32000) warnings.push(`${name(path)}: ${lines} 行 / ${text.length} 字符，建议不超过 ${limit} 行 / 32000 字符`);
    if (tsFiles.has(path)) sources.set(path, text);
  }
  const dependencies = analyzeDependencies(sources, name);
  errors.push(...dependencies.errors);
  return { passed: !errors.length, checkedFiles: files.length, runtimeModules: dependencies.runtimeModules,
    limits: { codeLines: 500, styleAndHtmlLines: 700, characters: 32000 },
    errors, warnings, largest: stats.sort((a, b) => b.characters - a.characters).slice(0, 15) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = checkArchitecture();
  const output = resolve(root, 'outputs/architecture-20261023/architecture.json');
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  for (const warning of report.warnings) console.warn(`Size advisory: ${warning}`);
  if (report.passed) console.log(`Architecture passed: ${report.checkedFiles} maintained files, ${report.runtimeModules} TypeScript modules; imports, chapter boundaries and runtime cycles checked.`);
  else { console.error(report.errors.join('\n')); process.exitCode = 1; }
}
