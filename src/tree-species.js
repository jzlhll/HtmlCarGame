import { TREE_MODELS } from './config.js';

// 归一化冠团和枝干路线同时供可见模型与接触检测使用，榕树拱下保留空隙。
export const treeProfiles=TREE_MODELS.species.map((settings,type)=>{
  const leaves=[],branches=[],roots=[];
  const leaf=(x,y,z,rx,ry,rz=rx)=>leaves.push({x,y,z,rx,ry,rz});
  const branch=(points,radius=.025,solid=true)=>{const item={points,radius,solid};branches.push(item);return item;};
  const trunk=(height=.70,radius=.035)=>branch([[0,0,0],[.015,height*.4,0],[0,height,0]],radius);
  if(type===0){
    trunk(.88,.036);
    for(let i=0;i<11;i++){const y=.32+i*.057,a=i*2.399963,r=.11+(1-Math.abs(y-.62)*1.8)*.22;leaf(Math.cos(a)*r*.4,y,Math.sin(a)*r*.4,r,.13,r*.82);if(i%2===0)branch([[0,y-.12,0],[Math.cos(a)*r*.5,y,Math.sin(a)*r*.5]],.012);}
    leaf(0,.91,0,.13,.12);
  }else if(type===1){
    trunk(.55,.07);
    for(let i=0;i<9;i++){
      const a=i*2.399963,r=.24+(i%3)*.10,x=Math.cos(a)*r,z=Math.sin(a)*r;
      leaf(x,.67+(i%3)*.045,z,.23,.16,.21);
      const end=[Math.cos(a)*.52,0,Math.sin(a)*.52];
      branch([[0,.34,0],[x*.55,.58,z*.55],[x*1.25,.51,z*1.25],[end[0],.22,end[2]],end],.026,i%2===0);
      for(let j=0;j<3;j++){
        const u=a+j*.31,rx=x+Math.cos(u)*.08,rz=z+Math.sin(u)*.08;
        roots.push([[rx,.60,rz],[rx+.015,.28,rz-.01],[rx+.025,.025+(j%2)*.07,rz+.015]]);
      }
    }
    leaf(0,.73,0,.28,.19,.27);
  }else if(type===2){
    trunk(.67,.04);
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4,x=Math.cos(a)*.30,z=Math.sin(a)*.30;
      branch([[0,.4,0],[x*.7,.72,z*.7],[x*1.3,.59,z*1.3]],.018);
      leaf(x,.70,z,.23,.16);
      leaf(x*1.32,.47,z*1.32,.12,.25,.12);
      roots.push([[x*1.4,.57,z*1.4],[x*1.52,.35,z*1.52],[x*1.4,.18,z*1.4]]);
    }
    leaf(0,.81,0,.27,.15);
  }else if(type===3){
    trunk(.99,.029);
    for(let row=0;row<6;row++){
      const y=.20+row*.135,r=.46-row*.063;
      for(let j=0;j<5;j++){const a=j*Math.PI*2/5+row*.7;leaf(Math.cos(a)*r*.48,y,Math.sin(a)*r*.48,r*.61,.14,r*.61);}
    }
    leaf(0,.95,0,.09,.10);
  }else if(type===4){
    trunk(.70,.04);
    for(let i=0;i<9;i++){
      const a=i*2.399963,r=.18+(i%3)*.11,x=Math.cos(a)*r,z=Math.sin(a)*r;
      branch([[0,.30,0],[x*.5,.59,z*.5],[x,.75+(i%2)*.12,z]],.017);
      leaf(x,.78+(i%2)*.09,z,.21,.18,.18);
    }
    leaf(0,.87,0,.27,.16);
  }else{
    for(let i=0;i<7;i++){const a=i*2.399963,r=i?.20:0,x=Math.cos(a)*r,z=Math.sin(a)*r;branch([[x*.5,0,z*.5],[x,.40,z]],.025);leaf(x,.39+(i%3)*.09,z,.25,.29,.23);}
  }
  return {...settings,type,leaves,branches,roots};
});

export function branchSamples(branch,steps=8) {
  const points=branch.points,result=[];
  for(let i=0;i<=steps;i++){
    const t=i/steps*(points.length-1),k=Math.min(points.length-2,Math.floor(t)),u=t-k;
    const p0=points[Math.max(0,k-1)],p1=points[k],p2=points[k+1],p3=points[Math.min(points.length-1,k+2)];
    result.push(p1.map((v,axis)=>.5*((2*v)+(-p0[axis]+p2[axis])*u+(2*p0[axis]-5*v+4*p2[axis]-p3[axis])*u*u+(-p0[axis]+3*v-3*p2[axis]+p3[axis])*u*u*u)));
  }
  return result;
}
