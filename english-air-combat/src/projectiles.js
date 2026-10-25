import { LETTERS, UNDO, SHELLS, ENEMIES } from './config.js';
export class Projectiles {
  constructor(){this.pools={letter:this.make(LETTERS.poolSize,'letter'),undo:this.make(UNDO.poolSize,'undo'),shell:this.make(SHELLS.poolSize,'shell'),enemy:this.make(ENEMIES.bulletPoolSize,'enemy')};this.all=Object.values(this.pools).flat();}
  make(count,type){return Array.from({length:count},()=>({active:false,type,x:0,y:0,previousX:0,previousY:0,age:0,speed:0,targetId:0,index:-1,segment:-1,letter:'',originX:0,originY:0,controlX:0,controlY:0,flightAge:0,flightDuration:0,trail:type==='shell'?Array.from({length:SHELLS.trailPoints},()=>({x:0,y:0})):null,trailCount:0,trailCursor:0,trailClock:0}));}
  spawn(type,values){const projectile=this.pools[type].find(item=>!item.active);if(!projectile)return null;Object.assign(projectile,{age:0,targetId:0,index:-1,segment:-1,letter:'',flightAge:0,flightDuration:0,trailCount:0,trailCursor:0,trailClock:0},values,{type,active:true,previousX:values.x,previousY:values.y});return projectile;}
  clear(){for(const item of this.all)item.active=false;}
}
