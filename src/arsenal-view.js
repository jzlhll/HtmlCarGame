import { ROCKETS, lerp } from './config.js';
import { coinModel, rocketModel } from './arsenal-models.js';

// 金币及火箭的部件共享几何与材质，显示对象按固定上限复用。
export class ArsenalView {
  constructor(){this.coins=new Map();this.pools={small:[],large:[]};this.rockets=[];this.seen=new Set();this.point={};}
  reset(){for(const item of this.coins.values())this.pools[item.large?'large':'small'].push(item.view);this.coins.clear();this.seen.clear();}
  draw(renderer,game){
    const arsenal=game.arsenal;if(!arsenal)return;
    const seen=this.seen,time=game.activeSeconds;seen.clear();
    for(const coin of arsenal.coins)seen.add(coin.id);
    // 先归还离场对象，本帧的新金币即可复用，避免交替生成时重复克隆。
    for(const [id,item]of this.coins)if(!seen.has(id)){this.pools[item.large?'large':'small'].push(item.view);this.coins.delete(id);}
    for(const coin of arsenal.coins){
      let item=this.coins.get(coin.id);
      if(!item){item={large:coin.large,view:this.pools[coin.large?'large':'small'].pop()??coinModel(coin.large)};this.coins.set(coin.id,item);}
      const p=renderer.local(coin.s,coin.d,coin.route,this.point),view=item.view;
      view.position.set(p.x,p.y+coin.dimensions.width/2+.3+Math.sin(time*3+coin.id)*.1,p.z);view.rotation.set(p.pitch,time*2,0);renderer.trafficView.add(view);
    }
    if(!arsenal.shots.length)return;
    let rocketIndex=0;
    for(const shot of arsenal.shots){
      const progress=Math.min(1,(time-shot.born)/ROCKETS.flightSeconds);
      const distance=progress*shot.range,index=Math.min(Math.floor(distance),shot.path.length-2),a=shot.path[index],b=shot.path[index+1];
      const s=lerp(a.s,b.s,(distance-a.distance)/(b.distance-a.distance)),route=shot.route&&s<game.road.route(shot.route).end?shot.route:null,center=game.road.branchCenter(s,route);
      const view=this.rockets[rocketIndex]??(this.rockets[rocketIndex]=rocketModel());rocketIndex++;
      const p=renderer.local(s,center+shot.lateral,route,this.point);
      view.position.set(p.x,p.y+ROCKETS.launchHeight,p.z);view.rotation.set(p.pitch,-p.heading,0);renderer.trafficView.add(view);
    }
  }
}
