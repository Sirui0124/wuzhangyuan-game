import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanCueEnding, normalizeVtt, parseVtt, checkEmptyTrack } from './subtitles.mjs';

test('display cleanup preserves internal punctuation, questions and ellipses', () => {
  assert.equal(cleanCueEnding('将军，军情紧急。'), '将军，军情紧急');
  assert.equal(cleanCueEnding('你先说，'), '你先说');
  for (const text of ['怎么了？', '留步！', '我……', 'Wait...', '他说：“留步。”']) assert.equal(cleanCueEnding(text), text);
});
test('an empty track cannot silently inherit a different video review', () => {
  const clip = {id:'ending'}, film = {sha256:'new-version'};
  assert.throws(() => checkEmptyTrack(clip, film, [], []), /empty subtitles/);
  const review = {id:'ending', videoSha256:'old-version', status:'planned-no-dialogue', reason:'No speech in the brief'};
  assert.throws(() => checkEmptyTrack(clip, film, [], [review]), /exact video SHA/);
  review.videoSha256 = film.sha256;
  assert.equal(checkEmptyTrack(clip, film, [], [review]), null);
  review.status = 'unexpected-speech';
  assert.equal(checkEmptyTrack(clip, film, [], [review]), 'ending');
});
test('multiline cue cleanup leaves timings, metadata and words intact', () => {
  const source = 'WEBVTT\r\n\r\nNOTE 原始备注。\r\n\r\n1\r\n00:00:01.250 --> 00:00:03.500 line:80%\r\n将军，\r\n请留步。\r\n\r\n';
  const normalized = normalizeVtt(source);
  assert.ok(normalized.includes('NOTE 原始备注。'));
  assert.ok(normalized.includes('line:80%'));
  assert.deepEqual(parseVtt(normalized), [{start:1.25,end:3.5,text:'将军，\n请留步'}]);
  assert.equal(normalizeVtt(normalized), normalized);
});

test('WebVTT accepts BOM and short timestamps but rejects invalid header and minute ranges', () => {
  assert.deepEqual(parseVtt('\uFEFFWEBVTT\r\n\r\n00:01.000 --> 00:02.500\r\n军情已报\r\n'), [{start:1,end:2.5,text:'军情已报'}]);
  for (const source of ['WEBVTTinvalid\n\n', 'WEBVTT\n00:00:00.000 --> 00:00:01.000\n丢失的字幕',
    'WEBVTT\n\n00:60:00.000 --> 01:01:00.000\n错位', 'WEBVTT\n\n00:00:01.000 --> 00:00:61.000\n错位']) assert.throws(() => parseVtt(source));
});
