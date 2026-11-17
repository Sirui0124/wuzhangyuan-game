from pathlib import Path
R=Path(__file__).resolve().parent
p=R.parent/'PV-H3-20261116-v2.8/check_review.mjs'
s=p.read_text('utf-8').replace('PV-H3-20261116-v2.8','PV-H3-20261117-v2.9').replace('v2.8','v2.9').replace("hasText:'熊熊大火'","hasText:'揭开连营大火'").replace("date:'2026-11-16'","date:'2026-11-17'")
(R/'check_review.mjs').write_text(s,'utf-8')
