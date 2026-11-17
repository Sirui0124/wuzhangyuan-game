import { investigationDialogues } from './dialogues-investigation';
import { authorizationDialogues } from './dialogues-authorization';
import { negotiationDialogues } from './dialogues-negotiation';
import { endingDialogues } from './dialogues-ending';

export const dialogues = [
    ...investigationDialogues,
    ...authorizationDialogues,
    ...negotiationDialogues,
    ...endingDialogues,
];
