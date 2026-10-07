import { ROAD_CACHE, ROAD_CURVES, ROADWORKS, ROAD_INFRASTRUCTURE, ROAD_FORKS, ROAD_DIFFICULTY, LANE_WIDTH, laneD, random, lerp, smooth, clamp } from './config.js';

// 有限种子计划重复使用，逻辑距离持续增长；每轮平移连接上一轮终点。
export class Road {
  constructor(seed) {
    this.seed = seed;this.narrowStart=Infinity;this.narrowEnd=Infinity;this.revision=0;this.lapCache=new Map();this.routeCache=new Map();
    const rng = random(seed);
    this.segments = [];
    let s = 0;
    const add = (kind,length,options={}) => {
      this.segments.push({kind,start:s,end:s+length,length,scene:Math.floor(rng()*3),...options});
      s += length;
    };
    add('straight',240,{lanes:3});
    const bendPair=lanes=>{
      const settings=ROAD_CURVES;
      const angle=lerp(settings.minAngle,settings.maxAngle,rng())*Math.PI/180,length=settings.minLength+Math.floor(rng()*((settings.maxLength-settings.minLength)/settings.lengthStep+1))*settings.lengthStep,sign=rng()<.5?1:-1;
      add('curve',length,{lanes,angle:angle*sign});
      if(rng()<settings.straightChance)add('straight',settings.straightLength,{lanes});
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
      if(rng()<ROAD_CURVES.extraPairChance)bendPair(3);
      else add('straight',100+Math.floor(rng()*5)*20,{lanes:3});
    }
    add('straight',240,{lanes:3});
    this.length=s;
    this.closureSegments=this.segments.filter(seg=>seg.kind==='taper'||seg.kind==='wall');
    this.wallSegments=this.closureSegments.filter(seg=>seg.kind==='wall');
    this.structures=[];
    const structureRng=random(seed^0x163fdab9);
    for(let start=300,index=0;start<s-500;index++){
      const kind=index===0?'viaduct':index===1?'dip':structureRng()<.55?'viaduct':'dip';
      const flat=kind==='viaduct'?80:ROAD_INFRASTRUCTURE.dipLength;
      // 高度与坡长独立随机:可能抽出更高更缓的长坡(顶峰较远),也可能抽出更高且很快到顶的短坡;
      // 最小坡长按最大坡度反推,保证 smooth 坡道的峰值坡度不越界。
      const magnitude=kind==='viaduct'
        ?ROAD_INFRASTRUCTURE.viaductHeightMin+structureRng()*(ROAD_INFRASTRUCTURE.viaductHeightMax-ROAD_INFRASTRUCTURE.viaductHeightMin)
        :ROAD_INFRASTRUCTURE.dipDepthMin+structureRng()*(ROAD_INFRASTRUCTURE.dipDepthMax-ROAD_INFRASTRUCTURE.dipDepthMin);
      const height=kind==='viaduct'?magnitude:-magnitude;
      const rampBase=kind==='viaduct'
        ?ROAD_INFRASTRUCTURE.viaductRampMin+structureRng()*(ROAD_INFRASTRUCTURE.viaductRampMax-ROAD_INFRASTRUCTURE.viaductRampMin)
        :ROAD_INFRASTRUCTURE.dipRampMin+structureRng()*(ROAD_INFRASTRUCTURE.dipRampMax-ROAD_INFRASTRUCTURE.dipRampMin);
      const ramp=Math.max(Math.ceil(Math.abs(height)*1.5/ROAD_INFRASTRUCTURE.maxGrade/5)*5,Math.round(rampBase/5)*5);
      const length=ramp*2+flat;
      const choice=structureRng()<.55?'rail':'river',feature=kind==='dip'&&choice==='rail'?'valley':choice;
      this.structures.push({start,end:start+length,length,ramp,flat,height,kind,feature,
        center:start+length/2,flatStart:start+ramp,flatEnd:start+ramp+flat});
      // 建筑道路之间留出足够长的平地区间，容纳加长后的分叉及两端缓冲。
      start+=length+ROAD_INFRASTRUCTURE.gapMin+Math.floor(structureRng()*((ROAD_INFRASTRUCTURE.gapMax-ROAD_INFRASTRUCTURE.gapMin)/20+1))*20;
    }
    this.samples=[];
    let x=0,z=0,heading=0;
    const elevationPoint={};
    for (let station=0;station<=s;station+=5) {
      const elevation=this.elevation(station,elevationPoint);
      this.samples.push({s:station,x,y:elevation.y,z,heading,pitch:Math.asin(elevation.grade)});
      const seg=station<s?this.localSegment(station):null;
      const curvature = seg?.angle ? seg.angle/seg.length*(1-Math.cos(2*Math.PI*(station-seg.start+2.5)/seg.length)) : 0;
      const middle=heading+curvature*2.5;
      const grade=this.elevation(station+2.5,elevationPoint).grade,horizontal=Math.sqrt(1-grade*grade)*5;
      x+=Math.sin(middle)*horizontal;
      z-=Math.cos(middle)*horizontal;
      heading+=curvature*5;
    }
    // 所有长度都是五米倍数，首尾曲率和方向相同。
    this.end=this.samples[this.samples.length-1];
    this.worksites=[];
    this.forks=[];
    const forkRng=random(seed^0x418e79a3);
    for(let pass=0;pass<2;pass++){
      if(pass&&this.forks.length)break;
      for(let i=0;i<this.structures.length-1;i++){
        if(pass===0&&forkRng()>ROAD_FORKS.chance)continue;
        const first=this.structures[i].end+40,last=this.structures[i+1].start-40;
        const span=Math.floor(Math.min(ROAD_FORKS.maxSpan,last-first)/5)*5;
        if(span<ROAD_FORKS.minSpan)continue;
        const wanted=ROAD_FORKS.minSpan+Math.floor(forkRng()*((span-ROAD_FORKS.minSpan)/5+1))*5;
        for(let start=first;start+ROAD_FORKS.minSpan<=last;start+=20){
          let end=Math.min(start+wanted,last);
          // 在可用区间内缩短候选，但始终保留加长后的最小跨度。
          while(end-start>=ROAD_FORKS.minSpan&&(!this.stable(start-20,end+20)||this.roadworks(start-30,end+30).length))end-=5;
          if(end-start<ROAD_FORKS.minSpan)continue;
          const side=forkRng()<.5?-1:1,lanes=this.available(start),windingMain=forkRng()<.5;
          const separation=this.edge(start)*2+lerp(ROAD_FORKS.separationMin,ROAD_FORKS.separationMax,forkRng());
          const mainAmplitude=windingMain?separation-(1+forkRng()*3):forkRng()*3;
          const fork={start,end,span:end-start,side,lanes,edge:.4+lanes*3.6,separation,mainAmplitude,windingMain,index:this.forks.length};
          this.buildForkSamples(fork);
          if(fork.branchLength<ROAD_FORKS.minLength||fork.branchLength>ROAD_FORKS.maxLength)continue;
          this.forks.push(fork);break;
        }
      }
    }
    this.minimumPathScale=1;
    for(const fork of this.forks)for(const points of [fork.mainSamples,fork.branchSamples])for(const point of points)this.minimumPathScale=Math.min(this.minimumPathScale,point.scale);
    const worksRng=random(seed^0x49a7d312);
    for(let slot=ROADWORKS.first;slot<this.length-300;slot+=ROADWORKS.interval){
      const start=slot+Math.floor(worksRng()*80),length=ROADWORKS.minLength+Math.floor(worksRng()*(ROADWORKS.maxLength-ROADWORKS.minLength+1)),end=start+length;
      if(worksRng()>=ROADWORKS.chance)continue;
      // 施工前后留出稳定宽度和并道缓冲，不与永久收窄、扩道叠加。
      if(this.segments.some(seg=>['taper','wall','open'].includes(seg.kind)&&seg.end>=start-ROADWORKS.warningDistance&&seg.start<=end+180)||this.structures.some(site=>site.end>=start-100&&site.start<=end+100)||this.forks.some(fork=>fork.end>=start-ROADWORKS.warningDistance&&fork.start<=end+180))continue;
      const direction=worksRng()<.75?1:-1,lane=Math.floor(worksRng()*this.available(start));
      this.worksites.push({start,end,length,lane,direction,d:laneD(lane,direction),dimensions:{width:ROADWORKS.barrierWidth,length:length+.7}});
    }
  }
  buildForkSamples(fork){
    const sample=branch=>{
      const points=[];
      for(let s=fork.start;s<=fork.end;s+=5){
        const t=(s-fork.start)/fork.span,bump=Math.sin(Math.PI*t)**2;
        const offset=fork.side*((branch?fork.separation:0)-fork.mainAmplitude)*bump;
        points.push({...this.baseAt(s,offset),s});
      }
      let length=0;
      for(let i=0;i<points.length;i++){
        const from=points[Math.max(0,i-1)],to=points[Math.min(points.length-1,i+1)];
        const horizontal=Math.hypot(to.x-from.x,to.z-from.z);
        points[i].heading=Math.atan2(to.x-from.x,from.z-to.z);
        points[i].pitch=Math.atan2(to.y-from.y,horizontal);
        points[i].scale=Math.hypot(horizontal,to.y-from.y)/(to.s-from.s);
        if(i)length+=Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y,points[i].z-points[i-1].z);
      }
      // 入口和出口与原公路共用切线，避免切换路线时车头突然转向。
      for(const i of [0,points.length-1]){const p=this.baseAt(points[i].s);points[i].heading=p.heading;points[i].pitch=p.pitch;points[i].scale=1;}
      return {points,length};
    };
    const main=sample(false),branch=sample(true);
    fork.mainSamples=main.points;fork.branchSamples=branch.points;fork.branchLength=branch.length;
  }
  // 跨轮查询共享只读结构；只保留附近几轮，避免无限道路缓存持续增长。
  lapData(lap){
    let data=this.lapCache.get(lap);
    if(data)return data;
    if(this.lapCache.size>=ROAD_CACHE.maxLaps){
      const oldest=this.lapCache.keys().next().value,expired=this.lapCache.get(oldest);
      for(const fork of expired.forks)if(fork) this.routeCache.delete(fork.id);
      this.lapCache.delete(oldest);
    }
    data={offset:lap*this.length,forks:[],sites:[],works:[],closures:[]};this.lapCache.set(lap,data);return data;
  }
  forkView(lap,index,lanes){
    const data=this.lapData(lap),base=this.forks[index];
    let views=data.forks[index];
    if(!views){views={id:lap+':'+index,variants:[]};data.forks[index]=views;this.routeCache.set(views.id,{lap,index});}
    return views.variants[lanes]??=({...base,lanes,edge:.4+lanes*LANE_WIDTH,start:base.start+data.offset,end:base.end+data.offset,lap,id:views.id});
  }
  forksRange(from,to=from,list=[]){
    list.length=0;
    for(let lap=Math.floor(Math.max(0,from)/this.length);lap<=Math.floor(Math.max(0,to)/this.length);lap++)for(const fork of this.forks){
      const offset=lap*this.length;
      if(fork.end+offset<from||fork.start+offset>to)continue;
      list.push(this.forkView(lap,fork.index,Math.min(fork.lanes,this.available(fork.start+offset))));
    }
    return list;
  }
  fork(s){
    if(s<0)return null;
    const lap=Math.floor(s/this.length),local=s-lap*this.length;
    for(const fork of this.forks)if(local>=fork.start&&local<fork.end)return this.forkView(lap,fork.index,Math.min(fork.lanes,this.available(s)));
    return null;
  }
  route(id){
    if(id==null)return null;
    let parsed=this.routeCache.get(id);
    if(!parsed){const colon=id.indexOf(':');parsed={lap:Number(id.slice(0,colon)),index:Number(id.slice(colon+1))};}
    const {lap,index}=parsed,fork=this.forks[index];
    if(!fork||!Number.isInteger(lap)||lap<0)return null;
    return this.forkView(lap,index,Math.min(fork.lanes,this.available(fork.start+lap*this.length)));
  }
  branchCenter(s,route){
    const fork=this.route(route);if(!fork)return 0;
    const t=clamp((s-fork.start)/fork.span,0,1);
    return fork.side*fork.separation*Math.sin(Math.PI*t)**2;
  }
  pathScale(s,route=null){
    const fork=route?this.route(route):this.fork(s);
    if(!fork||s<=fork.start||s>=fork.end)return 1;
    const station=(s-fork.start)/5,index=Math.floor(station),samples=route?fork.branchSamples:fork.mainSamples;
    return lerp(samples[index].scale,samples[index+1].scale,station-index);
  }
  chooseRoute(s,d,route){
    if(route){const fork=this.route(route);return fork&&s>fork.start&&s<fork.end?route:null;}
    const fork=this.fork(s);if(!fork)return null;
    const center=this.branchCenter(s,fork.id),joined=this.junction(s,fork.side);
    return joined&&fork.side*d>this.edge(s)+.4&&Math.abs(d-center)<this.edge(s,fork.id)-.5?fork.id:null;
  }
  enterRoute(car,route){
    // 由当前位置投影到副路，切换坐标系时保持世界位置连续。
    const world=this.at(car.s,car.d,car.route),fork=this.route(route),samples=fork.branchSamples;
    let best=null;
    for(let i=0;i<samples.length-1;i++){
      const a=samples[i],b=samples[i+1],station=fork.lap*this.length+a.s;
      if(Math.abs(station-car.s)>25)continue;
      const ax=a.x+fork.lap*this.end.x,az=a.z+fork.lap*this.end.z,dx=b.x-a.x,dz=b.z-a.z;
      const t=clamp(((world.x-ax)*dx+(world.z-az)*dz)/(dx*dx+dz*dz),0,1),x=ax+dx*t,z=az+dz*t;
      const distance=(world.x-x)**2+(world.z-z)**2;
      if(!best||distance<best.distance){const heading=lerp(a.heading,b.heading,t);best={s:station+t*5,d:(world.x-x)*Math.cos(heading)+(world.z-z)*Math.sin(heading),distance};}
    }
    if(best){car.s=best.s;car.d=this.branchCenter(best.s,route)+best.d;}
    car.route=route;
  }
  junction(s,side){
    const fork=this.fork(s);if(!fork||fork.side!==side)return false;
    return Math.abs(this.branchCenter(s,fork.id))<this.edge(s)+this.edge(s,fork.id)-1;
  }
  drivableBounds(s,route=null){
    if(route){const center=this.branchCenter(s,route),edge=this.edge(s,route);return {min:center-edge,max:center+edge};}
    const edge=this.edge(s),fork=this.fork(s),bounds={min:-edge,max:edge};
    if(fork&&this.junction(s,fork.side)){
      const center=this.branchCenter(s,fork.id);
      const branchEdge=this.edge(s,fork.id);bounds.min=Math.min(bounds.min,center-branchEdge);bounds.max=Math.max(bounds.max,center+branchEdge);
    }
    return bounds;
  }
  onPavement(s,d,padding=0){
    if(Math.abs(d)<this.edge(s)+padding)return true;
    const fork=this.fork(s);return Boolean(fork&&Math.abs(d-this.branchCenter(s,fork.id))<this.edge(s,fork.id)+padding);
  }
  elevation(s,out={}){
    out.y=0;out.grade=0;
    if(s<0)return out;
    const local=s%this.length;
    for(const site of this.structures){
      if(local<site.start||local>site.end)continue;
      if(local>=site.flatStart&&local<=site.flatEnd){out.y=site.height;return out;}
      const entering=local<site.flatStart,t=entering?(local-site.start)/site.ramp:(site.end-local)/site.ramp;
      // 桥面和谷底保持平坦，坡脚与坡顶用零坡度衔接。
      out.y=site.height*smooth(t);out.grade=site.height*6*t*(1-t)/site.ramp*(entering?1:-1);return out;
    }
    return out;
  }
  siteView(lap,index){
    const data=this.lapData(lap),site=this.structures[index],offset=data.offset;
    return data.sites[index]??=({...site,start:site.start+offset,end:site.end+offset,center:site.center+offset,flatStart:site.flatStart+offset,flatEnd:site.flatEnd+offset,id:lap+':'+index});
  }
  infrastructure(from,to=from,list=[]){
    list.length=0;
    for(let lap=Math.floor(Math.max(0,from)/this.length);lap<=Math.floor(Math.max(0,to)/this.length);lap++)for(let i=0;i<this.structures.length;i++){
      const site=this.structures[i],offset=lap*this.length;
      if(offset+site.end<from||offset+site.start>to)continue;
      list.push(this.siteView(lap,i));
    }
    return list;
  }
  dip(s){
    if(s<0)return undefined;
    const lap=Math.floor(s/this.length),local=s-lap*this.length;
    for(let i=0;i<this.structures.length;i++){
      const site=this.structures[i];
      if(site.kind==='dip'&&local>=site.flatStart&&local<site.flatEnd)return this.siteView(lap,i);
    }
  }
  groundElevation(s){
    if(s<0)return 0;
    const local=s%this.length;
    for(const site of this.structures)if(site.kind==='dip'&&site.feature==='river'&&local>=site.start&&local<=site.end){
      if(local>=site.flatStart&&local<=site.flatEnd)return site.height;
      return site.height*smooth(local<site.flatStart?(local-site.start)/site.ramp:(site.end-local)/site.ramp);
    }
    return 0;
  }
  segment(s) {
    const lap=Math.floor(Math.max(0,s)/this.length);
    const local=Math.max(0,s)-lap*this.length;
    if(s>=this.narrowStart&&s<this.narrowEnd)return {kind:'taper',start:this.narrowStart,end:this.narrowEnd,length:ROAD_DIFFICULTY.taperLength,from:3,to:2,lanes:3,lap,local};
    return {...this.localSegment(local),lap,local};
  }
  localSegment(local){
    let low=0,high=this.segments.length-1;
    while(low<high){const middle=(low+high)>>>1;if(local<this.segments[middle].end)high=middle;else low=middle+1;}
    return this.segments[low];
  }
  baseAt(s,d=0,out={}) {
    if (s<0){out.x=d;out.y=0;out.z=-s;out.heading=0;out.pitch=0;return out;}
    const lap=Math.floor(s/this.length), local=s-lap*this.length;
    const i=Math.floor(local/5), a=this.samples[i],b=this.samples[Math.min(i+1,this.samples.length-1)];
    const t=(local-a.s)/5,heading=lerp(a.heading,b.heading,t);
    out.x=lap*this.end.x+lerp(a.x,b.x,t)+Math.cos(heading)*d;out.y=lerp(a.y,b.y,t);out.z=lap*this.end.z+lerp(a.z,b.z,t)+Math.sin(heading)*d;out.heading=heading;out.pitch=lerp(a.pitch,b.pitch,t);return out;
  }
  at(s,d=0,route=null,out={}){
    const fork=route?this.route(route):this.fork(s);
    if(!fork||s<fork.start||s>fork.end)return this.baseAt(s,d,out);
    const station=(s-fork.start)/5,index=Math.min(Math.floor(station),fork.mainSamples.length-2),t=station-index;
    const samples=route?fork.branchSamples:fork.mainSamples,a=samples[index],b=samples[index+1];
    const heading=lerp(a.heading,b.heading,t),lateral=d-this.branchCenter(s,route);
    out.x=this.end.x*fork.lap+lerp(a.x,b.x,t)+Math.cos(heading)*lateral;out.y=lerp(a.y,b.y,t);out.z=this.end.z*fork.lap+lerp(a.z,b.z,t)+Math.sin(heading)*lateral;out.heading=heading;out.pitch=lerp(a.pitch,b.pitch,t);return out;
  }
  narrowAfter(s){
    if(Number.isFinite(this.narrowStart))return;
    // 两条路线同步收窄，不等待长分叉结束；当前车身所在位置保持原宽度。
    const start=Math.ceil((s+ROAD_DIFFICULTY.warningDistance)/20)*20;
    this.narrowStart=start;this.narrowEnd=start+ROAD_DIFFICULTY.taperLength;this.revision++;
    for(const data of this.lapCache.values())for(const fork of data.forks)if(fork)fork.variants.length=0;
    this.narrowClosure={kind:'taper',start:this.narrowStart,end:this.narrowEnd,length:ROAD_DIFFICULTY.taperLength,from:3,to:2,lanes:3};
  }
  isFourLanePhase(s){return Number.isFinite(this.narrowEnd)&&s>=this.narrowEnd;}
  lanes(s) {
    if(s<0) return 3;
    const local=s%this.length,seg=this.localSegment(local),t=clamp((local-seg.start)/seg.length,0,1);
    let lanes=seg.kind==='taper'?lerp(3,2,smooth(t)):seg.kind==='open'?lerp(2,3,smooth(t)):seg.lanes||3;
    if(s>=this.narrowStart)lanes=Math.min(lanes,lerp(3,2,smooth(clamp((s-this.narrowStart)/ROAD_DIFFICULTY.taperLength,0,1))));
    return lanes;
  }
  edge(s,route=null) { return .4+(route?Math.min(this.route(route).lanes,this.lanes(s)):this.lanes(s))*LANE_WIDTH; }
  available(s,route=null) { return route?Math.min(this.route(route).lanes,this.available(s)):this.lanes(s)>=2.999 ? 3 : 2; }
  roadworks(from,to=from,list=[]) {
    list.length=0;
    for(let lap=Math.floor(Math.max(0,from)/this.length);lap<=Math.floor(Math.max(0,to)/this.length);lap++)for(let i=0;i<this.worksites.length;i++){
      const site=this.worksites[i],start=lap*this.length+site.start,end=lap*this.length+site.end;
      if(end+.35>=from&&start-.35<=to&&site.lane<this.available(start))list.push(this.lapData(lap).works[i]??=({...site,start,end,s:(start+end)/2,id:lap+':'+i}));
    }
    return list;
  }
  laneOpen(s,lane,direction=1,look=0,padding=0) {
    const end=s+direction*look;
    if(lane<0||lane>=Math.min(this.available(s),this.available(end)))return false;
    const from=Math.min(s,end)-padding,to=Math.max(s,end)+padding;
    // 开放状态直接查询种子计划，避免每辆车每个逻辑步创建施工列表和副本。
    for(let lap=Math.floor(Math.max(0,from)/this.length);lap<=Math.floor(Math.max(0,to)/this.length);lap++)for(const site of this.worksites){
      if(site.direction===direction&&site.lane===lane&&lap*this.length+site.end+.35>=from&&lap*this.length+site.start-.35<=to)return false;
    }
    return true;
  }
  stable(from,to) {
    for(let lap=Math.floor(Math.max(0,from)/this.length);lap<=Math.floor(Math.max(0,to)/this.length);lap++)for(const seg of this.segments){
      if(['taper','wall','open'].includes(seg.kind)&&lap*this.length+seg.end>=from&&lap*this.length+seg.start<=to)return false;
    }
    return true;
  }
  closureView(lap,seg){
    const data=this.lapData(lap),index=this.closureSegments.indexOf(seg);
    return data.closures[index]??=({...seg,start:seg.start+data.offset,end:seg.end+data.offset});
  }
  closures(s,look=450,list=[]) {
    const lap=Math.floor(Math.max(0,s)/this.length);
    list.length=0;
    for(let round=lap;round<=lap+1;round++) for(const seg of this.closureSegments) {
      const start=round*this.length+seg.start, end=round*this.length+seg.end;
      if(end>=s-10&&start<=s+look&&end<this.narrowStart)list.push(this.closureView(round,seg));
    }
    if(this.narrowEnd>=s-10&&this.narrowStart<=s+look)list.push(this.narrowClosure);
    return list;
  }
  walls(s,look=450,list=[]) {
    const lap=Math.floor(Math.max(0,s)/this.length);list.length=0;
    for(let round=lap;round<=lap+1;round++)for(const seg of this.wallSegments){
      const start=round*this.length+seg.start,end=round*this.length+seg.end;
      if(end>=s-10&&start<=s+look&&end<this.narrowStart)list.push(this.closureView(round,seg));
    }
    return list;
  }
}
