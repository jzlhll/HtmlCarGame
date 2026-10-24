import { LEVELS,LEARNING,REVIEW,HOME,WORDS,CHOICES,SUPPLIES,BOSSES,RENDERING,WORD_CARDS,combatTiming } from './config.js';
import { VOCABULARY, VOCABULARIES, getVocabulary } from './vocabulary-data.js';
import { APP_VERSION } from './version.js';
import { AssemblyView } from './assembly-view.js';
import { Speech } from './speech.js';
import { recapMarkup,groupRecap } from './recap.js';
const $=id=>document.getElementById(id);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const put=(id,value)=>{const element=$(id),text=String(value);if(element.textContent!==text)element.textContent=text;};
const kinds={correct:'成功',wrong:'写错',incomplete:'没写完'};
const entriesById=new Map(VOCABULARY.map(entry=>[entry.id,entry]));
function exampleMarkup(entry){
  const example=entry?.example;if(!example)return '';
  const markup=[example,...(example.additional||[])].map(item=>'<div class="word-example">'+(item.sense?'<small>'+escape(item.sense)+'</small>':'')+'<p class="example-text" lang="en">'+escape(item.text)+'</p><p class="example-meaning">'+escape(item.meaning)+'</p></div>').join('');
  return example.additional?.length?'<div class="word-examples">'+markup+'</div>':markup;
}
function wordCardDensity(entry){
  const examples=[entry.example,...(entry.example?.additional||[])],textLength=entry.meaning.length*2+examples.reduce((total,item)=>total+(item?.text.length||0)+(item?.meaning.length||0)*2,0);
  if(examples.length>=WORD_CARDS.denseExampleCount||textLength>=WORD_CARDS.denseTextLength)return 'dense';
  return examples.length>=WORD_CARDS.compactExampleCount||textLength>=WORD_CARDS.compactTextLength||entry.meaning.length>=WORD_CARDS.compactMeaningLength?'compact':'normal';
}
const wordCardMarkup=entry=>'<strong lang="en">'+escape(entry.word)+'</strong><p class="word-meaning">'+escape(entry.meaning)+'</p>'+exampleMarkup(entry);
export function formatTime(seconds){const value=Math.max(0,Math.ceil(seconds));return String(Math.floor(value/60)).padStart(2,'0')+':'+String(value%60).padStart(2,'0');}
export class UI {
  constructor(game,storage,audio,{touchMode}={}){
    Object.assign(this,{game,storage,audio,shownState:'',dialogMode:'',returnState:'menu',noticeTimer:null,seed:null,historyPage:0,historyWordId:null,launching:false,resettingLearning:false,accountBusy:false,accountMode:'',accountReturnState:'menu',draftName:null,pendingAccountId:null});this.speech=new Speech(text=>this.notice(text));this.pendingReview=!!storage.review;this.refreshHeroWord();
    this.assemblyView=new AssemblyView($('assembly-mode'),game,()=>this.render(),text=>this.notice(text));
    this.pointerMedia=matchMedia('(pointer: coarse)');this.game.touchMode=touchMode??this.pointerMedia.matches;document.body.dataset.touch=String(this.game.touchMode);this.pointerMedia.addEventListener('change',()=>{this.game.touchMode=touchMode??this.pointerMedia.matches;document.body.dataset.touch=String(this.game.touchMode);this.renderKey='';this.render();});
    $('render-quality').innerHTML=Object.entries(RENDERING.qualities).map(([value,quality])=>'<option value="'+value+'">'+quality.label+'</option>').join('');$('render-quality').value=storage.settings.renderQuality;
    $('library-select').innerHTML=VOCABULARIES.map(library=>'<option value="'+library.id+'">'+escape(library.label)+' · '+library.entries.length+' 词</option>').join('');$('library-select').onchange=event=>this.switchLibrary(event.target.value);
    $('version').textContent=APP_VERSION;$('volume').value=storage.settings.volume;$('reduced-motion').checked=storage.settings.reducedMotion;
    $('account-button').onclick=()=>this.accounts();$('home-retry').onclick=()=>{const saved=this.storage.currentLevel();if(saved?.status==='completed')this.preview(saved.level,true);};$('start-button').onclick=()=>this.begin();$('header-help').onclick=()=>this.instructions();$('header-pause').onclick=()=>this.action('Space');$('vocab-button').onclick=()=>this.vocabulary();$('history-button').onclick=()=>this.history();
    $('brand-home').onclick=event=>{event.preventDefault();if(game.state==='review')return;if(game.state==='playing')game.pause();if(game.state==='paused')this.pause();else this.home();};
    $('render-quality').onchange=event=>{storage.saveSettings({renderQuality:event.target.value});this.invalidate?.();};
    $('volume').oninput=event=>storage.saveSettings({volume:Number(event.target.value)});$('reduced-motion').onchange=event=>{storage.saveSettings({reducedMotion:event.target.checked});this.invalidate?.();};
    $('dialog-content').addEventListener('click',event=>{if(game.state==='review')return;const button=event.target.closest('[data-action]');if(button)this.handle(button.dataset.action,button.dataset);});
    $('home-accounts').addEventListener('click',event=>{const button=event.target.closest('[data-action]');if(button)this.handle(button.dataset.action,button.dataset);});
    $('home-accounts').addEventListener('submit',event=>{const form=event.target.closest('form[data-account-form]');if(!form)return;event.preventDefault();if(!this.accountBusy)this.saveAccountName(form);});
    $('dialog-content').addEventListener('pointerdown',event=>{if(this.dialogMode==='preview'&&!event.target.closest('button'))this.swipeStart={x:event.clientX,y:event.clientY};});
    $('dialog-content').addEventListener('pointerup',event=>{if(!this.swipeStart)return;const dx=event.clientX-this.swipeStart.x,dy=event.clientY-this.swipeStart.y;this.swipeStart=null;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.2)this.previewPage(dx<0?1:-1);});
    $('dialog-content').addEventListener('pointercancel',()=>{this.swipeStart=null;});
    document.addEventListener('click',event=>{if(game.state==='review'&&this.dialogMode!=='recap'||this.pendingReview||this.resettingLearning||this.accountBusy){event.preventDefault();event.stopImmediatePropagation();}},true);
    document.addEventListener('keydown',event=>{if(game.state==='review'&&this.dialogMode!=='recap'||this.pendingReview||this.resettingLearning||this.accountBusy){event.preventDefault();event.stopImmediatePropagation();return;}if(event.code==='Tab'&&!$('dialog').hidden){const items=[...$('dialog-card').querySelectorAll('button:not(:disabled),a,input,[tabindex="0"]')];if(!items.length)return;const first=items[0],last=items.at(-1);if(event.shiftKey&&(document.activeElement===first||document.activeElement===$('dialog-card'))){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}},true);
    if(!storage.account)this.accounts();
  }
  progress(label,percent){$('loading').hidden=false;$('loading-label').textContent=label;$('loading-number').textContent=percent+'%';$('loading-fill').style.width=percent+'%';}
  ready(metrics){this.pendingReview=false;this.metrics=metrics;$('loading').hidden=true;$('start-button').disabled=false;if(this.storage.review)this.game.restoreReview(this.storage.review);else this.game.state='menu';if(!metrics.persistent)this.notice('生成资源仅保存在本页内存中');if(this.storage.warning)this.notice(this.storage.warning);this.render();if(!this.storage.account&&!this.accountMode)this.accounts();}
  failure(error){this.game.state='prepareFailed';this.dialog('failure','<h2>准备遇到问题</h2><p>'+escape(error.message)+'</p><button data-action="reload">重新准备</button>');}
  notice(text){clearTimeout(this.noticeTimer);$('storage-notice').textContent=text;$('storage-notice').hidden=false;this.noticeTimer=setTimeout(()=>$('storage-notice').hidden=true,2800);}
  dialog(mode,html){this.recapResizeObserver?.disconnect();this.accountMode='';$('home-accounts').hidden=true;this.dialogMode=mode;if(this.previousFocus===undefined)this.previousFocus=document.activeElement;$('dialog-content').innerHTML=html;$('dialog').hidden=false;$('dialog').dataset.mode=mode;$('dialog-card').dataset.mode=mode;$('dialog-card').scrollTop=0;$('dialog-card').focus();this.invalidate?.();}
  closeDialog(){this.recapResizeObserver?.disconnect();this.speech.stop();this.accountMode='';$('home-accounts').hidden=true;this.dialogMode='';$('dialog').hidden=true;this.previousFocus=undefined;$('app').focus();this.invalidate?.();}
  accountPanel(mode,html){
    this.closeDialog();this.accountMode=mode;$('home-accounts').innerHTML=html;$('home-accounts').hidden=false;this.render();$('home-accounts').focus({preventScroll:true});
  }
  accounts(){
    if(this.game.state==='review'||this.accountBusy||this.resettingLearning)return;
    if(this.game.state==='prepareFailed'){this.notice('请重新准备游戏');return;}
    if(!this.accountMode){this.accountReturnState=this.game.state==='preparing'?'menu':this.game.state;if(this.game.state==='playing'){this.game.pause();this.accountReturnState='paused';}if(this.game.state!=='preparing')this.game.state='menu';}
    this.storage.refreshAccounts();this.speech.stop();this.game.input?.clear();
    const creating=this.draftName!==null;
    const heading=creating?'<div class="account-heading"><h2>新建账号</h2><button class="text-button" data-action="account-new">换一个名字</button></div>':this.storage.debug?'':this.storage.accounts.length?'<div class="account-heading"><button class="text-button" data-action="account-new">＋ 随机新建</button></div>':'<div class="account-heading account-empty"><button class="primary-button account-create-button" data-action="account-new"><b aria-hidden="true">＋</b><span>随机新建账号</span></button></div>';
    const content=creating?'<form class="account-draft" data-account-form><label for="new-account-name">账号名</label><input id="new-account-name" name="account-name" value="'+escape(this.draftName)+'" maxlength="20" required autocomplete="off"><div class="account-actions"><button class="primary-button" type="submit">确认保存</button><button class="text-button" type="button" data-action="account-draft-cancel">取消</button></div></form>':'<div class="account-list">'+this.storage.accounts.map(account=>'<button class="account-choice" data-action="account-select" data-id="'+escape(account.id)+'"><strong>'+escape(account.name)+'</strong>'+(this.storage.account?.id===account.id?'<small>当前</small>':'')+'</button>').join('')+'</div>';
    this.accountPanel('accounts',(!creating&&this.storage.accounts.length?'<div class="account-options">'+heading+content+'</div>':heading+content)+(!creating&&this.storage.account?'<button class="text-button account-return" data-action="account-return">返回</button>':''));
  }
  newAccount(){if(this.storage.debug)return;this.draftName=this.storage.randomAccountName();this.accounts();$('new-account-name')?.focus({preventScroll:true});$('new-account-name')?.select();}
  saveAccountName(form){
    const input=form.querySelector('input');
    try{this.storage.createAccount(input.value);this.draftName=null;this.accounts();this.notice(this.storage.warning||'账号已保存，点击登录');}
    catch(error){input.setAttribute('aria-invalid','true');input.focus({preventScroll:true});this.notice(error.message);}
  }
  confirmAccount(id){
    const account=this.storage.accounts.find(item=>item.id===id);if(!account)return;this.pendingAccountId=id;this.speech.stop();
    this.accountPanel('account-login','<h2 class="account-confirm-name">登录 '+escape(account.name)+'？</h2><div class="account-actions"><button class="primary-button" data-action="account-login">确认登录</button><button class="text-button" data-action="account-cancel">取消</button></div>');
  }
  async loginAccount(){
    if(this.accountMode!=='account-login'||!this.pendingAccountId||this.accountBusy)return;this.accountBusy=true;for(const item of $('home-accounts').querySelectorAll('button,input'))item.disabled=true;$('home-accounts').querySelector('[data-action="account-login"]').textContent='正在登录…';
    try{await this.game.savePromise;await this.storage.login(this.pendingAccountId);this.game.resetAccount();this.draftName=null;$('render-quality').value=this.storage.settings.renderQuality;$('volume').value=this.storage.settings.volume;$('reduced-motion').checked=this.storage.settings.reducedMotion;this.accountBusy=false;this.closeDialog();this.refreshHeroWord();if(this.storage.review)this.game.restoreReview(this.storage.review);this.shownState='';this.render();clearTimeout(this.noticeTimer);$('storage-notice').hidden=true;if(this.storage.warning)this.notice(this.storage.warning);}
    catch(error){console.warn('Account login failed',error);this.accountBusy=false;this.accounts();this.notice('登录未完成，请重试');}
  }
  async switchLibrary(id){
    if(this.accountBusy||this.resettingLearning||!this.storage.account||this.game.state!=='menu'){this.renderKey='';this.render();return;}
    if(id===this.storage.libraryId)return;this.accountBusy=true;this.speech.stop();this.game.input?.clear();this.render();
    try{await this.game.savePromise;await this.storage.switchLibrary(id);this.game.resetAccount();this.closeDialog();if(this.storage.review)this.game.restoreReview(this.storage.review);this.shownState='';this.notice(this.storage.warning||'已切换到'+this.storage.library.label+'词库');}
    catch(error){console.warn('Vocabulary switch failed',error);this.notice('词库切换未完成，请重试');}
    finally{this.accountBusy=false;this.renderKey='';this.render();}
  }
  returnFromAccounts(){
    this.draftName=null;if(!this.storage.account)return;this.game.state=this.accountReturnState;this.closeDialog();
    if(this.accountReturnState==='paused'){this.pause();this.render();}else if(this.accountReturnState==='preview')this.preview(this.game.level);else if(this.accountReturnState==='won'){this.result();this.render();}else this.home();
  }
  refreshHeroWord(){
    const entry=HOME.words[Math.floor(Math.random()*HOME.words.length)],indices=Array.from({length:entry.word.length},(_,i)=>i);
    for(let i=indices.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[indices[i],indices[j]]=[indices[j],indices[i]];}
    const blanks=new Set(indices.slice(0,Math.min(HOME.blanks,entry.word.length-1)));
    $('hero-word-letters').innerHTML='( '+[...entry.word].map((letter,index)=>blanks.has(index)?'<span>_</span>':escape(letter)).join(' ')+' )';$('hero-word-meaning').textContent='[ '+entry.meaning+' ]';
  }
  begin(){if(this.game.state==='review'||['preparing','prepareFailed'].includes(this.game.state))return;if(!this.storage.account){this.accounts();return;}const saved=this.storage.currentLevel();this.preview(saved&&saved.status!=='completed'?saved.level:this.storage.progress.selected);}
  preview(level=this.game.level,retry=false){
    if(this.game.state==='review')return;if(!this.storage.account){this.accounts();return;}this.speech.stop();this.game.prepareLevel(level,this.seed===null?Date.now():this.seed+level-1,{retry,wordIds:retry?this.game.result?.roster:null,sessionId:retry?this.game.result?.sessionId:null});this.previewIndex=0;this.previewSeen=new Set([0]);
    const cards=this.game.roster.map((entry,index)=>'<article class="preview-card" data-density="'+wordCardDensity(entry)+'" aria-label="第 '+(index+1)+' 个单词">'+wordCardMarkup(entry)+'</article>').join('');
    this.dialog('preview','<div class="preview-heading"><h2>认识本关的单词</h2><span class="eyebrow">第 '+level+' 关 · '+(this.game.mode==='assembly'?'碎片组装与陨石连线':'空战')+' · '+escape(this.storage.library.label)+' · 词汇预习</span></div><div class="preview-indicators"><div class="preview-dots" id="preview-dots">'+this.game.roster.map((_,i)=>'<button data-action="preview-index" data-index="'+i+'" aria-label="第 '+(i+1)+' 页"></button>').join('')+'</div><p class="page-counter" id="preview-counter"></p></div><div class="preview-window"><div class="preview-track" id="preview-track">'+cards+'</div></div><div class="preview-controls"><button class="secondary-button" data-action="preview-prev">← 上一个</button><button id="preview-speak" class="pronounce" data-action="preview-speak">▶ 朗读</button><button class="secondary-button" data-action="preview-next">下一个 →</button></div><div class="dialog-actions"><button id="preview-start" class="primary-button" data-action="launch" disabled>开始第 '+level+' 关 ↗</button><button class="secondary-button" data-action="home">返回首页</button></div>');this.updatePreview();this.render();if(!this.storage.available)this.notice(this.storage.warning);
  }
  previewPage(delta){if(this.dialogMode!=='preview')return;this.previewIndex=Math.max(0,Math.min(this.game.roster.length-1,this.previewIndex+delta));this.previewSeen.add(this.previewIndex);this.speech.stop();this.updatePreview();}
  updatePreview(){const count=this.game.roster.length;$('preview-speak').setAttribute('aria-label','播放 '+this.game.roster[this.previewIndex].word);[...$('preview-track').children].forEach((card,index)=>{card.inert=index!==this.previewIndex;card.setAttribute('aria-hidden',String(index!==this.previewIndex));});$('preview-track').style.transform='translateX(-'+this.previewIndex*100+'%)';[...$('preview-dots').children].forEach((button,index)=>{button.classList.toggle('active',index===this.previewIndex);button.setAttribute('aria-current',index===this.previewIndex?'page':'false');});$('preview-counter').textContent=(this.previewIndex+1)+'/'+count;$('preview-start').disabled=this.previewSeen.size<count;}
  async launch(){
    if(this.launching||this.game.state!=='preview'||this.previewSeen.size<this.game.roster.length)return;this.launching=true;const roster=this.game.roster;this.speech.stop();
    try{await this.game.savePromise;if(this.game.state!=='preview'||this.game.roster!==roster)return;this.closeDialog();this.audio.unlock();this.game.start();if(this.game.assembly)this.assemblyView.prepare(this.game.assembly);this.render();}finally{this.launching=false;}
  }
  home(){if(this.game.state==='review')return;if(!this.storage.account){this.accounts();return;}this.audio.stop();this.speech.stop();this.game.input?.clear();this.game.projectiles.clear();this.game.assembly=null;this.game.words=[];this.game.enemies=[];this.game.boss=null;this.game.supplies=[];this.game.supplyQueue=[];this.game.collections=[];this.game.victoryRemaining=null;this.game.state='menu';this.refreshHeroWord();this.closeDialog();this.render();}
  instructions(){
    if(this.game.state==='review'||['preparing','prepareFailed'].includes(this.game.state))return;this.returnState=this.game.state;if(this.game.state==='playing'){this.game.pause();this.returnState='paused';}
    if(this.game.touchMode){
      this.dialog('guide','<h2>用指尖拼出单词</h2><ol class="guide-steps"><li><b>01</b><div><strong>每关先认识十二个词</strong><p>手机每关都使用碎片组装与陨石连线。滑动词卡或点击上一个／下一个，全部看过后开始。</p></div></li><li><b>02</b><div><strong>三分钟碎片组装</strong><p>按拼写顺序点选碎片，再点击对应释义。再次点碎片可反选，点击待定释义可拆开重组。全部分配后提交；正确项消除，错误项可重做，最多验证三次。</p></div></li><li><b>03</b><div><strong>一分三十秒陨石连线</strong><p>点一个单词和一个释义建立待定连线，点击已连线的陨石可撤线。上下滑动查看其他陨石，全部连完后提交，同样最多验证三次。</p></div></li><li><b>04</b><div><strong>暂停与复习</strong><p>点击顶部暂停；切到后台自动暂停，回来后点击继续。结束后回顾错词，每个不同失败词复习十秒，再重玩或进入下一关。</p></div></li></ol><div class="dialog-actions"><button class="primary-button" data-action="back">返回</button></div>');return;
    }
    const timing=combatTiming(this.storage.libraryId);
    this.dialog('guide','<span class="eyebrow">FLIGHT MANUAL / 玩法介绍</span><h2>让每个字母飞到正确的位置</h2><ol class="guide-steps"><li><b>01</b><div><strong>先预习，再起飞</strong><p>每关固定 12 个词，首关随机选择空战或组装飞机／航母碎片，随后两种模式交替；本词库空战时限 '+formatTime(timing.durationSeconds)+'。碎片模式先用三分钟按拼写顺序选择金属碎片并配中文释义，再用一分三十秒把中英文陨石连线；每阶段全部分配后提交，各可验证三次，正确项消除，错误项释放重做。时间或次数用尽进入下一阶段或结算。空战关卡用完一轮才重复。未完成和重玩沿用原来的 12 词，新关才重新抽词。开始前左右浏览全部单词卡片。</p></div></li><li><b>02</b><div><strong>左右移动，按字母连射</strong><p>← → 移动，朝向整个白色单词飞机或 Boss。点阵跟随标准大小写；按住字母即可填满当前格，填满后飞机锁定 '+WORDS.inputLockSeconds+' 秒并显示待定字母；没填完时换字母会重做当前格。元音与辅音均可随机挖空，至少两个字母；四个及以上字母的单词最多挖词长的一半，向下取整，二至三个字母的短词也挖两个。数字 1–4 选择前四个缺字格，填满后自动前进到下一空；退格键删除末尾已填写字母，反引号也可撤销。普通题中 '+Math.round(CHOICES.ratio*100)+'% 是航母选择题：英文选中文或中文选英文，横移瞄准三个选项，按住任意字母射击；累计 '+CHOICES.hitsToSelect+' 颗子弹使选项透明后验证，选对爆 '+CHOICES.successCrates+' 个幸运箱，选错变 '+CHOICES.failureEnemies+' 架敌机。</p></div></li><li><b>03</b><div><strong>Shift 跟踪弹，迎战怪兽</strong><p>答对奖励两枚战斗炮弹，按一次 Shift 发一枚弧线跟踪弹，自动锁定邪恶飞机；场上无邪恶飞机时不发射、不耗弹。'+timing.miniAt+' 秒 '+BOSSES.miniFaces+' 面小 Boss，'+timing.finalAt+' 秒 '+BOSSES.finalFaces+' 面大 Boss，各一分钟。写错或超时每面变两架邪恶飞机。全部面答对击败小／大 Boss 后分别爆 '+BOSSES.miniCrates+'／'+BOSSES.finalCrates+' 个幸运箱；大 Boss 击败后清场，顶部倒数 '+BOSSES.victorySeconds+' 秒，方向键 ↑ ↓ ← → 自由移动撞箱子，随后结算。</p></div></li><li><b>04</b><div><strong>收集与复习</strong><p>每 '+(SUPPLIES.intervalSeconds/60)+' 分钟刷新一个幸运箱，碰触领取，子弹无法领取；普通拼写飞机和航母答对都爆两个箱子，先随机慢晃两秒，再按距离飞入右上角、抵达后计数，无需碰触；周期箱和 Boss 箱仍需碰触。红心、星星和收藏炮弹暂时只计数量。结束先回顾错题及正确答案，每个不同失败词须复习 10 秒；之后用通关弹窗重玩或进入下一关。</p></div></li></ol><p class="note">空格暂停。小六、初中进阶、四级、六级逐级选词，各词库独立记录进度。</p><div class="dialog-actions"><button class="primary-button" data-action="back">返回</button></div>');
  }
  vocabulary(){
    if(this.game.state==='review')return;this.returnState=this.game.state;if(this.game.state==='playing'){this.game.pause();this.returnState='paused';}
    this.dialog('vocabulary','<h2>选择适合自己的词库</h2><div class="vocabulary-catalog">'+VOCABULARIES.map(library=>'<article><h3>'+escape(library.label)+(library.id===this.storage.libraryId?' <small>当前词库</small>':'')+'</h3><p>'+library.entries.length+' 个单词</p><p>'+escape(library.description)+'</p></article>').join('')+'</div><p>登录后可在首页切换词库。每关固定 12 个词，每个词库分别保存关卡进度、成绩和学习记录；同一个词在不同词库中的记录互不影响。预习词卡显示短语及中文，无合适短语时使用例句；通关前回顾原作答及正确答案。</p><p>小六、初中进阶、四级基础、六级进阶按阶段组织。大学词库按官方大纲分级，包含派生词与合法英美拼法；六级进阶只练新增词，不重复四级基础拼写。各库按学习情况抽取。历史正确率高于 50%／75%／85% 时，后续入选权重为 0.5／0.25／0.01。</p><button class="primary-button" data-action="back">返回</button>');
  }
  pause(){this.speech.stop();this.dialog('pause','<h2>游戏已暂停</h2><div class="dialog-actions"><button class="primary-button" data-action="resume">继续飞行 ↗</button><button class="secondary-button" data-action="end">结束本局</button></div>');}
  failedWords(){return groupRecap(this.game.result?.mistakes||[]);}
  recap(){
    const r=this.game.result;if(!r)return;
    if(this.recapId===r.id&&this.dialogMode==='recap'){this.updateReview();return;}
    this.recapId=r.id;this.speech.stop();
    const count=this.failedWords().length;
    this.dialog('recap','<header class="recap-heading"><h2>'+(count?'本关错词回顾':'这一程，顺利完成。')+'</h2><p>第 '+r.level+' 关 · '+escape(getVocabulary(r.libraryId).label)+(count?' · '+count+' 个单词':'')+'</p></header><div id="recap-field" class="recap-field" data-recap-scroll tabindex="0"><div id="recap-list" class="recap-layout" aria-label="本关合并错词">'+recapMarkup(r.mistakes,this.recapImages)+'</div></div><footer class="recap-footer"><div><span id="recap-status"></span><strong id="review-timer"></strong><small id="save-status"></small></div><button class="primary-button" id="recap-continue" data-action="recap-continue">查看通关结果 ↗</button></footer>');
    this.reviewIndex=-1;this.updateReview();this.recapResizeObserver=new ResizeObserver(()=>this.fitRecap());this.recapResizeObserver.observe($('recap-field'));this.fitRecap();
    const resultId=r.id,libraryId=r.libraryId,accountId=r.accountId,saved=()=>{if(this.game.result?.id!==resultId||this.storage.libraryId!==libraryId||this.storage.account?.id!==accountId||!$('save-status'))return;put('save-status',this.storage.pendingRun?(this.storage.available?'学习记录已暂存，数据库恢复后重试':'学习记录仅保留在本页内存'):'学习记录已保存');};saved();this.game.savePromise?.then(saved);
  }
  fitRecap(){
    if(this.dialogMode!=='recap')return;const field=$('recap-field'),layout=$('recap-list');if(!field||!layout||!field.clientHeight)return;
    const count=this.failedWords().length||1,columns=Math.min(count,field.clientWidth>=1000?4:field.clientWidth>=660?3:2);
    layout.style.gridTemplateColumns='repeat('+columns+',minmax(0,1fr))';
    // 只按列宽调整长词；超出一屏时保留自然滚动，不缩小整页内容。
    for(const text of layout.querySelectorAll('.recap-correct strong,.recap-letters,.recap-answer')){
      text.style.fontSize='';text.style.whiteSpace='';text.style.flexWrap='';
      if(text.scrollWidth<=text.clientWidth+1)continue;
      const minimum=text.classList.contains('recap-letters')||text.classList.contains('recap-answer')?13:16;
      text.style.fontSize=Math.max(minimum,parseFloat(getComputedStyle(text).fontSize)*text.clientWidth/text.scrollWidth)+'px';
      if(text.scrollWidth>text.clientWidth+1){text.style.whiteSpace='normal';if(text.classList.contains('recap-letters'))text.style.flexWrap='wrap';}
    }
  }
  result(){
    const r=this.game.result;if(!r)return;this.speech.stop();
    this.dialog('result','<span class="eyebrow">第 '+r.level+' 关</span><h2>恭喜通关！</h2><div class="dialog-actions"><button class="secondary-button" data-action="restart">重玩本关</button><button class="primary-button" data-action="next-level">第 '+(r.level+1)+' 关 ↗</button></div>');
  }
  updateReview(){
    if(this.dialogMode!=='recap'||!$('review-timer'))return;
    const locked=this.game.state==='review',failed=this.failedWords(),index=locked?Math.min(failed.length-1,Math.floor((failed.length*REVIEW.secondsPerWord-this.game.reviewRemaining)/REVIEW.secondsPerWord)):-1;
    put('review-timer',locked?formatTime(this.game.reviewRemaining):'');
    put('recap-status',locked?'复习中 · '+(index+1)+'/'+failed.length+' 个词':failed.length?'回顾完成':'无需错题复习');$('recap-continue').disabled=locked;
    if(this.reviewIndex===index)return;this.reviewIndex=index;
    for(const card of $('recap-list').querySelectorAll('[data-word-id]'))card.dataset.reviewActive=String(locked&&card.dataset.wordId===failed[index]?.wordId);
  }
  history(page=0){
    if(this.game.state==='review')return;if(!this.storage.account){this.accounts();return;}if(!['history','attempts','history-reset'].includes(this.dialogMode)){this.returnState=this.game.state;if(this.game.state==='playing'){this.game.pause();this.returnState='paused';}}
    this.speech.stop();this.historyWordId=null;const rows=this.storage.listWords(),pages=Math.max(1,Math.ceil(rows.length/LEARNING.pageSize));this.historyPage=Math.max(0,Math.min(pages-1,page));const visible=rows.slice(this.historyPage*LEARNING.pageSize,(this.historyPage+1)*LEARNING.pageSize);
    this.dialog('history','<div class="history-heading"><div class="history-title"><h2>我的单词记录</h2><span class="eyebrow">'+escape(this.storage.library.label)+' · 学习记录</span></div><div class="history-heading-actions"><button class="secondary-button reset-button" data-action="history-reset">重置</button><button class="secondary-button" data-action="back">返回</button></div></div><p class="history-summary">共 '+rows.length+' 个词 · 按写错＋没写完次数排序'+(!this.storage.databaseAvailable?' · 本页内存记录':'')+'</p><div class="history-scroll"><table class="history-table"><thead><tr><th>单词（中文）</th><th>成功</th><th>写错</th><th>没写完</th><th>播放</th></tr></thead><tbody>'+visible.map(row=>'<tr><td><button class="word-detail" data-action="attempts" data-id="'+escape(row.id)+'">'+escape(row.word)+'<small>（'+escape(row.meaning)+'）</small></button></td><td class="stat-correct">'+row.correct+'</td><td class="stat-wrong">'+row.wrong+'</td><td class="stat-incomplete">'+row.incomplete+'</td><td><button class="pronounce" data-action="speak" data-word="'+escape(row.word)+'" aria-label="播放 '+escape(row.word)+'">▶</button></td></tr>').join('')+'</tbody></table>'+(!rows.length?'<p>完成一局后，这里会保存每次出现的记录。</p>':'')+'</div><div class="history-pager"><button data-action="history-prev" '+(this.historyPage===0?'disabled':'')+'>← 上一页</button><span>'+(this.historyPage+1)+'/'+pages+' · 每页 100 词</span><button data-action="history-next" '+(this.historyPage===pages-1?'disabled':'')+'>下一页 →</button></div>');
  }
  confirmLearningReset(){
    if(this.game.state==='review'||this.resettingLearning)return;
    if(['preparing','prepareFailed'].includes(this.game.state)){this.notice('请等待准备完成后再重置');return;}
    this.speech.stop();const count=this.storage.listWords().length;
    this.dialog('history-reset','<span class="eyebrow">RESET LEARNING LOG</span><h2>确认清空单词记录？</h2><p>将清空当前词库“'+escape(this.storage.library.label)+'”已练习的 '+count+' 个词的成功、写错、没写完次数，以及每次作答明细，后续抽词概率从头计算。</p><p>成绩、关卡进度和设置保留。清空后无法恢复，之后完成游戏会重新产生学习记录。</p>'+(this.storage.debug?'<p class="note">当前为调试账号 '+escape(this.storage.account.name)+'，只清理此账号在当前词库中的学习记录。</p>':'')+'<div class="dialog-actions"><button class="secondary-button" data-action="history-reset-cancel">取消</button><button class="primary-button danger-button" data-action="history-reset-confirm">确认清空</button></div>');
  }
  async resetLearning(){
    if(this.dialogMode!=='history-reset'||this.resettingLearning)return;this.resettingLearning=true;this.speech.stop();this.game.input?.clear();
    for(const button of $('dialog-content').querySelectorAll('button'))button.disabled=true;
    try{await this.game.savePromise;await this.storage.resetLearning();this.resettingLearning=false;this.history(0);this.notice('当前账号在'+this.storage.library.label+'词库的记录已清空');}
    catch(error){console.warn('Learning reset failed',error);this.resettingLearning=false;this.history(this.historyPage);this.notice('重置未完成，请稍后重试');}
  }
  async attempts(id,page=0){
    this.historyWordId=id;this.historyAttemptPage=page;const row=this.storage.learning[id];if(!row)return;const account=this.storage.account?.id,libraryId=this.storage.libraryId;this.speech.stop();this.dialog('attempts','<h2>'+escape(row.word)+'</h2><p>读取每次作答记录…</p>');
    let result;try{result=await this.storage.attemptPage(id,page,LEARNING.pageSize);}catch(error){console.warn('Learning details read failed',error);if(this.dialogMode==='attempts'&&this.historyWordId===id&&this.historyAttemptPage===page&&this.storage.account?.id===account&&this.storage.libraryId===libraryId)this.dialog('attempts','<h2>'+escape(row.word)+'</h2><p>暂时无法读取作答记录，请稍后重试。</p><button data-action="history-page" class="secondary-button">返回学习记录</button>');return;}
    if(this.dialogMode!=='attempts'||this.historyWordId!==id||this.historyAttemptPage!==page||this.storage.account?.id!==account||this.storage.libraryId!==libraryId)return;
    const records=result.rows,pages=Math.max(1,Math.ceil(result.total/LEARNING.pageSize));this.historyAttemptPage=result.page;
    this.dialog('attempts','<h2>'+escape(row.word)+'（'+escape(row.meaning)+'）</h2><div class="history-scroll"><table class="history-table"><thead><tr><th>关卡</th><th>结果</th><th>填写内容</th></tr></thead><tbody>'+records.map(record=>'<tr><td>第 '+record.level+' 关</td><td class="stat-'+record.kind+'">'+kinds[record.kind]+'</td><td>'+escape(record.answer)+'</td></tr>').join('')+'</tbody></table>'+(!records.length?'<p>这条旧记录只有汇总，没有历史明细。</p>':'')+'</div><div class="history-pager"><button data-action="attempts-prev" '+(result.page===0?'disabled':'')+'>← 上一页</button><span>'+(result.page+1)+'/'+pages+' · 共 '+result.total+' 次</span><button data-action="attempts-next" '+(result.page===pages-1?'disabled':'')+'>下一页 →</button></div><div class="dialog-actions"><button data-action="history-page" class="secondary-button">返回学习记录</button><button class="pronounce" data-action="speak" data-word="'+escape(row.word)+'">▶ 朗读</button></div>');
  }
  handle(action,data={}){
    if(this.game.state==='review'||this.resettingLearning||this.accountBusy)return;
    if(action==='account-new')this.newAccount();else if(action==='account-draft-cancel'){this.draftName=null;this.accounts();}else if(action==='account-select')this.confirmAccount(data.id);else if(action==='account-cancel')this.accounts();else if(action==='account-login')this.loginAccount();else if(action==='account-return')this.returnFromAccounts();else if(action==='history-reset')this.confirmLearningReset();else if(action==='history-reset-cancel')this.history(this.historyPage);else if(action==='history-reset-confirm')this.resetLearning();else if(action==='preview')this.preview(this.storage.progress.selected);else if(action==='launch')this.launch();else if(action==='preview-prev')this.previewPage(-1);else if(action==='preview-next')this.previewPage(1);else if(action==='preview-index'){this.previewPage(Number(data.index)-this.previewIndex);}else if(action==='preview-speak'){if(this.dialogMode==='preview')this.speech.play(this.game.roster[this.previewIndex].word);}else if(action==='recap-continue'){if(this.game.state==='recap'){this.game.completeRecap();this.render();}}else if(action==='speak')this.speech.play(data.word);
    else if(action==='restart')this.preview(this.game.result.level,true);else if(action==='next-level')this.preview(this.game.result.level+1);else if(action==='resume'){this.closeDialog();this.audio.unlock();this.game.resume();this.render();}else if(action==='guide')this.instructions();else if(action==='end'){this.closeDialog();this.game.finish('ended');this.render();}else if(action==='home')this.home();else if(action==='reload')location.reload();else if(action==='history')this.history();else if(action==='history-prev')this.history(this.historyPage-1);else if(action==='history-next')this.history(this.historyPage+1);else if(action==='history-page')this.history(this.historyPage);else if(action==='attempts')this.attempts(data.id);else if(action==='attempts-prev')this.attempts(this.historyWordId,this.historyAttemptPage-1);else if(action==='attempts-next')this.attempts(this.historyWordId,this.historyAttemptPage+1);
    else if(action==='back'){if(this.returnState==='paused')this.pause();else if(this.returnState==='preview')this.preview(this.game.level);else if(this.returnState==='won')this.result();else this.home();}
  }
  action(code){
    if(this.game.state==='review'||this.resettingLearning||this.accountBusy)return;if(this.accountMode==='accounts'){if(code==='Escape'){if(this.draftName!==null){this.draftName=null;this.accounts();}else this.returnFromAccounts();}return;}if(this.accountMode==='account-login'){if(code==='Escape')this.accounts();return;}if(this.dialogMode==='history-reset'){if(code==='Escape')this.history(this.historyPage);return;}if(this.dialogMode==='preview'){if(code==='ArrowLeft')this.previewPage(-1);else if(code==='ArrowRight')this.previewPage(1);else if(code==='Space'){if(this.previewSeen.size===this.game.roster.length)this.launch();else this.previewPage(1);}else if(code==='Escape')this.home();return;}
    if(this.dialogMode==='recap'){if(code==='Space')this.handle('recap-continue');return;}
    if(this.dialogMode==='result')return;
    if(['guide','vocabulary','history','attempts'].includes(this.dialogMode)){if(code==='Space'||code==='Escape')this.handle('back');return;}
    if(this.game.state==='menu'&&code==='Space')this.begin();else if(this.game.state==='playing'&&['Space','Escape'].includes(code)){this.game.pause();this.pause();this.render();}else if(this.game.state==='paused'&&code==='Space')this.handle('resume');
  }
  render(){
    this.invalidate?.();this.assemblyView.render();const g0=this.game,saved0=this.storage.currentLevel(),key=[g0.state,this.shownState,this.dialogMode,this.accountMode,this.accountBusy,this.storage.account?.id,this.storage.account?.name,this.storage.libraryId,this.storage.progress.selected,saved0?.id,saved0?.status,saved0?.level,g0.runId,Math.ceil(g0.remaining),Math.ceil(g0.reviewRemaining),g0.victoryRemaining!==null&&g0.victoryRemaining!==undefined,g0.score,g0.ammo,g0.correct,g0.wrong,g0.missed,g0.records.length,g0.displayCollected.heart,g0.displayCollected.star,g0.displayCollected.shell,g0.touchMode,this.storage.progress.firstMode].join('|');
    if(this.renderKey===key)return;this.renderKey=key;
    $('library-select').value=this.storage.libraryId;$('library-select').disabled=this.accountBusy||this.resettingLearning||this.game.state!=='menu';
    $('home-launch-controls').hidden=!!this.accountMode||!this.storage.account;for(const item of $('home-accounts').querySelectorAll('button,input'))item.disabled=this.accountBusy||g0.state==='preparing';$('home-accounts').hidden=!this.accountMode;const g=this.game,battle=['playing','paused','review','recap','won'].includes(g.state),locked=g.state==='review';$('menu').hidden=battle;$('battle-hud').hidden=g.mode==='assembly'||!battle||['review','recap','won'].includes(g.state);$('header-pause').hidden=!['playing','paused'].includes(g.state);put('timer',g.victoryRemaining!==null&&g.victoryRemaining!==undefined?String(Math.ceil(g.remaining)):formatTime(g.remaining));put('score',String(g.score).padStart(4,'0'));put('ammo',g.ammo);put('correct-count','✓ '+g.correct);
    put('live-correct','成功 '+g.correct+' 次');put('live-wrong','写错 '+g.wrong+' 次');put('live-incomplete','没写完 '+g.missed+' 次');
    for(const kind of ['heart','star','shell'])put('collect-'+kind,g.displayCollected[kind]);
    const savedLevel=this.storage.currentLevel();$('home-retry').hidden=!(this.storage.account&&g.state==='menu'&&savedLevel?.status==='completed');if(savedLevel)put('home-retry','重玩第 '+savedLevel.level+' 关 · 原 12 词');
    const nextMode=this.storage.modeForLevel(savedLevel&&savedLevel.status!=='completed'?savedLevel.level:this.storage.progress.selected,g.touchMode);put('mission-duration',nextMode==='assembly'?'03:00 + 01:30':formatTime(combatTiming(this.storage.libraryId).durationSeconds));put('mission-mode',nextMode==='assembly'?'碎片组装与陨石连线':'空战关卡');put('mission-input',nextMode==='assembly'?(g.touchMode?'触屏选择与连线':'鼠标选择与连线'):'字母积木武器');put('mission-control-value',nextMode==='assembly'?'点选':'26 个');put('mission-level',String(savedLevel&&savedLevel.status!=='completed'?savedLevel.level:this.storage.progress.selected).padStart(2,'0'));put('mission-word-count',LEVELS.wordCount+' 个词');
    if(!battle){const label=this.storage.account?'预习第 '+this.storage.progress.selected+' 关':'选择账号后开始';if($('start-button').firstElementChild.textContent!==label)$('start-button').firstElementChild.textContent=label;}$('account-button').hidden=!this.storage.account;put('account-button',this.storage.account?this.storage.account.name+' · 切换账号':'');$('flight-frame').dataset.battle=String(battle);document.body.dataset.paused=String(g.state==='paused');document.body.dataset.home=String(['menu','preparing','prepareFailed'].includes(g.state)&&!this.dialogMode);document.body.dataset.review=String(locked);document.body.dataset.postgame=String(['review','recap','won'].includes(g.state));document.body.dataset.victory=String(g.victoryRemaining!==null&&g.victoryRemaining!==undefined&&['playing','paused'].includes(g.state));for(const item of document.querySelectorAll('.site-header button,.site-footer input,.site-footer button,.site-footer select'))item.disabled=locked||this.accountBusy;
    if(g.state!==this.shownState){this.shownState=g.state;if(g.state==='paused'&&!['guide','vocabulary','history','attempts','history-reset','accounts','account-login'].includes(this.dialogMode))this.pause();if(g.state==='review'||g.state==='recap')this.recap();else if(g.state==='won')this.result();}
    if(this.dialogMode==='recap')this.updateReview();
  }
}
