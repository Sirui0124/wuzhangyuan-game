
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createStaticServer } from '../../GameStarter/web-demo/serve.mjs';

const build = resolve(process.argv[2] ?? 'GameStarter/web-demo/.build');
const output = resolve(process.argv[3] ?? 'outputs/thought-final-20261023');
mkdirSync(output, { recursive: true });
const { ChapterSession } = await import(pathToFileURL(resolve(build, 'GameStarter/web-demo/src/chapter-session.js')));
const json = file => JSON.parse(readFileSync(resolve(build, file), 'utf8'));
const script = json('story/chapter-one.script.json'), flow = json('story/chapter-one.flow.json'), version = json('story/session-manifest.json').contentVersion;
const session = new ChapterSession(script, flow, version);
const read = () => { let count = 0; while (session.snapshot().phase === 'dialogue' && count++ < 200) session.nextLine(); assert.ok(count < 200); };
const act = id => { const action = flow.actions.find(item => item.id === id); if (session.snapshot().scene !== action.scene) session.move(action.scene); assert.ok(session.act(id)); read(); };
session.finishCinematic(); read(); ['read-notice', 'meet-first-scout'].forEach(act); session.chooseScout('a'); read(); act('intercept-first');
session.setFocus('我来转呈信息'); session.restoreSuggestion(); await session.confirmExpression(); session.acknowledgeReply(); read();
['deliver-first', 'stand-watch'].forEach(act); session.finishCinematic(); read(); session.rewind(); read(); ['ask-guard', 'ask-relay', 'ask-scout'].forEach(act); assert.ok(session.beginThinking());
assert.equal(session.snapshot().thinking.history.length, 0);
session.placeThought('C04');
writeFileSync(resolve('GameStarter/web-demo/public/art-review/thought-playtest.json'),session.serialize());
console.log('Playable fixture generated from actual chapter actions');
