// 仅生成可持久化的顶点、法线与顶点色；渲染对象在主线程准备期恢复。
const linear=value=>value<=.04045?value/12.92:Math.pow((value+.055)/1.055,2.4);
const rgb=hex=>[linear((hex>>16&255)/255),linear((hex>>8&255)/255),linear((hex&255)/255)];
const mix=(a,b,t)=>a.map((value,i)=>value+(b[i]-value)*t);
const normalize=v=>{const length=Math.hypot(...v)||1;return v.map(x=>x/length);};
class Surface {
  constructor(){this.positions=[];this.normals=[];this.colors=[];}
  triangle(a,b,c){for(const point of [a,b,c]){this.positions.push(...point.p);this.normals.push(...point.n);this.colors.push(...point.c);}}
  ellipsoid(center,radii,color,segments=24,rows=16,tilt=0){
    const tint=rgb(color),cos=Math.cos(tilt),sin=Math.sin(tilt),vertex=(u,v)=>{const a=u*Math.PI*2,b=v*Math.PI,q=[Math.sin(b)*Math.cos(a),Math.cos(b),Math.sin(b)*Math.sin(a)],p=q.map((value,i)=>value*radii[i]),n=normalize(q.map((value,i)=>value/radii[i]));return {p:[center[0]+p[0]*cos-p[1]*sin,center[1]+p[0]*sin+p[1]*cos,center[2]+p[2]],n:[n[0]*cos-n[1]*sin,n[0]*sin+n[1]*cos,n[2]],c:tint};};
    for(let y=0;y<rows;y++)for(let x=0;x<segments;x++){const a=vertex(x/segments,y/rows),b=vertex((x+1)/segments,y/rows),c=vertex(x/segments,(y+1)/rows),d=vertex((x+1)/segments,(y+1)/rows);if(y>0)this.triangle(a,b,c);if(y<rows-1)this.triangle(b,d,c);}
  }
  tube(path,radius,startColor,endColor,sides=10,steps=24){
    const start=rgb(startColor),end=rgb(endColor),rings=[];
    for(let i=0;i<=steps;i++){const t=i/steps,p=path(t),before=path(Math.max(0,t-.001)),after=path(Math.min(1,t+.001)),tangent=normalize(after.map((value,j)=>value-before[j])),side=normalize([-tangent[1],tangent[0],0]),front=normalize([tangent[1]*side[2]-tangent[2]*side[1],tangent[2]*side[0]-tangent[0]*side[2],tangent[0]*side[1]-tangent[1]*side[0]]),r=radius(t),color=mix(start,end,t);
      rings.push(Array.from({length:sides},(_,j)=>{const a=j/sides*Math.PI*2,n=side.map((value,k)=>value*Math.cos(a)+front[k]*Math.sin(a));return {p:p.map((value,k)=>value+n[k]*r),n,c:color};}));
    }
    for(let i=0;i<steps;i++)for(let j=0;j<sides;j++){const k=(j+1)%sides;this.triangle(rings[i][j],rings[i][k],rings[i+1][j]);this.triangle(rings[i][k],rings[i+1][k],rings[i+1][j]);}
  }
  wing(sign,color,light){
    const points=[[85,48],[103,151],[149,185],[218,134],[186,116],[168,68],[146,94],[126,34],[107,64]],center=[111,104,0],tint=rgb(color),edge=rgb(light);
    for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],front=[center,[...a,5],[...b,5]].map((p,j)=>({p:[p[0]*sign,p[1],p[2]-24],n:[0,0,1],c:j?edge:tint}));if(sign>0)this.triangle(front[0],front[2],front[1]);else this.triangle(front[0],front[1],front[2]);const back=front.map(v=>({...v,p:[v.p[0],v.p[1],v.p[2]-5],n:[0,0,-1]}));if(sign>0)this.triangle(back[0],back[1],back[2]);else this.triangle(back[0],back[2],back[1]);}
  }
  *finish(){
    // 只合并完整属性相同的顶点，保留硬法线与颜色边界。
    const positions=[],normals=[],colors=[],indices=[],vertices=new Map();
    for(let i=0;i<this.positions.length;i+=3){
      const p=this.positions.slice(i,i+3),n=this.normals.slice(i,i+3),c=this.colors.slice(i,i+3),key=[...p,...n,...c].map(Math.fround).join(',');
      let index=vertices.get(key);if(index===undefined){index=positions.length/3;vertices.set(key,index);positions.push(...p);normals.push(...n);colors.push(...c);}indices.push(index);if(i%2304===0)yield;
    }
    const Index=positions.length/3>65535?Uint32Array:Uint16Array;
    return {positions:new Float32Array(positions),normals:new Float32Array(normals),colors:new Float32Array(colors),indices:new Index(indices)};
  }
}
const bezier=(a,b,c,d)=>t=>{const u=1-t;return a.map((v,i)=>u*u*u*v+3*u*u*t*b[i]+3*u*t*t*c[i]+t*t*t*d[i]);};
function* variant(settings,final){
  const style=final?settings.final:settings.mini,body=new Surface(),arm=new Surface(),head=style.headScale,s=settings.segments,r=settings.rows;
  if(final)for(const sign of [-1,1]){body.wing(sign,style.dark,style.skin);yield;for(const endpoint of [[149,185,-20],[218,134,-20],[168,68,-20]]){body.tube(bezier([sign*87,51,-18],[sign*111,125,-15],[sign*137,140,-18],[sign*endpoint[0],endpoint[1],endpoint[2]]),t=>5*(1-t)+1.5,style.light,style.skin,8,12);yield;}}
  body.ellipsoid([0,-2,-12],[77*head,72*head,62*head],style.skin,s,r);yield;
  body.ellipsoid([0,66,0],[111*head,103*head,79*head],style.skin,s,r);yield;
  body.ellipsoid([0,-5,48],[57,47,20],style.light,20,12);yield;
  for(const sign of [-1,1]){
    body.ellipsoid([sign*102,87,-8],[29,47,25],style.light,18,12,sign*.53);yield;
    body.tube(bezier([sign*62,144,0],[sign*91,final?169:173,-1],[sign*111,final?204:230,-4],[sign*73,final?201:221,7]),t=>Math.max(.25,(final?18:15)*Math.pow(1-t,.75)),style.light,style.horn,settings.tubeSides,settings.tubeSteps);yield;
    if(final){body.tube(bezier([sign*26,170,-6],[sign*44,190,-14],[sign*31,203,-10],[sign*17,210,0]),t=>Math.max(.25,11*Math.pow(1-t,.85)),style.skin,style.horn,10,20);yield;}
    const eyeY=103+(final?7:0),eyeX=sign*40;
    body.ellipsoid([eyeX,eyeY,76*head],[29,32,17],settings.eyes,22,14,-sign*.12);yield;
    body.ellipsoid([eyeX-sign*3,eyeY-2,92*head],[16,23,8],settings.iris,18,12);yield;
    body.ellipsoid([eyeX-sign*2,eyeY-1,99*head],[8.5,18,4],settings.pupil,16,12);yield;
    body.ellipsoid([eyeX-sign*6,eyeY+8,103*head],[5,6,2.5],settings.glint,10,8);yield;
    body.ellipsoid([eyeX+sign*5,eyeY-11,103*head],[2.4,2.8,1.2],settings.glint,8,6);yield;

    body.ellipsoid([sign*74,58,70*head],[17,9,5],style.cheek,16,10,sign*.13);yield;
  }
  // 表情独立合批，换面仅替换已预热几何，不重建主体。
  const expressions={};
  for(let mood=0;mood<4;mood++){
    const face=new Surface(),eyeY=103+(final?7:0);
    for(const sign of [-1,1]){
      face.tube(bezier([sign*71,eyeY+30+mood*3,84*head],[sign*58,eyeY+35,94*head],[sign*36,eyeY+27-mood*5,102*head],[sign*15,eyeY+23-mood*7,100*head]),()=>6+mood*.5,style.dark,style.dark,8,10);yield;
      if(mood>0){face.ellipsoid([sign*73,58,76*head],[14,7,3],mood>1?0xee609e:style.cheek,12,8);yield;}
    }
    face.ellipsoid([0,51,78*head],[46-mood*3,26-mood*3,15],style.dark,24,14,mood===0?.08:0);yield;
    face.ellipsoid([4,33+mood*3,90*head],[22-mood*3,7,3],settings.tongue,16,8);yield;
    for(const sign of [-1,1]){face.tube(bezier([sign*27,68-mood,90*head],[sign*28,61,96*head],[sign*23,46,98*head],[sign*20,43+mood*2,97*head]),t=>7.5*(1-t)+.3,settings.tooth,settings.tooth,10,10);yield;}
    if(mood>=2){for(const x of [-10,0,10]){face.ellipsoid([x,64,95*head],[4.8,5,2],settings.tooth,8,6);yield;}}
    if(mood===3){for(const sign of [-1,1]){face.tube(bezier([sign*86,122,66],[sign*92,128,64],[sign*87,134,62],[sign*93,140,58]),()=>2.2,0xff75ba,0xffadcf,6,8);yield;}}
    expressions['expression'+mood]=yield* face.finish();
  }
  body.ellipsoid([0,80,83*head],[9,6,6],style.light,14,8);yield;
  if(final){body.ellipsoid([0,151,58],[13,18,7],style.cheek,16,12);yield;body.ellipsoid([0,154,64],[5,8,2],settings.glint,8,6);yield;}
  const length=style.tentacleLength,path=t=>{const x=75+141*t-42*t*t*t,y=-12*Math.sin(t*Math.PI)+70*Math.pow(t,3);return [x*length,y,7*Math.sin(t*Math.PI)];};
  arm.tube(path,t=>Math.max(1.2,23*Math.pow(1-t,.72)),style.skin,style.light,settings.tubeSides,settings.tubeSteps);yield;
  for(const t of [.29,.45,.61,.77]){const p=path(t),size=7.4*(1-t)+2;arm.ellipsoid([p[0],p[1],p[2]+19*(1-t)],[size,size*.8,3.6],style.cheek,12,8);yield;arm.ellipsoid([p[0],p[1],p[2]+19*(1-t)+3],[size*.45,size*.36,1],style.dark,10,6);yield;}
  return {core:(yield* body.finish()),tentacle:(yield* arm.finish()),...expressions};
}
// 普通题与选择题复用同一准备队列；上颚、下颚和卷选项的触手分别恢复为可复用部件。
function* targetFace(surface,settings,style,octopus=false){
  const segments=28,rows=18;
  surface.ellipsoid([0,octopus?42:39,-12],octopus?[76,65,54]:[184,72,48],style.skin,segments,rows);yield;
  if(!octopus){surface.ellipsoid([0,-20,29],[166,53,22],style.dark,20,12);yield;}
  for(const sign of [-1,1]){
    surface.ellipsoid([sign*(octopus?30:56),octopus?56:65,48],[23,27,13],settings.eyes,18,12);yield;
    surface.ellipsoid([sign*(octopus?30:56),octopus?55:64,60],[11,18,6],style.dark,14,10);yield;
    surface.ellipsoid([sign*(octopus?30:56)-5,octopus?63:72,65],[5,6,2],settings.glint,10,8);yield;
    surface.ellipsoid([sign*(octopus?53:100),octopus?29:38,37],[13,7,4],style.cheek,12,8);yield;
    const eyeX=sign*(octopus?30:56),eyeY=octopus?56:65;
    surface.tube(bezier([eyeX+sign*23,eyeY+25,57],[eyeX+sign*12,eyeY+27,65],[eyeX-sign*8,eyeY+14,67],[eyeX-sign*20,eyeY+12,64]),t=>4.5-t,style.dark,style.dark,8,10);yield;
    // 小獠牙、上挑眼角与额甲保留圆润轮廓，增加淘气的攻击性。
    surface.tube(bezier([sign*(octopus?47:108),octopus?94:96,-5],[sign*(octopus?70:125),octopus?121:119,4],[sign*(octopus?65:118),octopus?128:125,14],[sign*(octopus?54:109),octopus?122:120,20]),t=>10*(1-t)+.4,style.light,settings.tooth,8,12);yield;
    for(let i=0;i<3;i++){surface.ellipsoid([sign*((octopus?51:119)+i*10),octopus?65-i*9:54-i*8,30],[4,5,2],style.light,8,6);yield;}
    if(!octopus){
      surface.tube(bezier([sign*133,84,-9],[sign*147,106,-7],[sign*151,120,-1],[sign*139,119,4]),t=>12*(1-t)+.5,style.light,settings.tooth,8,12);yield;
      for(const x of [180,196]){surface.tube(bezier([sign*x,2,47],[sign*x,-9,53],[sign*(x-4),-17,54],[sign*(x-7),-21,51]),t=>8*(1-t)+.5,settings.tooth,settings.tooth,8,8);yield;}
    }
  }
  if(octopus){
    surface.ellipsoid([0,24,47],[24,13,7],style.dark,18,10,.16);yield;
    surface.ellipsoid([3,18,54],[10,4,2],settings.tongue,10,8);yield;
    for(const sign of [-1,1]){surface.tube(bezier([sign*15,33,54],[sign*16,29,58],[sign*12,21,59],[sign*10,19,56]),t=>4*(1-t)+.3,settings.tooth,settings.tooth,8,8);yield;}
    surface.ellipsoid([0,96,37],[10,14,4],style.light,12,8);yield;
  }
}
function* bitingTarget(settings,enemy=false){
  const style=settings.targets[enemy?'enemy':'word'],body=new Surface(),jaw=new Surface();
  yield* targetFace(body,settings,style);
  jaw.ellipsoid([0,-4,0],[180,20,36],style.light,20,12);yield;
  for(const sign of [-1,1])for(const x of [180,196]){jaw.tube(bezier([sign*x,4,30],[sign*x,13,35],[sign*(x-2),20,36],[sign*(x-4),22,34]),t=>7*(1-t)+.5,settings.tooth,settings.tooth,8,8);yield;}
  return {core:(yield* body.finish()),tentacle:(yield* jaw.finish())};
}
function* octopusTarget(settings){
  const style=settings.targets.octopus,body=new Surface(),arms=[];
  yield* targetFace(body,settings,style,true);
  // 五根背景触手加三根卷选项的主触手，形成清楚的八爪轮廓。
  for(let i=0;i<5;i++){
    const angle=Math.PI*.12+i*Math.PI*.19,sign=i<2?-1:1,x=(i-2)*60;
    body.tube(bezier([x*.18,8,-45],[x*.5,45,-42],[x+sign*45,15+Math.sin(angle)*30,-30],[x+sign*30,57+Math.sin(angle)*25,-20]),t=>15*Math.pow(1-t,.65)+1,style.skin,style.light,8,18);yield;
  }
  for(let i=0;i<3;i++){
    const arm=new Surface(),center=(i-1)*240,stem=bezier([(i-1)*24,3,-40],[center*.6,-36,-36],[center+116,-78,-16],[center+108,-154,5]);
    const path=t=>t<.55?stem(t/.55):[center+108*Math.cos(-(t-.55)/.45*Math.PI*.94),-154+64*Math.sin(-(t-.55)/.45*Math.PI*.94),5+10*Math.sin((t-.55)/.45*Math.PI)];
    arm.tube(path,t=>27-11*t,style.skin,style.light,10,36);yield;
    for(const t of [.62,.72,.82,.92]){const point=path(t);arm.ellipsoid([point[0],point[1],point[2]+16],[8,6,3],style.cheek,10,6);yield;}
    arms.push(yield* arm.finish());
  }
  return {core:(yield* body.finish()),left:arms[0],middle:arms[1],right:arms[2]};
}
export function* bossModelTasks(settings){
  const mini=yield* variant(settings,false),final=yield* variant(settings,true),spelling=yield* bitingTarget(settings),enemy=yield* bitingTarget(settings,true),choice=yield* octopusTarget(settings);
  return {mini,final,spelling,enemy,choice};
}
export function generateBossModels(settings){const tasks=bossModelTasks(settings);let step;do{step=tasks.next();}while(!step.done);return step.value;}
export function validBossModels(data){
  const required={mini:['core','tentacle','expression0','expression1','expression2','expression3'],final:['core','tentacle','expression0','expression1','expression2','expression3'],spelling:['core','tentacle'],enemy:['core','tentacle'],choice:['core','left','middle','right']};
  return Object.entries(required).every(([kind,parts])=>parts.every(part=>{const g=data?.[kind]?.[part];return g?.positions instanceof Float32Array&&g.positions.length>0&&g.positions.length%3===0&&(g.indices instanceof Uint16Array||g.indices instanceof Uint32Array)&&g.indices.length>0&&g.indices.length%3===0&&g.indices.every(index=>index<g.positions.length/3)&&g.normals instanceof Float32Array&&g.normals.length===g.positions.length&&g.colors instanceof Float32Array&&g.colors.length===g.positions.length&&g.positions.every(Number.isFinite)&&g.normals.every(Number.isFinite)&&g.colors.every(v=>Number.isFinite(v)&&v>=0&&v<=1);}));
}
