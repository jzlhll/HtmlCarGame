import { mathText } from './math-display.js';

const equation=text=>'<p class="help-equation">'+mathText(text)+'</p>';
const step=(title,text)=>'<section class="help-example"><h3>'+title+'</h3>'+text+'</section>';
const branch=(value,children=[])=>'<div class="factor-branch"><span class="factor-node">'+value+'</span>'+(children.length?'<div class="factor-children">'+children.join('')+'</div>':'')+'</div>';
const tree=(label,value,children)=>'<div class="factor-tree" role="img" aria-label="'+label+'">'+branch(value,children)+'</div>';
const strip=(num,den)=>'<div class="fraction-strip" role="img" aria-label="平均分成 '+den+' 份，涂色 '+num+' 份" style="--pieces:'+den+'">'+Array.from({length:den},(_,index)=>'<i'+(index<num?' class="filled"':'')+'></i>').join('')+'</div>';
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
  fraction:{title:'分数：先看分成了几份',html:
    '<p>下方的数叫<b>分母</b>，表示平均分成几份；上方的数叫<b>分子</b>，表示取了几份。同分母加减，分母不变，只算分子。</p>'+
    step('例 1 · 同分母相加',equation('2/6 + 3/6 = 5/6')+strip(2,6)+strip(3,6)+strip(5,6)+'<p>每条都平均分成 6 份。2 份加 3 份是 5 份，分母仍为 6。</p>')+
    step('例 2 · 用 1 减去一个分数',equation('1 = 8/8')+strip(8,8)+equation('1 − 3/8 = 8/8 − 3/8 = 5/8')+strip(5,8)+'<p>把一个整体看成 8 份，去掉 3 份，还剩 5 份。</p>')+
    step('例 3 · 约分，大小不变',equation('4/6 = 2/3')+strip(4,6)+strip(2,3)+'<p>分子和分母同时除以 2。涂色部分一样大，只是每份变大了。</p>')+
    '<p class="help-tip">记住：不能把分母也相加。约分时，上下要同时除以同一个数。</p>'},
  'decimal-add':{title:'小数加减：小数点对齐',html:
    '<p>个位对个位，十分位对十分位，<b>小数点对齐</b>。不够的位数可以在末尾补 0，大小不变。</p>'+
    step('例 1 · 12.3 + 4.56','<p>把 12.3 写成 12.30，从右往左算：</p><div class="decimal-stack" role="img" aria-label="12.30 加 4.56 等于 16.86，小数点对齐"><div>12.30</div><div>+ 4.56</div><div class="total">16.86</div></div><p>百分位：0 + 6 = 6；十分位：3 + 5 = 8；整数部分：12 + 4 = 16。</p>')+
    step('例 2 · 3.5 − 1.28','<div class="decimal-stack" role="img" aria-label="3.50 减 1.28 等于 2.22，小数点对齐"><div>3.50</div><div>− 1.28</div><div class="total">2.22</div></div><p>0 不够减 8，向前一位借 1，变成 10 − 8 = 2；借走后十分位剩 4，4 − 2 = 2。</p>')+
    '<p class="help-tip">进位别忘加 1，借位别忘减 1。末尾的 0 可以去掉，比如 2.20 = 2.2。</p>'},
  'decimal-multiply':{title:'小数乘法：先乘，再放小数点',html:
    '<p>先当作整数相乘，再数两个乘数一共有<b>几位小数</b>，积就保留几位小数。不够位数就在前面补 0。</p>'+
    step('例 1 · 1.2 × 0.3','<div class="help-flow"><span>1.2 → 12</span><span>0.3 → 3</span></div>'+equation('12 × 3 = 36')+'<p>两个乘数各有一位小数，一共两位。把 36 的小数点向左移两位：</p>'+equation('1.2 × 0.3 = 0.36'))+
    step('例 2 · 4 × 0.6',equation('4 × 6 = 24')+'<p>只有 0.6 有一位小数，结果也留一位：</p>'+equation('4 × 0.6 = 2.4'))+
    '<p class="help-tip">算完检查：乘以小于 1 的正数，结果会比原数小。</p>'},
  division:{title:'除法：想一想乘法',html:
    '<p>除法是在问“能分成几份”或“里面有几个”。用乘法检查：<b>商 × 除数 = 被除数</b>。</p>'+
    step('例 1 · 24 ÷ 6','<p>把 24 分成每份 6，正好分成 4 份：</p><div class="help-flow"><span>6</span><span>6</span><span>6</span><span>6</span></div>'+equation('6 × 4 = 24，所以 24 ÷ 6 = 4'))+
    step('例 2 · 5.6 ÷ 0.8','<p>两边同时乘 10，把除数变成整数，商不变：</p><div class="help-flow"><span>5.6 → 56</span><span>0.8 → 8</span></div>'+equation('56 ÷ 8 = 7')+'<p>检查：7 × 0.8 = 5.6，所以商是 7。</p>')+
    '<p class="help-tip">小数除法不能只移动一边的小数点，两边必须移动同样的位数。</p>'},
  order:{title:'混合运算：先算谁？',html:
    '<p><b>先括号，再乘除，最后加减。</b>只有同一级运算时，从左往右算。</p>'+
    step('例 1 · 3 × (4 + 2)',tree('先把括号里的 4 加 2 得到 6，再乘以 3 得到 18','3 × (4 + 2)',[branch('3'),branch('4 + 2 = 6')])+equation('3 × (4 + 2) = 3 × 6 = 18'))+
    step('例 2 · 20 − 3 × 4','<p>先算乘法 3 × 4 = 12，再算减法：</p>'+equation('20 − 3 × 4 = 20 − 12 = 8'))+
    step('例 3 · 18 ÷ 3 × 2','<p>乘和除同一级，从左往右算：</p>'+equation('18 ÷ 3 × 2 = 6 × 2 = 12'))+
    '<p class="help-tip">不要一看到算式就从左算到右；先看看有没有括号、乘号或除号。</p>'},
};

export function mathHelp(topic){return lessons[topic]??null;}
