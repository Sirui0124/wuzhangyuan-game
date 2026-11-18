import {readFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {fileURLToPath} from 'node:url';
import {readProfiles,selectProfile} from '../../GameStarter/server/model-profiles.mjs';
const settings=process.env.GAME_SETTINGS_FILE||fileURLToPath(new URL('../../GameStarter/server/.env',import.meta.url));
export async function modelConfig(settingsFile=settings){let env={};try{env=parseEnv(await readFile(settingsFile,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}return selectProfile({apiKey:env.DEEPSEEK_API_KEY??process.env.DEEPSEEK_API_KEY??'',baseUrl:env.DEEPSEEK_BASE_URL??process.env.DEEPSEEK_BASE_URL??'https://api.deepseek.com',model:env.DEEPSEEK_MODEL??process.env.DEEPSEEK_MODEL??'deepseek-flash',...(env.DEEPSEEK_SYSTEM_BASE_URL?{systemBaseUrl:env.DEEPSEEK_SYSTEM_BASE_URL}:{})},await readProfiles(settingsFile)).config;}
export function parseJSON(text){const cleaned=text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');return JSON.parse(cleaned);}
