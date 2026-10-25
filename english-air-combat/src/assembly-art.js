import { ASSEMBLY } from './config.js';
import { createRandom } from './random.js';

// 共用矢量岩体与刻面，字母和点击区域不随装饰转动。
const outlines=[
  'M23 9 50 4 78 11 103 25 115 47 107 71 86 91 57 96 29 87 9 68 5 43Z',
  'M28 7 59 5 87 16 108 37 114 63 95 84 67 96 39 91 15 78 5 53 12 27Z',
  'M15 24 37 8 68 5 94 18 113 42 109 70 87 89 58 95 27 87 8 65 5 42Z',
  'M29 8 62 4 90 17 110 38 115 61 97 81 72 96 42 93 17 80 6 58 10 31Z'
];
// 三套邪恶战机共用固定矢量皮肤，四轮题面在开局预建。
export function evilSprite(skin=0){
  const bodies=[
    '<path d="M60 8 76 31 79 42 112 57 104 76 78 68 72 91 60 82 48 91 42 68 16 76 8 57 41 42 44 31Z" fill="var(--enemy-body)" stroke="var(--enemy-edge)" stroke-width="2"/><path d="m38 44-15-23 28 14m31 9 15-23-28 14" fill="var(--enemy-edge)"/>',
    '<path d="m60 9 19 22 9 12 28-9-8 34-24 5-11 19-13-10-13 10-11-19-24-5-8-34 28 9 9-12Z" fill="var(--enemy-body)" stroke="var(--enemy-edge)" stroke-width="2"/><path d="m20 43 24 9-5 13-18-6m79-16-24 9 5 13 18-6" fill="#151b34"/>',
    '<path d="M60 6 81 33 110 43 114 64 85 78 73 76 60 96 47 76 35 78 6 64 10 43 39 33Z" fill="var(--enemy-body)" stroke="var(--enemy-edge)" stroke-width="2"/><path d="m13 50 24-7-5 23-18-5m93-11-24-7 5 23 18-5" fill="var(--enemy-edge)"/>'
  ];
  return '<svg class="evil-art skin-'+skin+'" viewBox="0 0 120 104" aria-hidden="true" focusable="false">'+bodies[skin]+'<path d="m42 41 14 7-11 10-8-8m41-9-14 7 11 10 8-8" fill="#fff0bd"/><path d="m40 38 17 5m23-5-17 5" stroke="#180e27" stroke-width="5" stroke-linecap="round"/><path d="M43 65q17 14 34 0l-8 2-3 8-5-7-5 7-5-8Z" fill="#191526"/><path d="m53 21 7-8 7 8-7 9Z" fill="var(--enemy-edge)"/></svg>';
}
export function machineSprite(cannon=false){
  return '<svg class="machine-art" viewBox="0 0 140 94" aria-hidden="true" focusable="false">'+(cannon?'<path d="M59 59 62 9h16l3 50" fill="#86b9c9" stroke="#d5edf1" stroke-width="2"/><path d="M64 5h12v14H64Z" fill="#263d52"/><circle cx="70" cy="61" r="25" fill="#29465f" stroke="#88bbc9" stroke-width="3"/><circle cx="70" cy="61" r="10" fill="#a9e3ec"/>':'<path d="m31 18 18 22h42l18-22 15 10-24 32H40L16 28Z" fill="#4a7890" stroke="#a7dbe5" stroke-width="2"/><path d="M46 42h48v23H46Z" fill="#a9dcdf"/><path d="M52 48h36v10H52Z" fill="#15344b"/>')+'<path d="m33 64 14-12h46l14 12 7 20H26Z" fill="#233c54" stroke="#7098ae" stroke-width="2"/><path d="M18 78h104v10H18Z" fill="#14293e" stroke="#779bad" stroke-width="2"/><circle cx="39" cy="82" r="5" fill="#9bd5e0"/><circle cx="101" cy="82" r="5" fill="#9bd5e0"/></svg>';
}
export function salvageSprite(index){
  const [minimum,maximum]=ASSEMBLY.visuals.turnSeconds,seconds=minimum+index*17%(maximum-minimum+1);
  return '<span class="fragment-rock salvage-metal" style="--rock-turn:'+seconds+'s;--rock-delay:-'+(index*7%seconds)+'s;--rock-direction:'+(index%2?'reverse':'normal')+';--rock-angle:'+((index%5-2)*3)+'deg" aria-hidden="true"><svg class="rock-art" viewBox="0 0 120 100"><path d="'+outlines[index%4]+'" fill="#29465d" stroke="#82b4c6" stroke-width="2"/><path d="M23 9 50 4 63 30 36 48 9 38Z" fill="#a5cad6" opacity=".3"/><path d="M36 48 63 30 103 25M36 48 29 87M63 30 62 87 86 91" stroke="#9bb3bd" opacity=".35" fill="none"/><path d="M22 70h18m38-45h14m-8 53h12" stroke="#9bf5da" stroke-width="2"/><circle cx="25" cy="24" r="3" fill="#f3cc92"/><circle cx="91" cy="67" r="3" fill="#c3dfdf"/></svg></span>';
}

// 星球、裂隙、喷流和表面碎块只在开局构造，动画共享父级时间参数。
export function novaSprite(seed,hue){
  const random=createRandom(seed^0x42555253),{sparks,debris}=ASSEMBLY.visuals.nova;
  const rays=Array.from({length:sparks},(_,index)=>'<i class="nova-spark" style="--angle:'+(index*360/sparks+random()*5)+'deg;--travel:'+(random()*.7+.3)+';--length:'+(8+random()*28)+'px;--fade:'+(random()*.6+.4)+'"></i>').join('');
  const chunks=Array.from({length:debris},(_,index)=>{const angle=index*Math.PI*2/debris+random()*.18;return '<i class="nova-debris" style="--dx:'+Math.cos(angle)+';--dy:'+Math.sin(angle)+';--travel:'+(random()*.6+.22)+';--spin:'+(random()*650-325)+'deg;--chip:'+(7+random()*17)+'px;--fade:'+(random()*.5+.5)+'"></i>';}).join('');
  return '<div class="nova-event" aria-hidden="true" style="--planet-hue:'+hue+'"><div class="nova-aura"></div><div class="nova-halo"></div><div class="nova-planet"><svg class="nova-fractures" viewBox="0 0 200 200"><path d="M94 0 89 24 110 38 93 68 117 88 108 109 121 133 106 150 110 181 103 200M93 68 62 61 47 83 17 74 0 92M108 109 139 99 150 125 180 119 200 141M110 38 139 31 151 8M47 83 57 115 24 134 0 129M106 150 61 153 45 176 16 181"/></svg></div><div class="nova-ejecta">'+rays+chunks+'</div><div class="nova-core"></div><div class="nova-flare"></div><div class="nova-shockwave shock-one"></div><div class="nova-shockwave shock-two"></div><div class="nova-cloud"></div></div>';
}
