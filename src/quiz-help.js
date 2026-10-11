import { mathText } from './math-display.js';

const equation=text=>'<p class="help-equation">'+mathText(text)+'</p>';
const step=(title,text)=>'<section class="help-example"><h3>'+title+'</h3>'+text+'</section>';
const branch=(value,children=[])=>'<div class="factor-branch"><span class="factor-node">'+value+'</span>'+(children.length?'<div class="factor-children">'+children.join('')+'</div>':'')+'</div>';
const tree=(label,value,children)=>'<div class="factor-tree" role="img" aria-label="'+label+'">'+branch(value,children)+'</div>';
const trees=(a,b)=>'<div class="factor-pair">'+a+b+'</div>';

// 例题使用固定小整数，不直接代算当前题；同题型的所有题目复用一篇简短讲解。
const lessons={
  gcd:{title:'最大公因数：找共同的因数',html:
    '<p><b>因数：</b>能把一个数整除的数。<b>公因数：</b>两个数都有的因数。里面最大的，就是最大公因数。</p>'+
    step('例 1 · 找 12 和 18 的最大公因数','<p>先列出来，圈出相同的：</p><p>12 的因数：<mark>1</mark>、<mark>2</mark>、<mark>3</mark>、4、<mark>6</mark>、12<br>18 的因数：<mark>1</mark>、<mark>2</mark>、<mark>3</mark>、<mark>6</mark>、9、18</p><p>共同的有 1、2、3、6，最大的为 <b>6</b>。</p>')+
    step('换一种办法 · 分叉拆开',trees(tree('12 分成 2 乘 6，6 再分成 2 乘 3',12,[branch(2),branch(6,[branch(2),branch(3)])]),tree('18 分成 2 乘 9，9 再分成 3 乘 3',18,[branch(2),branch(9,[branch(3),branch(3)])]))+equation('12 = 2 × 2 × 3；18 = 2 × 3 × 3')+'<p>两边各取一个共同的 2 和 3，相乘：<b>2 × 3 = 6</b>。每配成一对，只取其中一个。</p>')+
    step('例 2 · 8 和 12','<p>8 的因数：1、2、4、8<br>12 的因数：1、2、3、4、6、12<br>共同的有 1、2、4，最大公因数为 <b>4</b>。</p>')+
    '<p class="help-tip">分东西时想一想：12 支笔和 18 块橡皮，要平均分、没有剩余，最多能分给 6 人。</p>'},
  lcm:{title:'最小公倍数：找第一次相遇',html:
    '<p><b>倍数：</b>一个数乘 1、2、3……得到的数。<b>公倍数：</b>两个数都有的倍数。我们找最小的正数，不能选 0。</p>'+
    step('例 1 · 找 6 和 8 的最小公倍数','<p>6 的倍数：6、12、18、<mark>24</mark>、30……<br>8 的倍数：8、16、<mark>24</mark>、32……</p><p>第一次相遇在 <b>24</b>，这就是最小公倍数。</p>')+
    step('换一种办法 · 分叉拆开',trees(tree('6 分成 2 乘 3',6,[branch(2),branch(3)]),tree('8 分成 2 乘 4，4 再分成 2 乘 2',8,[branch(2),branch(4,[branch(2),branch(2)])]))+equation('6 = 2 × 3；8 = 2 × 2 × 2')+'<p>共同的 2 取一次，再把剩下的 3、2、2 都取上。</p>'+equation('2 × 3 × 2 × 2 = 24'))+
    step('例 2 · 4 和 6','<p>4：4、8、<mark>12</mark>、16……<br>6：6、<mark>12</mark>、18……<br>最小公倍数为 <b>12</b>。</p>')+
    '<p class="help-tip">红灯每 4 秒闪一次，蓝灯每 6 秒闪一次。一开始一起闪，再过 12 秒会再次一起闪。</p>'},

};

export function mathHelp(topic){return lessons[topic]??null;}
