import { WEATHER, ROAD_FORKS, VEHICLES, laneD, random, lerp, clamp } from './config.js';

// 天气落点(泥浆/冰面)与移动目标的连续接触检测:双方使用道路弧长及横向位置;可选按路线坐标系换算。
export function projectileContact(from,to,target,targetNext,radius,road=null){
  if(road){
    const p=road.at(target.s,target.d,target.route),next=road.at(targetNext.s,targetNext.d,targetNext.route),a=road.at(from.s,from.d,from.route),b=road.at(to.s,to.d,to.route);
    const heading=p.heading+(target.yaw||0),sin=Math.sin(heading),cos=Math.cos(heading);
    const coordinates=point=>({s:(point.x-p.x)*sin-(point.z-p.z)*cos,d:(point.x-p.x)*cos+(point.z-p.z)*sin});
    from=coordinates(a);to=coordinates(b);target={...target,s:0,d:0,yaw:0};targetNext={...targetNext,...coordinates(next),yaw:0};
  }
  const size=target.dimensions||VEHICLES[target.rank];
  const yaw=target.yaw||0,sin=Math.sin(yaw),cos=Math.cos(yaw);
  const ds=from.s-target.s,dd=from.d-target.d,ms=to.s-from.s-(targetNext.s-target.s),md=to.d-from.d-(targetNext.d-target.d);
  let enter=0,exit=1;
  for(let i=0;i<2;i++){
    const half=(i===0?size.length:size.width)/2;
    const position=i===0?ds*cos+dd*sin:dd*cos-ds*sin,motion=i===0?ms*cos+md*sin:md*cos-ms*sin,reach=half+radius;
    if(Math.abs(motion)<1e-10){if(Math.abs(position)>reach)return null;continue;}
    const a=(-reach-position)/motion,b=(reach-position)/motion;
    enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));
    if(enter>exit+1e-8)return null;
  }
  return enter<=1&&exit>=0?{time:Math.max(0,enter)}:null;
}

// 天气按有效游戏时间推进，事件及落点使用稳定标识，暂停不消耗持续时间。
export class SeasonalWeather {
  constructor(seed){
    this.rng=random(seed^0x6ac473b9);this.route=null;this.event=null;this.hazards=[];this.starts=[];this.nextId=1;
    this.nextAt=lerp(WEATHER.firstMin,WEATHER.firstMax,this.rng());this.nextHazardAt=0;
    this.contactStart={};this.contactFinish={};this.trafficStart={};
  }
  advance(game){
    const now=game.activeSeconds;this.road=game.road;
    const route=game.player.route??null;
    if(route!==this.route){this.route=route;this.event=null;this.hazards=[];this.nextAt=now+(route ? .5 : lerp(WEATHER.firstMin,WEATHER.firstMax,this.rng()));}
    if(this.event&&now>=this.event.until){this.event=null;this.hazards=[];}
    this.starts=this.starts.filter(time=>now-time<60);
    if(!this.event&&now>=this.nextAt&&(route||this.starts.length<2)){
      this.nextAt=now+lerp(route?ROAD_FORKS.weatherIntervalMin:WEATHER.intervalMin,route?ROAD_FORKS.weatherIntervalMax:WEATHER.intervalMax,this.rng());
      if(this.rng()<(route?ROAD_FORKS.weatherChance:WEATHER.chance)){
        const season=route?Math.floor(this.rng()*4):game.season().index;
        this.event={id:this.nextId++,season,route,from:now,until:now+(season===2?WEATHER.windDuration:WEATHER.duration),wind:this.rng()<.5?-1:1,fogDistance:WEATHER.fogFar};
        if(!route)this.starts.push(now);this.nextHazardAt=now+.4;
        if(route)this.nextAt=this.event.until+lerp(ROAD_FORKS.weatherIntervalMin,ROAD_FORKS.weatherIntervalMax,this.rng());
      }
    }
    if(!this.event)return;
    this.hazards=this.hazards.filter(hazard=>hazard.until>now);
    if((this.event.season===1||this.event.season===3)&&now>=this.nextHazardAt){
      const s=game.player.s+lerp(20,40,this.rng()),direction=this.rng()<.5?-1:1;
      const route=this.event.route,d=game.road.branchCenter(s,route)+laneD(Math.floor(this.rng()*game.road.available(s,route)),direction),lightning=this.event.season===1;
      const from=now+(lightning?.85:.5);
      if(!route||s<game.road.route(route).end)this.hazards.push({id:this.nextId++,kind:lightning?'lightning':'ice',s,d,route,createdAt:now,from,until:Math.min(this.event.until,from+(lightning?.7:2.8)),hits:new Set()});
      this.nextHazardAt=now+lerp(1.4,2.1,this.rng());
    }
  }
  wind(route=this.route){return this.event?.season===2&&(!this.event.route||this.event.route===route)?this.event.wind:0;}
  lateral(control,speed,route=this.route){
    const wind=this.wind(route);
    return control*speed*(wind&&control?control===wind?1.6:.18:1)+wind*WEATHER.windSpeed;
  }
  contact(start,finish,hazard,now,dt,key='player'){
    if(hazard.hits.has(key)||hazard.until<=now||hazard.from>now+dt)return null;
    if((hazard.route??null)!==(start.route??null))return null;
    const first=clamp((hazard.from-now)/dt,0,1),last=clamp((hazard.until-now)/dt,0,1);
    const a=this.contactStart,b=this.contactFinish;
    a.rank=b.rank=start.rank;a.dimensions=b.dimensions=start.dimensions;a.route=b.route=start.route;a.yaw=b.yaw=start.yaw;
    a.s=lerp(start.s,finish.s,first);a.d=lerp(start.d,finish.d,first);b.s=lerp(start.s,finish.s,last);b.d=lerp(start.d,finish.d,last);
    const event=projectileContact(hazard,hazard,a,b,hazard.kind==='ice'?1.35:1,hazard.route?this.road:null);
    return event?{time:lerp(first,last,event.time)}:null;
  }
  freeze(car,now){
    // 已冻住的车不会被连续落点重置减速曲线；三秒减至零，再停留一秒解冻。
    if(car.frozenUntil>now)return;
    car.frozenAt=now;car.frozenUntil=now+WEATHER.freezeSeconds+1;car.frozenSpeed=car.speed;
  }
  speedLimit(car,now){
    return car.frozenUntil>now?car.frozenSpeed*Math.max(0,1-(now-car.frozenAt)/WEATHER.freezeSeconds):Infinity;
  }
  trafficContact(car,now,dt){
    for(const hazard of this.hazards){
      if(hazard.kind!=='ice')continue;
      const key=car.weatherKey??=('car:'+car.id),start=this.trafficStart,previous=car.previous||car;
      start.s=previous.s;start.d=previous.d;start.route=previous.route===undefined?car.route:previous.route;start.rank=car.rank;start.dimensions=car.dimensions;start.yaw=car.yaw;
      const event=this.contact(start,car,hazard,now,dt,key);
      if(!event)continue;
      hazard.hits.add(key);this.freeze(car,now+event.time*dt);
    }
  }
}
