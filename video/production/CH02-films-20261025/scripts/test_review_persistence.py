import tempfile,unittest
from pathlib import Path
from review_store import ReviewStore
class StoreTest(unittest.TestCase):
 def test_restart_conflict_and_history(self):
  with tempfile.TemporaryDirectory() as d:
   s=ReviewStore(d);body={'id':'V01','baseRevision':0,'note':'中文意见\n保留原文','approvals':{},'reviewedVersions':{'old.mp4':{}}}
   code,r=s.update(body);self.assertEqual(code,200)
   self.assertEqual(ReviewStore(d).read()['records']['V01']['note'],body['note'])
   self.assertEqual(s.update({**body,'note':'旧标签页覆盖'})[0],409)
   self.assertEqual(s.read()['records']['V01']['note'],body['note'])
   self.assertEqual(len((Path(d)/'reviews/saved/review-history.jsonl').read_text(encoding='utf-8').splitlines()),2)
if __name__=='__main__':unittest.main()
