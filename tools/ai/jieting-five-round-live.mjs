import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
if(!process.argv.includes('--live'))throw Error('Explicit --live required');
const root=resolve('GameStarter/web-demo/.build/GameStarter/web-demo/src/chapters/chapter-three');
const {createJietingPlaytest}=await import(pathToFileURL(resolve(root,'session.js')));
const {judgeJietingDialogue}=await import(pathToFileURL(resolve(root,'open-dialogue.js')));
const story=JSON.parse(readFileSync('content/chapters/jieting/chapter-three.story.json'));
const s=createJietingPlaytest(story,'reinforcement',{aiEnabled:true});
const output=resolve('outputs/jieting-five-rounds-20261027');mkdirSync(output,{recursive:true});
const words=[
    '暂照原令，我先到山下把情况问明白，再回来禀报。',
    '这回先不增兵，我把现有各队的去处再问一遍。',
    '将军，探马只见游骑在侧路探路，不能说他们已经冲阵。可王将军这五千人得同时守正面和侧路，哪边抽走人都要空一处。下山以后还得列阵，等告急才去怕来不及。请先另派一队补守侧路，正面的队伍不动；进退仍听您的令，下面守稳了，您才好择机出击。',
    '先前的队伍已经分去守路，不能再叫他们来回护水。山上的水都得从下面挑，取水队又被敌骑的箭逼了回来，水源倒还在。请另外派一队沿水路护送往返的人，守路的人不撤。这样山上才有水继续待命，也不至于为一担水乱了您原来的部署。',
    '将军原想等魏军攻山疲惫再出击，可两次军报都没见他们上来，再等也未必等得到这个机会。路和水交给已有的队伍守着，请再放一队在坡脚作机动，随您的号令去接应山上下来的兵，也可往敌军露出的空处出击。王将军带队，打不打、何时打都由您定；山上仍留五千守营，我们不替您把战机丢了。',
];
const results=[];
try{
    for(let i=0;i<words.length&&s.current.act===2;i++){
        assert.equal(s.current.id,`JT-OPEN-R${i+1}`);
        s.state.draft=words[i];
        const before=s.below,context=s.getEvaluationContext();
        let j=await judgeJietingDialogue({context,input:s.state.draft,clueIds:[],confirmed:true},AbortSignal.timeout(60000));
        const result={round:i+1,before,input:s.state.draft,judgment:j};results.push(result);
        assert.ok(s.submit(j),'live judgment was accepted by local state');s.advance();
        if(j.status==='followup'){
            result.followupQuestion=s.state.unresolvedConcerns;
            s.state.draft=words[i]+' 我请的只是把这处还缺的人手补上，原来已定的岗位不撤，进退仍由将军发令。';
            j=await judgeJietingDialogue({context:s.getEvaluationContext(),input:s.state.draft,clueIds:[],confirmed:true},AbortSignal.timeout(60000));
            result.followupJudgment=j;assert.ok(s.submit(j));s.advance();
        }
        for(let k=0;k<150&&s.current.act===2&&s.current.kind!=='open';k++)assert.ok(s.advance(),s.current.id);
        result.after=s.below;result.record=s.state.roundResults[i+1];
        writeFileSync(resolve(output,'live.json'),JSON.stringify({results,below:s.below,node:s.current.id},null,2));
        console.log(JSON.stringify({round:i+1,outcome:j.outcome,topic:j.argument?.topic,before,after:s.below,response:j.response}));
    }
    assert.equal(results.length,5);assert.equal(s.below,20000);assert.equal(s.above,5000);assert.equal(s.current.act,3);
    console.log('LIVE_PASS: two declined orders, three distinct accepted arguments, five live turns, actual arrival 20000/5000');
}catch(e){writeFileSync(resolve(output,'live.json'),JSON.stringify({results,below:s.below,node:s.current.id,error:e.message},null,2));throw e;}
