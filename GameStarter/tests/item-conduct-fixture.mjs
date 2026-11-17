import { withItemDialogue as adapter } from '../web-demo/.build/GameStarter/web-demo/src/item-dialogue.js';
import { itemConductPrompt } from '../web-demo/.build/GameStarter/web-demo/src/weiyan-item-conduct.js';

// Existing item/economy tests isolate their subject from the independent conduct model.
// The production adapter and actual conduct responses are exercised in item-conduct.test.mjs.
export function withItemDialogue(api, original) {
 return adapter({respond:async(request,...args)=>request.text.startsWith(itemConductPrompt)
  ? {text:JSON.stringify({type:'none',quote:'',reason:'测试夹具：本用例专测物品能力与状态，无独立行为处罚。'})}
  : api.respond(request,...args)},original);
}
