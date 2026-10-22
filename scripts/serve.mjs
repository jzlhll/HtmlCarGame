import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { resourceSourcesModule } from './resource-sources.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port=Number(process.env.PORT||5173),url='http://localhost:'+port;
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml'};
const server = http.createServer(async(req,res) => {
  let name;
  try { name = decodeURIComponent(new URL(req.url,'http://localhost').pathname); } catch { res.writeHead(400).end(); return; }
  const file = path.resolve(root, '.' + (name === '/' ? '/index.html' : name));
  const relative = path.relative(root,file);
  if (relative.startsWith('..') || relative.split(path.sep).some(p => p.startsWith('.')) || !['index.html','src','node_modules'].includes(relative.split(path.sep)[0])) { res.writeHead(403).end(); return; }
  if(relative.split(path.sep).join('/')==='src/resource-sources.js'){
    try{res.writeHead(200,{'Content-Type':types['.js'],'Cache-Control':'no-store'}).end(await resourceSourcesModule(root));}
    catch(error){console.error('Resource manifest failed',error);res.writeHead(500).end('Resource manifest unavailable');}
    return;
  }
  fs.readFile(file,(err,data) => {
    if (err) { res.writeHead(404).end('Not found'); return; }
    // 模块 Worker 不读取 import map，工具模块改用相对依赖。
    if(relative.split(path.sep).join('/')==='node_modules/three/examples/jsm/utils/BufferGeometryUtils.js')data=Buffer.from(data.toString().replace("from 'three';","from '../../../build/three.module.js';"));
    res.writeHead(200,{'Content-Type':types[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}).end(data);
  });
});
server.on('error',error => {
  console.error(error.code === 'EADDRINUSE' ? 'Port '+port+' is in use. Open '+url+' if this game is already running.' : error.message);
  process.exitCode = 1;
});
server.listen(port,'127.0.0.1',() => {
  console.log('English Air Combat: '+url+' (Ctrl+C to stop)');
  if(process.argv.includes('--open')&&process.platform==='darwin')spawn('open',[url],{stdio:'ignore'});
});
