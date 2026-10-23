import { PRIMARY_VOCABULARY } from './vocabulary-primary.js';
import { INTERMEDIATE_VOCABULARY } from './vocabulary-intermediate.js';
import { CET4_VOCABULARY } from './vocabulary-cet4.js';
import { CET6_VOCABULARY } from './vocabulary-cet6.js';

export const DEFAULT_VOCABULARY_ID = 'primary';

export const VOCABULARIES = [
  { id: 'primary', label: '小六', description: '500词小学基础选编，覆盖日常主题、数词与月份等基础表达。', groupWeights: [.8, .15, .05], entries: PRIMARY_VOCABULARY },
  { id: 'intermediate', label: '初中进阶', description: '2200词初中及高中衔接选编，包含全部小六词。', groupWeights: [1, 0, 0], entries: INTERMEDIATE_VOCABULARY },
  { id: 'cet4', label: '英语四级', description: '依2016年官方大纲四级基础部分选编，包含派生词及合法英美拼法。', groupWeights: [1, 0, 0], entries: CET4_VOCABULARY },
  { id: 'cet6', label: '英语六级（进阶）', description: '依官方大纲星号六级部分选编，含派生词，不重复四级基础拼写。', groupWeights: [1, 0, 0], entries: CET6_VOCABULARY },
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
  note: '小六和初中进阶为分级选编；四级基础与六级进阶按官方大纲分级，派生词和合法拼法展开，非官方原始词目计数。',
  source: 'https://cet.neea.edu.cn/res/Home/1704/55b02330ac17274664f06d9d3db8249d.pdf',
};
