export function createRandom(seed) {
  let value=seed>>>0;
  return ()=>{value+=0x6D2B79F5;let t=value;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
}
export function shuffle(items,random) { for(let i=items.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[items[i],items[j]]=[items[j],items[i]];}return items; }
export const between=(range,random)=>range[0]+(range[1]-range[0])*random();

// 每轮独立洗牌；边界避开上一轮末项，时间跳转也能恢复相同顺序。
export function backgroundOrder(seed,round,count) {
  const orderAt=value=>shuffle(Array.from({length:count},(_,i)=>i),createRandom((seed^Math.imul(value+1,0x9E3779B1))>>>0));
  const order=orderAt(round);
  if(round>0&&order[0]===orderAt(round-1)[count-1])[order[0],order[1]]=[order[1],order[0]];
  return order;
}
