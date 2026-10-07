// 测试参数覆盖层:URL 查询参数在启动早期覆盖 config.js 白名单配置字段。
// 仅用于 Agent 与人工快速验证随机事件;不带参数时生产默认值原样生效,移除 URL 参数后刷新恢复默认、零持久化。
// 用法:?fast=1 应用一键测试档,或精确覆盖白名单字段,如 ?POLICE.intervalMin=3&WHITE_HORSE.intervalSeconds=8。

export const TEST_OVERRIDES={active:false,keys:[]};

// 白名单开放事件节奏、概率及警车距离、网尺寸等字段，不开放车型尺寸与车辆碰撞阈值。
const WHITELIST={
  POLICE:['intervalMin','intervalMax','spawnAheadMin','spawnAheadMax','keepMin','keepMax','keepGain','chaseRatio','closeRatio','netRange','netInterval','netSizeBase','netSizeGrowth','netSizeMax','netFallBase','netFallGrowth','netFallMax','netKeep','catchSeconds','maxChaseSeconds'],
  WHITE_HORSE:['intervalSeconds','visibleSeconds','rampSeconds','shieldSeconds','shieldBlinkSeconds','recoverySeconds'],
  COW_CROSSING:['minInterval','intervalRange','chance'],
  ROADWORKS:['first','interval','chance'],
  SLOW_TRAFFIC:['firstSeconds','intervalMin','intervalMax','chance'],
  HUNGER:['intervalSeconds'],
  WEATHER:['duration','windDuration','freezeSeconds','intervalMin','intervalMax','firstMin','firstMax'],
  ROAD_FORKS:['chance','minSpan','maxSpan','weatherChance','weatherIntervalMin','weatherIntervalMax'],
  ROAD_INFRASTRUCTURE:['gapMin','gapMax'],
  ROAD_DIFFICULTY:['afterSeconds'],
  SHELL:['startSeconds','intervalMin','intervalMax','fallSeconds','sizeGrowthSeconds'],
};

// fast=1 一键测试档:把分钟级节奏压缩到秒级,便于快速触发警车、白马、天气、分叉候选、炮击等随机事件。
const FAST_PRESET={
  POLICE:{intervalMin:3,intervalMax:8},
  WHITE_HORSE:{intervalSeconds:8},
  COW_CROSSING:{minInterval:4,intervalRange:4},
  ROADWORKS:{first:10},
  SLOW_TRAFFIC:{firstSeconds:3,intervalMin:5,intervalMax:8},
  WEATHER:{firstMin:2,firstMax:4,intervalMin:6,intervalMax:10},
  ROAD_FORKS:{chance:1},
  ROAD_INFRASTRUCTURE:{gapMin:500,gapMax:800},
  SHELL:{startSeconds:8,intervalMin:3,intervalMax:5,fallSeconds:1.5},
};

export function applyTestOverrides(groups){
  if(typeof location==='undefined')return; // Node 端验证脚本无 location,直接跳过,默认值不受影响。
  const params=new URLSearchParams(location.search);
  const warn=message=>console.warn('[test-overrides] 忽略非法参数:'+message);
  const set=(group,name,key,raw)=>{
    const value=Number(raw);
    if(!Number.isFinite(value)){warn(name+'.'+key+'='+raw);return;}
    group[key]=value;TEST_OVERRIDES.keys.push(name+'.'+key+'='+raw);
  };
  const applyPatch=patch=>{
    for(const [name,fields] of Object.entries(patch)){
      const group=groups[name];if(!group)continue;
      for(const [key,value] of Object.entries(fields))set(group,name,key,String(value));
    }
  };
  if(params.has('fast')&&params.get('fast')!=='0')applyPatch(FAST_PRESET);
  for(const name of new Set(params.keys())){
    if(name==='fast')continue;
    const dot=name.indexOf('.');
    const group=dot>0?groups[name.slice(0,dot)]:null;
    const key=dot>0?name.slice(dot+1):'';
    if(!group||!WHITELIST[name.slice(0,dot)]?.includes(key)){warn(name+'='+params.get(name));continue;}
    set(group,name.slice(0,dot),key,params.get(name));
  }
  TEST_OVERRIDES.active=TEST_OVERRIDES.keys.length>0;
  if(TEST_OVERRIDES.active)console.info('[test-overrides] 测试参数生效:'+TEST_OVERRIDES.keys.join(', '));
}
