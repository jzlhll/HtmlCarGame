export const TEST_ACCOUNTS=Array.from({length:9},(_,i)=>({id:'test'+String(i+1).padStart(2,'0'),name:'TEST'+String(i+1).padStart(2,'0'),test:true}));
export function normalizeAccountName(value){return String(value??'').normalize('NFKC').trim().replace(/\s+/g,' ');}
export function accountNameKey(value){return normalizeAccountName(value).toLowerCase();}
export function validateAccountName(value,accounts,exceptId=null){
  const name=normalizeAccountName(value);
  if(!name||[...name].length>20)throw new Error('账号名需为 1–20 个字符');
  if(/^test0[1-9]$/i.test(name))throw new Error('TEST01–TEST09 是调试保留名称');
  if(accounts.some(account=>account.id!==exceptId&&accountNameKey(account.name)===accountNameKey(name)))throw new Error('这个账号名已经存在，请换一个');
  return name;
}
export function randomAccountName(accounts){
  const heads=['星海','月光','银河','蓝星','晨光','流星'],tails=['飞行员','探索者','领航员','小机长'];
  for(let i=0;i<32;i++){const name=heads[Math.floor(Math.random()*heads.length)]+tails[Math.floor(Math.random()*tails.length)]+(1000+Math.floor(Math.random()*9000));if(!accounts.some(account=>accountNameKey(account.name)===accountNameKey(name)))return name;}
  let number=1;while(accounts.some(account=>accountNameKey(account.name)===accountNameKey('星海飞行员'+number)))number++;return '星海飞行员'+number;
}
export function newAccountId(){return 'pilot-'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));}
