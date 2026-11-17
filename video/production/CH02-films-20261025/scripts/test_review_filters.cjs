const assert=require('node:assert/strict');require('./review-state.js');const R=globalThis.ChapterReview;
const c={id:'V1',file:'new.mp4'},notes={},approvals={},history={};
assert.equal(R.reviewClass(c,notes,approvals,history),'unseen');
history.V1={'old.mp4':{}};notes.V1='旧版意见';
assert.equal(R.reviewClass(c,notes,approvals,history),'recheck');
assert.equal(R.approved(c,{V1:{'old.mp4':{approved:true}}}),false);
history.V1['new.mp4']={};assert.equal(R.reviewClass(c,notes,approvals,history),'reviewed');
const out=R.exportScene({title:'测试',clips:[c,{id:'V2',name:'另一分支',file:'other.mp4'}]},notes,approvals);
assert.ok(out.includes('V2'));assert.ok(out.includes('旧版意见'));console.log('Review filters/version/export tests passed');
