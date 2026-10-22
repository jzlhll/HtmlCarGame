import { LETTERS, UNDO, SHELLS, ENEMIES } from './config.js';
export class Projectiles {
  constructor(){this.pools={letter:this.make(LETTERS.poolSize,'letter'),undo:this.make(UNDO.poolSize,'undo'),shell:this.make(SHELLS.poolSize,'shell'),enemy:this.make(ENEMIES.bulletPoolSize,'enemy')};this.all=Object.values(this.pools).flat();}
  make(count,type){return Array.from({length:count},()=>({active:false,type,x:0,y:0,previousY:0,age:0,speed:0,targetId:0,index:-1,segment:-1,letter:''}));}
  spawn(type,values){const projectile=this.pools[type].find(item=>!item.active);if(!projectile)return null;Object.assign(projectile,{age:0,targetId:0,index:-1,segment:-1,letter:''},values,{type,active:true,previousY:values.y});return projectile;}
  clear(){for(const item of this.all)item.active=false;}
}
