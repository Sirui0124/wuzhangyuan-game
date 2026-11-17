import { jiangDutyMigration } from './jiang-duty-migration';
import { sixClueMigration } from './clue-save-migration';
// Verified 2026-10-23: only C07.summary changed from “姜维受命接报处置”
// to “丞相让姜维代为处置军报”; script version, IDs, rules and flow are identical.
const c07TitleMigration = {
    from: '3bd9c4a6b70da9acb616d9aba1fb2b8aecf85b423aafb7306446f7f291d64ad3',
    to: '497cb95b2874e57c4e4fc36a83e8faa80d3353a14fea18a0749ddb4ace0f9d5e'
};
// Verified 2026-10-24: only read-notice.description was cleared; all story rows and rules match.
const noticeHintMigration = {
    from: '7169c1276a20a3d18c2aa6c3afac88a82bb515faf8758fec2054d5ea6cda74d9',
    to: 'e3fbd99fd36ef1037d64a4b349addfcc28c52d12fa966afe03fb79ff7d58f875'
};
// Verified 2026-10-27: three action labels and one section title replace
// 甲/乙 with their existing roles. Story rows, IDs, conditions and events match.
export const roleLabelMigration = {
    from: '87f1e97bc7e78917ffd471c57b76ef615ec99f5f7e26af109abb4c0fe52798a1',
    to: 'd777dbf5095f892f85dd219970b5cf7afa9bb83c197a534047bc9576a54c922f'
};
export function migrationRuleVersion(currentVersion: string): string {
    return currentVersion === roleLabelMigration.to ? roleLabelMigration.from : currentVersion;
}

export function isCompatibleContentVersion(savedVersion: unknown, currentVersion: string): boolean {
    const rulesVersion = migrationRuleVersion(currentVersion);
    return savedVersion === currentVersion
        || (currentVersion === roleLabelMigration.to && savedVersion === roleLabelMigration.from)
        || (rulesVersion === jiangDutyMigration.to && [jiangDutyMigration.from, sixClueMigration.from].includes(savedVersion as string))
        || (savedVersion === sixClueMigration.from && rulesVersion === sixClueMigration.to)
        || (savedVersion === c07TitleMigration.from && rulesVersion === c07TitleMigration.to)
        || (savedVersion === noticeHintMigration.from && rulesVersion === noticeHintMigration.to);
}
