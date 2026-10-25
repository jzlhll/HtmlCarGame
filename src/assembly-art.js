import { ASSEMBLY } from './config.js';

// 共用矢量岩体与刻面，字母和点击区域不随装饰转动。
const outlines=[
  'M23 9 50 4 78 11 103 25 115 47 107 71 86 91 57 96 29 87 9 68 5 43Z',
  'M28 7 59 5 87 16 108 37 114 63 95 84 67 96 39 91 15 78 5 53 12 27Z',
  'M15 24 37 8 68 5 94 18 113 42 109 70 87 89 58 95 27 87 8 65 5 42Z',
  'M29 8 62 4 90 17 110 38 115 61 97 81 72 96 42 93 17 80 6 58 10 31Z'
];
export function rockDefinitions(){
  return '<svg class="assembly-art-defs" aria-hidden="true" focusable="false"><defs><linearGradient id="assembly-rock-body" x1="15%" y1="0" x2="85%" y2="100%"><stop stop-color="#667082"/><stop offset=".36" stop-color="#39475b"/><stop offset=".7" stop-color="#25334a"/><stop offset="1" stop-color="#121e30"/></linearGradient><radialGradient id="assembly-crater"><stop stop-color="#0d1727" stop-opacity=".78"/><stop offset=".68" stop-color="#18253a" stop-opacity=".6"/><stop offset="1" stop-color="#a2afbf" stop-opacity=".17"/></radialGradient>'+outlines.map((path,index)=>'<symbol id="assembly-rock-'+index+'" viewBox="0 0 120 100"><path d="'+path+'" fill="url(#assembly-rock-body)" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M23 9 50 4 63 30 36 48 9 38Z" fill="#b6c5d0" opacity=".13"/><path d="M63 30 103 25 115 47 81 58Z" fill="#a3bac8" opacity=".08"/><path d="M36 48 63 30 81 58 62 87 29 87Z" fill="#0a182d" opacity=".18"/><path d="M81 58 107 71 86 91 62 87Z" fill="#080f22" opacity=".23"/><ellipse cx="'+(25+index*5)+'" cy="27" rx="11" ry="8" fill="url(#assembly-crater)" transform="rotate(-23 32 27)"/><ellipse cx="83" cy="69" rx="13" ry="10" fill="url(#assembly-crater)"/><ellipse cx="86" cy="30" rx="5" ry="4" fill="url(#assembly-crater)"/><ellipse cx="31" cy="71" rx="5" ry="3.5" fill="url(#assembly-crater)"/><path d="M19 47 34 42 41 50 54 45M71 14 67 25 76 36M64 80 74 75 85 80" fill="none" stroke="#a5b2c2" stroke-width=".8" opacity=".2"/><path d="M12 42 18 29 31 17M95 81 82 90 70 93" fill="none" stroke="#d1dbe3" stroke-width="1.3" opacity=".25"/></symbol>').join('')+'</defs></svg>';
}
export function rockSprite(index,kind){
  const [minimum,maximum]=ASSEMBLY.visuals.turnSeconds,seconds=minimum+(index*17)%(maximum-minimum+1),angle=kind==='meteor'?index*43%360:(index%5-2)*3;
  return '<span class="'+(kind==='meteor'?'meteor-rock':'fragment-rock')+'" aria-hidden="true" style="--rock-turn:'+seconds+'s;--rock-delay:-'+(index*7%seconds)+'s;--rock-direction:'+(index%2?'reverse':'normal')+';--rock-angle:'+angle+'deg"><svg class="rock-art" viewBox="0 0 120 100" focusable="false"><use href="#assembly-rock-'+index%outlines.length+'"/></svg></span>';
}

// 舰载机、航标与残片均为共享矢量原型，不加载外部模型。
export function flightSprite(kind='fighter'){
  const shape=kind==='beacon'?'<ellipse cx="60" cy="48" rx="44" ry="29" fill="#091c32" stroke="#82d9c5" stroke-width="3"/><ellipse cx="60" cy="48" rx="34" ry="22" fill="none" stroke="#417e91" stroke-dasharray="8 5" stroke-width="2"/><path d="M10 48h16m68 0h16M60 10v17m0 42v17" stroke="#b4fbe1" stroke-width="4"/><path d="M52 43l8-8 8 8-8 15Z" fill="#89e8dc"/>':kind==='hangar'?'<path d="M14 16 94 9 111 28 107 79 91 92 18 87 5 66 7 31Z" fill="#1b344a" stroke="#86b5c2" stroke-width="2"/><path d="M20 24 90 20 99 33 96 75 24 78 16 65Z" fill="#0a1729" stroke="#36596b" stroke-width="2"/><path d="M28 30h53M28 69h53M21 37v25m70-25v25" stroke="#72dbc6" stroke-width="2"/><path d="M96 16v12m5 8v21M14 30v27" stroke="#edbb7d" stroke-width="3"/>':'<path d="M51 77 47 99 60 88 73 99 69 77" fill="#48d6e6" opacity=".6"/><path d="M60 4 69 17 73 40 110 65 107 75 73 66 77 85 60 79 43 85 47 66 13 75 10 65 47 40 51 17Z" fill="#aec9db" stroke="#e3f2f6" stroke-width="1.5"/><path d="M60 9 66 25 66 58 60 65 54 58 54 25Z" fill="#19324d"/><path d="M60 18 64 29 64 43 56 43 56 29Z" fill="#65cce1"/><path d="M20 67 45 54m55 13L75 54M51 71h18" stroke="#5d829a" stroke-width="3"/><path d="M38 66v9m44-9v9" stroke="#9df8df" stroke-width="3"/>';
  return '<svg class="flight-art '+kind+'-art" viewBox="0 0 120 100" aria-hidden="true" focusable="false">'+shape+'</svg>';
}
export function salvageSprite(index){
  return '<span class="fragment-rock salvage-metal" style="--rock-turn:'+(58+index%7*5)+'s;--rock-delay:-'+index+'s;--rock-angle:'+((index%5-2)*3)+'deg" aria-hidden="true"><svg class="rock-art" viewBox="0 0 120 100"><path d="'+outlines[index%4]+'" fill="#29465d" stroke="#82b4c6" stroke-width="2"/><path d="M23 9 50 4 63 30 36 48 9 38Z" fill="#a5cad6" opacity=".3"/><path d="M36 48 63 30 103 25M36 48 29 87M63 30 62 87 86 91" stroke="#9bb3bd" opacity=".35" fill="none"/><path d="M22 70h18m38-45h14m-8 53h12" stroke="#9bf5da" stroke-width="2"/><circle cx="25" cy="24" r="3" fill="#f3cc92"/><circle cx="91" cy="67" r="3" fill="#c3dfdf"/></svg></span>';
}
