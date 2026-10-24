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
