import { copyFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const web = fileURLToPath(new URL('../web/', import.meta.url));

// 只改 Android 输出目录，网页工程的入口和运行行为保持独立。
export async function integrateGame(projectId, outputDirectory) {
  if (!['car-game', 'low-altitude-flight', 'english-air-combat'].includes(projectId)) throw new Error('Unknown Android game: ' + projectId);
  const source = path.join(outputDirectory, 'src');
  for (const name of ['android-host.js', 'android-host.css']) await copyFile(path.join(web, name), path.join(source, name));
  const entry = path.join(source, projectId === 'english-air-combat' ? 'bootstrap.js' : 'main.js');
  let script = await readFile(entry, 'utf8');
  if (script.includes("from './android-host.js'")) throw new Error('Android game was integrated twice: ' + projectId);
  script = "import { installAndroidHost } from './android-host.js';\n" + script;
  if (projectId === 'english-air-combat') {
    // 浏览器 focus/pageshow/渲染帧都必须遵守原生暂停，不能自行恢复复习时钟。
    script = script.replace("let reviewFocused=document.hasFocus()", "const androidClockPaused = () => Boolean(window.AndroidShell?.paused);\nlet reviewFocused=document.hasFocus()");
    script = script.replace("if(activeReview&&game.state==='review')", "if(activeReview&&game.state==='review'&&!androidClockPaused())");
    script = script.replaceAll("activeReview=game.state==='review'&&!document.hidden&&reviewFocused", "activeReview=game.state==='review'&&!document.hidden&&reviewFocused&&!androidClockPaused()");
    script = script.replace("reviewFocused=true;lastTime=performance.now();requestFrame();", "reviewFocused=!androidClockPaused();lastTime=performance.now();requestFrame();");
    if ((script.match(/androidClockPaused\(\)/g) || []).length !== 4) throw new Error('English review clock integration points changed');
    const marker = '\nboot();';
    if (!script.includes(marker)) throw new Error('English entry integration point changed');
    script = script.replace(marker, `
installAndroidHost({game, ui, input, audio, kind: 'english-air-combat',
  pauseClock: () => { advanceReview(performance.now()); reviewFocused = false; activeReview = false; clearTimeout(reviewTimer); reviewTimer = 0; },
  resumeClock: () => { reviewFocused = document.hasFocus(); lastTime = performance.now(); activeReview = game.state === 'review' && reviewFocused && !document.hidden; requestFrame(); },
  invalidate: () => requestFrame()
});
boot();`);
  } else if (projectId === 'car-game') {
    const marker = '\ntry{';
    if (!script.includes(marker)) throw new Error('Car entry integration point changed');
    script = script.replace(marker, "\ninstallAndroidHost({game, ui, input, audio, kind: 'car-game'});\ntry{");
  } else {
    script += `\ninstallAndroidHost({game, ui, input, audio, kind: '${projectId}'${projectId === 'low-altitude-flight' ? ', invalidate: () => wake()' : ''}});\n`;
  }
  await writeFile(entry, script);
  const index = path.join(outputDirectory, 'index.html');
  let html = await readFile(index, 'utf8');
  if (!html.includes('</head>')) throw new Error('Game HTML has no head: ' + projectId);
  if (!html.includes('href="./src/android-host.css"')) html = html.replace('</head>', '  <link rel="stylesheet" href="./src/android-host.css">\n</head>');
  if (projectId === 'low-altitude-flight') html = html.replace(/<body(\s[^>]*)?>/, (_, attributes = '') => '<body' + attributes + ' class="android-flight">');
  await writeFile(index, html);
}
