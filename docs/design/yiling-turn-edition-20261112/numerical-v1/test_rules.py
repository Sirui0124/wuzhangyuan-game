import unittest
from copy import deepcopy
from simulate import Game,simulate
class Rules(unittest.TestCase):
 def test_multiple_solutions(self):
  for name in ['balanced','targeted','leave_reserve']:
   r=simulate(name);self.assertEqual(len(r['saved']),4);self.assertEqual(r['unreturnedTeams'],0);self.assertEqual(r['trappedTeams'],0)
 def test_overwork_not_free(self):
  a,b,c=map(simulate,['balanced','targeted','rush_all'])
  self.assertLess(b['rounds'],a['rounds']);self.assertGreater(b['unavailable'],a['unavailable']);self.assertGreaterEqual(c['rounds'],a['rounds']);self.assertGreater(c['unavailable'],b['unavailable'])
 def test_wrong_role_not_work(self):
  r=simulate('assault');self.assertNotIn('M',r['completeRoutes']);self.assertGreater(r['margin']['M'],0)
 def test_environment_changes_choice(self):
  self.assertNotIn('傅肜',simulate('balanced',fu_margin=20)['saved'])
  for p in ['targeted','stabilize']:self.assertIn('傅肜',simulate(p,fu_margin=20)['saved'])
 def test_idempotent_round(self):
  g=Game();g.step(['F:rear']+['camp']*4,key='same');a=deepcopy(g.__dict__);g.step(['F:rear']+['camp']*4,key='same');self.assertEqual(a,g.__dict__)
 def test_no_overspend_or_partial_mutation(self):
  g=Game();g.stock=0;a=deepcopy(g.__dict__)
  with self.assertRaises(AssertionError):g.step(['F:rear']+['camp']*4,rush=[0])
  self.assertEqual(a,g.__dict__)
 def test_no_teleport(self):
  g=Game();g.step(['F:rear']+['camp']*4)
  with self.assertRaises(AssertionError):g.step(['M:flag']+['camp']*4)
  g.step(['return']+['camp']*4);g.step(['M:flag']+['camp']*4)
 def test_stage_barriers(self):
  g=Game();g.step(['F:rear','M:flag','M:clear','S:gate','S:search'],rush=[0,1,2,3,4]);self.assertEqual(g.fwithdraw,0);self.assertEqual(g.merge,0);self.assertEqual(g.evacuated,0)
 def test_rest_not_resurrection(self):
  g=Game();g.step(['F:rear']+['camp']*4);g.step(['return']+['camp']*4);n=g.units[0].n;f=g.units[0].fatigue;g.step(['camp']*5);self.assertEqual(g.units[0].n,n);self.assertLess(g.units[0].fatigue,f)
 def test_promise_due_after_execution_and_once(self):
  g=Game();g.promise('p',0,2);g.promise('p',0,2);g.step(['F:rear']+['camp']*4);g.step(['return']+['camp']*4);self.assertEqual(g.promises[0]['status'],'kept');self.assertEqual(len(g.promises),1)
  g=Game();g.promise('q',0,1);g.step(['F:rear']+['camp']*4);self.assertEqual(g.promises[0]['status'],'broken');stock=g.stock;g.step(['F:rear']+['camp']*4,rush=[0]);self.assertEqual(stock-g.stock,2)
 def test_single_person_ending(self):
  g=Game();g.step(['M:clear']+['camp']*4,rush=[0]);g.step(['return']+['camp']*4,extract_zhang=0);self.assertIn('张南',g.saved);self.assertNotIn('冯习',g.saved);self.assertFalse(g.complete('M'))
 def test_crisis_stabilize_once(self):
  g=Game();g.step(['F:rear']+['camp']*4,boost='F');self.assertEqual(g.stock,4)
  with self.assertRaises(AssertionError):g.step(['F:rear']+['camp']*4,boost='F')
if __name__=='__main__':unittest.main(verbosity=2)
