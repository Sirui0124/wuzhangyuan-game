export type MaterialAppearance = { title: string; kind: 'letter' | 'ledger' | 'report'; inscription: string[] };

// Curated visual inscriptions; ledger headings never invent quantities or seals.
const appearances: Record<string, MaterialAppearance> = {
    'CH2-LY02-014': { title: '领粮凭据', kind: 'report', inscription: ['領糧日期　六月初二', '於永安城', '督衛苟安'] },
    'CH2-LY03-002': { title: '李丰的信', kind: 'letter', inscription: ['前議之事　切勿再行', '若有人問起', '莫再牽及家父'] },
    'CH2-LY04-D01': { title: '本队签收记录', kind: 'ledger', inscription: ['本隊簽收', '批次　經手人', '應交　實收'] },
    'CH2-LY04-D02': { title: '出仓交付记录', kind: 'ledger', inscription: ['出倉交付', '實糧', '缺額'] },
    'CH2-LY04-D03': { title: '本队行程册', kind: 'ledger', inscription: ['本隊行程', '途中損耗', '交付缺額另記'] },
    'CH2-LY04-D04': { title: '本批入仓账', kind: 'ledger', inscription: ['本批入倉', '實糧發往本隊', '未徵齊　缺額'] },
    'CH2-LY04-D05': { title: '地方实收账', kind: 'ledger', inscription: ['地方實收', '本批未收足', '入倉記錄'] },
    'CH2-LY04-D06': { title: '应征与实收记录', kind: 'ledger', inscription: ['應徵', '實收', '欠交'] },
    'CH2-LY06-015': { title: '缺粮报告', kind: 'report', inscription: ['本村追加糧尚未徵齊', '實收不足', '無法按原數交付'] },
    'CH2-LY06-018': { title: '报告送达与签认记录', kind: 'report', inscription: ['報告送達', '苟安簽認', '本批交接當日'] },
    'CH2-LY07-006': { title: '李丰的另一封信', kind: 'letter', inscription: ['家父安危', '停止原先之計'] },
    'UI-DECLARATION': { title: '苟安署名说明', kind: 'report', inscription: ['明知這批糧未徵齊', '卻說已備妥被扣', '照實交代'] },
    'UI-REPLY-LETTER': { title: '回信', kind: 'letter', inscription: ['此次糧乏　應據實請退', '日後是否再戰　留待另議', '借魏之計就此作罷'] },
};
export function materialAppearance(id: string): MaterialAppearance | undefined { return appearances[id]; }
