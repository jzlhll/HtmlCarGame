import { ROCKETS } from './config.js';
import { coinModel, rocketModel } from './arsenal-models.js';

// 金币及火箭的部件共享几何与材质，显示对象按固定上限复用。
export class ArsenalView {
  constructor(){this.coins=new Map();this.pools={small:[],large:[]};this.rockets={normal:[],advanced:[]};this.seen=new Set();this.point={};}
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
    let normal=0,advancedIndex=0;
    const origin=renderer.origin,h=origin.heading,cos=Math.cos(h),sin=Math.sin(h);
    for(const shot of arsenal.shots){
      const progress=Math.min(1,(time-shot.born)/ROCKETS.flightSeconds),advanced=shot.type==='advanced',count=advanced?3:1;
      const fx=Math.sin(shot.heading),fz=-Math.cos(shot.heading),sx=Math.cos(shot.heading),sz=Math.sin(shot.heading);
      for(let i=0;i<count;i++){
        const index=advanced?advancedIndex++:normal++,pool=this.rockets[shot.type],view=pool[index]??(pool[index]=rocketModel(advanced));
        const spread=advanced?(i-1)*shot.width/3:0,dx=shot.origin.x+fx*progress*shot.range+sx*spread-origin.x,dz=shot.origin.z+fz*progress*shot.range+sz*spread-origin.z;
        view.position.set(cos*dx+sin*dz,shot.origin.y-origin.y+ROCKETS.launchHeight,-sin*dx+cos*dz);view.rotation.set(0,-shot.heading+h,0);renderer.trafficView.add(view);
      }
    }
  }
}
