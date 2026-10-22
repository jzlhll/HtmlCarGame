import { createRandom } from './random.js';

// 大洲外形采用项目自绘的简化经纬轮廓，纹理仅用于太空背景。
const CONTINENTS = [
  [[-168,72],[-145,70],[-132,56],[-125,49],[-123,39],[-112,29],[-100,18],[-88,20],[-79,9],[-77,25],[-65,45],[-53,49],[-62,61],[-94,77],[-125,74]],
  [[-81,12],[-67,10],[-51,1],[-36,-8],[-43,-24],[-55,-35],[-68,-55],[-75,-45],[-78,-21]],
  [[-12,36],[-9,45],[0,52],[5,59],[22,71],[43,69],[62,74],[96,77],[133,68],[170,62],[178,48],[153,45],[139,34],[121,26],[110,17],[106,3],[97,7],[89,22],[77,8],[67,26],[52,28],[43,12],[35,30],[26,36],[14,40],[3,36]],
  [[-17,35],[2,37],[15,33],[33,31],[42,13],[51,11],[42,-7],[34,-24],[20,-35],[10,-20],[1,-5],[-12,6],[-17,20]],
  [[113,-12],[130,-11],[141,-18],[153,-27],[146,-39],[130,-34],[115,-24]],
  [[-54,60],[-44,61],[-21,77],[-30,84],[-52,81],[-65,69]],
  [[47,-13],[51,-15],[49,-25],[44,-26]],
  [[130,31],[142,46],[146,43],[140,34]],
  [[166,-34],[178,-40],[171,-47],[166,-44]]
];
const LAND_REGIONS = CONTINENTS.map(points=>({points,minX:Math.min(...points.map(p=>p[0])),maxX:Math.max(...points.map(p=>p[0])),minY:Math.min(...points.map(p=>p[1])),maxY:Math.max(...points.map(p=>p[1]))}));
function landAt(lon,lat){
  for(const region of LAND_REGIONS){
    if(lon<region.minX||lon>region.maxX||lat<region.minY||lat>region.maxY)continue;
    let inside=false;
    for(let i=0,j=region.points.length-1;i<region.points.length;j=i++){
      const [x,y]=region.points[i],[px,py]=region.points[j];
      if((y>lat)!==(py>lat)&&lon<(px-x)*(lat-y)/(py-y)+x)inside=!inside;
    }
    if(inside)return true;
  }
  return false;
}
function earthPixels(width,height){
  const mask=new Uint8Array(width*height),rgba=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const lon=x/width*360-180,lat=y/(height-1)*180-90;
    mask[y*width+x]=landAt(lon+Math.sin(lat*.43)*.65,lat+Math.sin(lon*.29)*.45)?1:0;
  }
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const index=y*width+x,lon=x/width*360-180,lat=y/(height-1)*180-90;
    const terrain=(Math.sin(lon*.39+lat*.51)+Math.sin(lon*.83-lat*.21))*.5;
    const neighbor=(dx,dy)=>mask[Math.max(0,Math.min(height-1,y+dy))*width+(x+dx+width)%width];
    let color;
    if(mask[index]){
      const coast=!neighbor(1,0)||!neighbor(-1,0)||!neighbor(0,1)||!neighbor(0,-1);
      const desert=lat>14&&lat<33&&lon>-18&&lon<66;
      color=coast?[139,173,111]:desert?[175+terrain*17,153+terrain*14,99+terrain*10]:[36+terrain*11,102+terrain*16,67+terrain*10];
    }else{
      const shelf=neighbor(2,0)||neighbor(-2,0)||neighbor(0,2)||neighbor(0,-2);
      color=shelf?[20,131,164]:[9+terrain*4,65+terrain*9,143+terrain*14];
    }
    const ice=Math.max(0,Math.min(1,(Math.abs(lat)-69+Math.sin(lon*.11)*3)/10));
    const cloudField=Math.sin(lon*.17+Math.sin(lat*.15)*2.8)+.6*Math.sin(lon*.33-lat*.22);
    const clouds=Math.max(0,Math.min(.68,(cloudField-.88)*.7))*(Math.abs(lat)<72?1:.3);
    for(let c=0;c<3;c++){let value=color[c]*(1-ice)+[222,237,242][c]*ice;rgba[index*4+c]=value*(1-clouds)+[240,247,252][c]*clouds;}
    rgba[index*4+3]=255;
  }
  return rgba;
}
// 月海与球面环形坑都在准备阶段烘焙，运行时不增加几何。
function moonPixels(width,height,random){
  const craters=Array.from({length:46},()=>{const lon=random()*Math.PI*2,z=random()*2-1,r=Math.sqrt(1-z*z),radius=.025+random()*.13;return {x:r*Math.cos(lon),y:z,z:r*Math.sin(lon),radius:1-Math.cos(radius)};});
  const rgba=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const lon=x/width*Math.PI*2,lat=(y/(height-1)-.5)*Math.PI,px=Math.cos(lat)*Math.cos(lon),py=Math.sin(lat),pz=Math.cos(lat)*Math.sin(lon);
    const maria=Math.sin(px*5+pz*3)+.6*Math.sin(py*7-pz*4)+.35*Math.sin(px*11+py*8);
    let shade=174+Math.sin(px*59+py*41+pz*37)*5+random()*7-Math.max(0,maria-.2)*30;
    for(const crater of craters){const distance=(1-px*crater.x-py*crater.y-pz*crater.z)/crater.radius;if(distance<1.4){const rim=Math.exp(-Math.pow((distance-1)*6,2))*29,bowl=Math.max(0,1-distance)*31;shade+=rim-bowl+(px-crater.x)*95*Math.max(0,1-distance);}}
    const i=(y*width+x)*4;rgba[i]=shade;rgba[i+1]=shade*.99;rgba[i+2]=shade*.96;rgba[i+3]=255;
  }
  return rgba;
}
function sunPixels(width,height){
  const rgba=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const lon=x/width*Math.PI*2,lat=(y/(height-1)-.5)*Math.PI,px=Math.cos(lat)*Math.cos(lon),py=Math.sin(lat),pz=Math.cos(lat)*Math.sin(lon);
    const flow=Math.sin(px*19+Math.sin(py*11)*1.4)+Math.sin(py*23+pz*17)+.45*Math.sin(px*73+py*91+pz*53);
    const grain=(Math.sin(px*181+py*137)*Math.sin(pz*167-py*113)+1)*.5;
    const heat=Math.max(0,Math.min(1,.56+flow*.13+grain*.14));
    const spots=Math.max(0,Math.sin(px*12+py*8)+Math.sin(pz*13-py*6)-1.88)*1.8;
    const i=(y*width+x)*4;rgba[i]=238+heat*17-spots*55;rgba[i+1]=103+heat*99-spots*78;rgba[i+2]=22+heat*40;rgba[i+3]=255;
  }
  return rgba;
}
export function generateAssets(settings){
  const random=createRandom(settings.seed),stars=new Float32Array(settings.stars*4);
  for(let i=0;i<settings.stars;i++){
    stars[i*4]=(random()-.5)*3600;stars[i*4+1]=(random()-.5)*settings.starTravel;
    stars[i*4+2]=random();
    stars[i*4+3]=i<settings.largeGlows?9+random()*6:i<settings.largeGlows+settings.glowStars?3.5+random()*4.5:.8+random()*1.9;
  }
  const galaxy=new Float32Array(settings.galaxyStars*7);
  for(let i=0;i<settings.galaxyStars;i++){
    const radius=Math.pow(random(),.7),arm=i%4,scatter=(random()-.5)*(.24+radius*.6);
    const angle=arm*Math.PI/2+radius*5.5+scatter,distance=radius*settings.galaxySourceRadius;
    galaxy[i*7]=Math.cos(angle)*distance;galaxy[i*7+1]=Math.sin(angle)*distance;
    galaxy[i*7+2]=(random()-.5)*35*(1-radius);
    const core=Math.pow(1-radius,3);
    galaxy[i*7+3]=.38+core*.58+random()*.12;
    galaxy[i*7+4]=.48+core*.42+random()*.10;
    galaxy[i*7+5]=.76+core*.18;
    galaxy[i*7+6]=.8+random()*1.8+core*1.6;
  }
  const vertices=[],normals=[],uvs=[],sphereSegments=48,sphereRows=24;
  const point=(u,v)=>{const a=u*Math.PI*2,b=v*Math.PI;return [Math.sin(b)*Math.cos(a),Math.cos(b),Math.sin(b)*Math.sin(a)];};
  for(let y=0;y<sphereRows;y++)for(let x=0;x<sphereSegments;x++){
    const u=x/sphereSegments,v=y/sphereRows,du=1/sphereSegments,dv=1/sphereRows;
    for(const [a,b] of [[u,v],[u+du,v],[u,v+dv],[u+du,v],[u+du,v+dv],[u,v+dv]]){const p=point(a,b);vertices.push(...p);normals.push(...p);uvs.push(a,1-b);}
  }
  const hull=[],hullNormals=[];
  const polygon=[[-10,48],[10,48],[13,9],[54,-18],[54,-26],[12,-16],[14,-42],[25,-50],[-25,-50],[-14,-42],[-12,-16],[-54,-26],[-54,-18],[-13,9]];
  const tri=(a,b,c)=>{const ab=b.map((v,i)=>v-a[i]),ac=c.map((v,i)=>v-a[i]),n=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]],length=Math.hypot(...n)||1;hull.push(...a,...b,...c);for(let i=0;i<3;i++)hullNormals.push(...n.map(v=>v/length));};
  for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length];tri([0,0,6],[...b,6],[...a,6]);tri([...a,-6],[...a,6],[...b,6]);tri([...a,-6],[...b,6],[...b,-6]);}
  const pixels=[],palettes=[[134,124,112],[209,162,87],[43,131,168],[184,81,53],[192,148,111],[206,177,124],[115,196,200],[60,100,185],[151,139,153]];
  for(let planet=0;planet<9;planet++){
    if(planet===2){pixels.push(earthPixels(settings.textureWidth,settings.textureHeight));continue;}
    const rgba=new Uint8Array(settings.textureWidth*settings.textureHeight*4),base=palettes[planet];
    for(let y=0;y<settings.textureHeight;y++)for(let x=0;x<settings.textureWidth;x++){
      let band=.87+.06*Math.sin(y*.14+planet)+random()*.06;
      if(planet===4||planet===5)band=.78+.17*Math.sin(y*.24)+.06*Math.sin(y*.67)+random()*.04;
      for(let c=0;c<3;c++)rgba[(y*settings.textureWidth+x)*4+c]=base[c]*band;
      rgba[(y*settings.textureWidth+x)*4+3]=255;
    }
    pixels.push(rgba);
  }
  pixels.push(moonPixels(settings.textureWidth,settings.textureHeight,createRandom(settings.seed^0x4D4F4F4E)),sunPixels(settings.textureWidth,settings.textureHeight));
  const plan=settings.models.map((model,i)=>({
    planet:i,x:(i%2===0?-1:1)*(.24+random()*.15),scale:model.radius,tilt:random()*.5
  }));
  const constellations=settings.constellations.map(chart=>{
    const radius=settings.models.find(model=>model.kind===chart.kind).radius;
    const positions=new Float32Array(chart.stars.length*3),sizes=new Float32Array(chart.stars.length),lines=new Float32Array(chart.links.length*6);
    chart.stars.forEach(([x,y,size],i)=>{positions.set([x*radius,y*radius,0],i*3);sizes[i]=size*settings.constellationStarSize;});
    chart.links.forEach(([a,b],i)=>{lines.set(positions.subarray(a*3,a*3+3),i*6);lines.set(positions.subarray(b*3,b*3+3),i*6+3);});
    return {kind:chart.kind,positions,sizes,lines};
  });
  // 航母船体、甲板、舰岛和跑道合并为一份顶点色几何，游玩只复用实例。
  const carrierPositions=[],carrierNormals=[],carrierColors=[],palette=settings.carrier.palette.map(hex=>[(hex>>16&255)/255,(hex>>8&255)/255,(hex&255)/255]);
  const carrierTriangle=(a,b,c,color)=>{const ab=b.map((v,i)=>v-a[i]),ac=c.map((v,i)=>v-a[i]),n=[ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]],length=Math.hypot(...n)||1;carrierPositions.push(...a,...b,...c);for(let i=0;i<3;i++){carrierNormals.push(...n.map(v=>v/length));carrierColors.push(...palette[color]);}};
  const carrierBox=(x,y,z,w,h,d,color)=>{const points=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(([a,b,c])=>[x+a*w/2,y+b*h/2,z+c*d/2]);for(const [a,b,c,d] of [[0,3,2,1],[4,5,6,7],[0,1,5,4],[3,7,6,2],[0,4,7,3],[1,2,6,5]]){carrierTriangle(points[a],points[b],points[c],color);carrierTriangle(points[a],points[c],points[d],color);}};
  const outline=[[-.46,.5],[.43,.5],[.5,.36],[.5,-.32],[.32,-.5],[-.32,-.5],[-.5,-.32],[-.5,.35]];
  for(let i=0;i<outline.length;i++){const a=outline[i],b=outline[(i+1)%outline.length];carrierTriangle([0,0,.15],[...b,.15],[...a,.15],1);carrierTriangle([...a,-.5],[...a,.15],[...b,.15],0);carrierTriangle([...a,-.5],[...b,.15],[...b,-.5],0);}
  carrierBox(.44,.15,.43,.06,.38,.56,2);carrierBox(.445,.21,.77,.07,.20,.12,0);carrierBox(.445,.21,.85,.075,.11,.06,3);
  for(const x of [-.45,.35])carrierBox(x,0,.17,.006,.82,.025,2);
  for(let i=0;i<9;i++)carrierBox(-.36,-.36+i*.09,.18,.012,.045,.025,2);
  for(let i=0;i<4;i++)carrierBox(-.03+i*.07,.44,.18,.035,.025,.025,2);
  const carrier={positions:new Float32Array(carrierPositions),normals:new Float32Array(carrierNormals),colors:new Float32Array(carrierColors)};
  const monsterPositions=new Float32Array(vertices.length);
  for(let i=0;i<vertices.length;i+=3){const x=vertices[i],y=vertices[i+1],z=vertices[i+2],spike=1+.12*Math.cos(Math.atan2(z,x)*7)*(1-y*y);monsterPositions[i]=x*spike;monsterPositions[i+1]=y*spike;monsterPositions[i+2]=z*spike;}
  return {stars,galaxy,constellations,carrier,monster:{positions:monsterPositions,normals:new Float32Array(normals)},sphere:{positions:new Float32Array(vertices),normals:new Float32Array(normals),uvs:new Float32Array(uvs)},ship:{positions:new Float32Array(hull),normals:new Float32Array(hullNormals)},pixels,plan};
}
if(typeof WorkerGlobalScope!=='undefined'&&self instanceof WorkerGlobalScope)self.onmessage=event=>{
  try{const data=generateAssets(event.data),transfer=[data.carrier.positions.buffer,data.carrier.normals.buffer,data.carrier.colors.buffer,data.stars.buffer,data.galaxy.buffer,data.monster.positions.buffer,data.monster.normals.buffer,data.sphere.positions.buffer,data.sphere.normals.buffer,data.sphere.uvs.buffer,data.ship.positions.buffer,data.ship.normals.buffer,...data.pixels.map(p=>p.buffer),...data.constellations.flatMap(chart=>[chart.positions.buffer,chart.sizes.buffer,chart.lines.buffer])];self.postMessage({data},transfer);}
  catch(error){self.postMessage({error:String(error)});}
};
