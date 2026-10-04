import { random, lerp, smooth, clamp } from './config.js';

// 有限种子计划重复使用，逻辑距离持续增长；每轮平移连接上一轮终点。
export class Road {
  constructor(seed) {
    this.seed = seed;
    const rng = random(seed);
    this.segments = [];
    let s = 0;
    const add = (kind,length,options={}) => {
      this.segments.push({kind,start:s,end:s+length,length,scene:Math.floor(rng()*3),...options});
      s += length;
    };
    add('straight',240,{lanes:3});
    const bendPair=lanes=>{
      const angle=(12+rng()*10)*Math.PI/180,length=240+Math.floor(rng()*7)*20,sign=rng()<.5?1:-1;
      add('curve',length,{lanes,angle:angle*sign});
      if(rng()<.45)add('straight',60,{lanes});
      add('curve',length,{lanes,angle:-angle*sign});
    };
    for (let cycle=0;cycle<3;cycle++) {
      bendPair(3);
      add('straight',160+Math.floor(rng()*4)*20,{lanes:3});
      const termination=cycle===1||(cycle===2&&rng()<.5);
      add(termination?'wall':'taper',termination?300:400,{from:3,to:2,lanes:3});
      add('straight',160,{lanes:2});
      bendPair(2);
      add('straight',160,{lanes:2});
      add('open',400,{from:2,to:3,lanes:2});
      add('straight',100,{lanes:3});
      bendPair(3);
      add('straight',100+Math.floor(rng()*5)*20,{lanes:3});
    }
    add('straight',240,{lanes:3});
    this.length=s;
    this.closureSegments=this.segments.filter(seg=>seg.kind==='taper'||seg.kind==='wall');
    this.wallSegments=this.closureSegments.filter(seg=>seg.kind==='wall');
    this.hills=[];
    for(let start=90;start<s-700;){
      const length=520+Math.floor(rng()*10)*20,height=22+rng()*9;
      this.hills.push({start,end:start+length,length,height});
      start+=length+180+Math.floor(rng()*12)*20;
    }
    this.samples=[];
    let x=0,z=0,heading=0;
    for (let station=0;station<=s;station+=5) {
      const elevation=this.elevation(station);
      this.samples.push({s:station,x,y:elevation.y,z,heading,pitch:Math.asin(elevation.grade)});
      const seg=this.segments.find(v => station>=v.start && station<v.end);
      const curvature = seg?.angle ? seg.angle/seg.length*(1-Math.cos(2*Math.PI*(station-seg.start+2.5)/seg.length)) : 0;
      const middle=heading+curvature*2.5;
      const grade=this.elevation(station+2.5).grade,horizontal=Math.sqrt(1-grade*grade)*5;
      x+=Math.sin(middle)*horizontal;
      z-=Math.cos(middle)*horizontal;
      heading+=curvature*5;
    }
    // 所有长度都是五米倍数，首尾曲率和方向相同。
    this.end=this.samples[this.samples.length-1];
  }
  elevation(s){
    if(s<0)return {y:0,grade:0};
    const local=s%this.length,hill=this.hills.find(h=>local>=h.start&&local<=h.end);
    if(!hill)return {y:0,grade:0};
    const phase=(local-hill.start)/hill.length*Math.PI*2;
    // 上下坡成对连接，入口、山顶和出口坡度为零，循环首尾保持平地。
    return {y:hill.height*(1-Math.cos(phase))/2,grade:hill.height*Math.PI/hill.length*Math.sin(phase)};
  }
  segment(s) {
    const lap=Math.floor(Math.max(0,s)/this.length);
    const local=Math.max(0,s)-lap*this.length;
    return {...this.segments.find(v => local>=v.start && local<v.end),lap,local};
  }
  at(s,d=0) {
    if (s<0) return {x:d,y:0,z:-s,heading:0,pitch:0};
    const lap=Math.floor(s/this.length), local=s-lap*this.length;
    const i=Math.floor(local/5), a=this.samples[i],b=this.samples[Math.min(i+1,this.samples.length-1)];
    const t=(local-a.s)/5,heading=lerp(a.heading,b.heading,t);
    return {x:lap*this.end.x+lerp(a.x,b.x,t)+Math.cos(heading)*d,y:lerp(a.y,b.y,t),z:lap*this.end.z+lerp(a.z,b.z,t)+Math.sin(heading)*d,heading,pitch:lerp(a.pitch,b.pitch,t)};
  }
  lanes(s) {
    if(s<0) return 3;
    const seg=this.segment(s),t=clamp((seg.local-seg.start)/seg.length,0,1);
    if(seg.kind==='taper') return lerp(3,2,smooth(t));
    if(seg.kind==='open') return lerp(2,3,smooth(t));
    return seg.lanes || 3;
  }
  edge(s) { return .4+this.lanes(s)*3.6; }
  available(s) { return this.lanes(s)>=2.999 ? 3 : 2; }
  closures(s,look=450) {
    const lap=Math.floor(Math.max(0,s)/this.length);
    const list=[];
    for(let round=lap;round<=lap+1;round++) for(const seg of this.closureSegments) {
      const start=round*this.length+seg.start, end=round*this.length+seg.end;
      if(end>=s-10 && start<=s+look) list.push({...seg,start,end});
    }
    return list;
  }
  walls(s,look=450) {
    const lap=Math.floor(Math.max(0,s)/this.length),list=[];
    for(let round=lap;round<=lap+1;round++)for(const seg of this.wallSegments){
      const start=round*this.length+seg.start,end=round*this.length+seg.end;
      if(end>=s-10&&start<=s+look)list.push({...seg,start,end});
    }
    return list;
  }
}
