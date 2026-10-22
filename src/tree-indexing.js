import * as THREE from 'three';

// 仅在准备队列执行；按Float32位模式合并完全相同的顶点，不做有误差的按位置焊接。
export function* indexTreeGeometry(source){
  const attributes=Object.entries(source.attributes),count=source.attributes.position.count;
  const bits=attributes.map(([,a])=>new Uint32Array(a.array.buffer,a.array.byteOffset,a.array.length));
  const unique=[],lookup=new Map(),remap=new Uint32Array(count);
  for(let i=0;i<count;i++){
    let key='';
    for(let a=0;a<attributes.length;a++)for(let c=0;c<attributes[a][1].itemSize;c++)key+=bits[a][i*attributes[a][1].itemSize+c]+',';
    let index=lookup.get(key);
    if(index===undefined){index=unique.length;lookup.set(key,index);unique.push(i);}
    remap[i]=index;if(i%128===0)yield;
  }
  // 已有近模索引保留原三角形顺序；非索引输入按原顶点顺序建立索引。
  const sourceIndex=source.index?.array,indices=new Uint32Array(sourceIndex?.length??count);
  for(let i=0;i<indices.length;i++){indices[i]=remap[sourceIndex?sourceIndex[i]:i];if(i%128===0)yield;}
  const geometry=new THREE.BufferGeometry();
  for(const [name,attribute]of attributes){
    const data=new Float32Array(unique.length*attribute.itemSize);
    for(let i=0;i<unique.length;i++){const offset=unique[i]*attribute.itemSize;data.set(attribute.array.subarray(offset,offset+attribute.itemSize),i*attribute.itemSize);if(i%128===0)yield;}
    geometry.setAttribute(name,new THREE.BufferAttribute(data,attribute.itemSize,attribute.normalized));
  }
  geometry.setIndex(new THREE.BufferAttribute(unique.length<=65535?new Uint16Array(indices):indices,1));
  source.dispose();return geometry;
}
