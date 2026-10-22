import { PRIMARY_VOCABULARY } from './vocabulary-primary.js';
import { INTERMEDIATE_VOCABULARY } from './vocabulary-intermediate.js';
import { CET4_VOCABULARY } from './vocabulary-cet4.js';
import { CET6_VOCABULARY } from './vocabulary-cet6.js';

export const DEFAULT_VOCABULARY_ID = 'primary';

export const VOCABULARIES = [
  { id: 'primary', label: '小六', description: '500词小六阶段选编，保留原有练习词及基础与拓展分组。', groupWeights: [.8, .15, .05], entries: PRIMARY_VOCABULARY },
  { id: 'intermediate', label: '初中进阶', description: '2200词初中及高中衔接选编，包含全部小六词。', groupWeights: [1, 0, 0], entries: INTERMEDIATE_VOCABULARY },
  { id: 'cet4', label: '英语四级', description: '四级词表中的独立英文单词，按拼写去重。', groupWeights: [1, 0, 0], entries: CET4_VOCABULARY },
  { id: 'cet6', label: '英语六级', description: '六级词表中的独立英文单词，按拼写去重。', groupWeights: [1, 0, 0], entries: CET6_VOCABULARY },
];

export function getVocabulary(id) {
  const vocabulary = VOCABULARIES.find(item => item.id === id);
  if (!vocabulary) throw new Error(`Unknown vocabulary: ${id}`);
  return vocabulary;
}

export const VOCABULARY = VOCABULARIES.flatMap(item => item.entries);

export const VOCABULARY_STATUS = {
  mode: 'practice',
  label: '分级练习词库',
  note: '小六和初中进阶为分级选编；四级、六级采用开源词表，不声明等同官方完整考试大纲。',
  source: 'https://github.com/KyleBing/english-vocabulary/tree/c4c6c80879ff17d7025c28fb853a4991c8e6be6a',
};
