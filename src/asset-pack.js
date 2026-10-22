// 仅保存数值和类型信息；运行对象、材质回调及游戏状态不进入发布包。
const types={Float32Array,Uint32Array,Uint16Array,Uint8Array,Int32Array,Int16Array,Int8Array,Uint8ClampedArray,Float64Array};
export function encodeAssetPack(value,{predict=true}={}){
  const buffers=[];let length=0;
  const header=JSON.stringify(value,(key,item)=>{
    if(!ArrayBuffer.isView(item))return item;
    if(!types[item.constructor.name])throw new Error('Unsupported asset array');
    const offset=length;length+=Math.ceil(item.byteLength/8)*8;const prediction=predict?(item.BYTES_PER_ELEMENT>1?item.BYTES_PER_ELEMENT:item instanceof Uint8Array&&(key.includes('/part/')||key==='data')&&item.length%4===0?4:0):0;buffers.push({offset,item,predict:prediction});
    return {$array:item.constructor.name,offset,length:item.length,predict:prediction};
  });
  const json=new TextEncoder().encode(header),start=Math.ceil((12+json.length)/8)*8,bytes=new Uint8Array(start+length),view=new DataView(bytes.buffer);
  view.setUint32(0,0x464c5450);view.setUint32(4,2);view.setUint32(8,json.length);bytes.set(json,12);
  for(const {offset,item,predict}of buffers){
    const raw=new Uint8Array(item.buffer,item.byteOffset,item.byteLength),target=bytes.subarray(start+offset,start+offset+item.byteLength);
    if(!predict){target.set(raw);continue;}
    const count=raw.length/predict;
    for(let c=0;c<predict;c++)for(let i=0;i<count;i++)target[c*count+i]=item.BYTES_PER_ELEMENT===1&&c<3&&c!==1?(raw[i*4+c]-raw[i*4+1]+256)%256:raw[i*predict+c];
  }
  return bytes;
}
export function decodeAssetPack(buffer){
  const view=new DataView(buffer);
  if(view.byteLength<16||view.getUint32(0)!==0x464c5450||![1,2].includes(view.getUint32(4)))throw new Error('Invalid asset pack');
  const size=view.getUint32(8),start=Math.ceil((12+size)/8)*8;
  if(size>view.byteLength-12)throw new Error('Invalid asset metadata');
  return JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,12,size)),(key,item)=>{
    if(!item?.$array)return item;
    const Type=types[item.$array],offset=start+item.offset;
    if(!Type||!Number.isSafeInteger(item.offset)||item.offset<0||item.offset%8||!Number.isSafeInteger(item.length)||item.length<0||offset+item.length*Type.BYTES_PER_ELEMENT>buffer.byteLength)throw new Error('Invalid asset buffer');
    if(!item.predict)return new Type(buffer,offset,item.length);
    const bytes=item.length*Type.BYTES_PER_ELEMENT,raw=new Uint8Array(bytes),source=new Uint8Array(buffer,offset,bytes),count=bytes/item.predict;
    if(![2,4,8].includes(item.predict)||!Number.isInteger(count))throw new Error('Invalid asset predictor');
    for(let c=0;c<item.predict;c++)for(let i=0;i<count;i++)raw[i*item.predict+c]=source[c*count+i];
    if(Type.BYTES_PER_ELEMENT===1)for(let i=0;i<raw.length;i+=4){raw[i]=(raw[i]+raw[i+1])%256;raw[i+2]=(raw[i+2]+raw[i+1])%256;}
    return new Type(raw.buffer);
  });
}
