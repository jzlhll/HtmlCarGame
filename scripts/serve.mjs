import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const playing = process.argv.includes('--play'), explicitPort = process.env.PORT !== undefined;
const range = playing ? { first: 5186, size: 14 } : { first: 5200, size: 1000 };
const requestedPort = Number(process.env.PORT);
if (explicitPort && (!/^\d+$/.test(process.env.PORT) || !Number.isInteger(requestedPort) || requestedPort < 1 || requestedPort > 65535)) {
  console.error('PORT must be an integer between 1 and 65535.');
  process.exit(1);
}
// 开发端口由实际工作目录决定，与双击游玩的端口范围分开；重命名分支不改变端口。
const offset = playing ? 0 : createHash('sha256').update(fs.realpathSync(root)).digest().readUInt32BE(0) % range.size;
let port = explicitPort ? requestedPort : range.first + offset, attempts = 0;
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.wav':'audio/wav'};
const server = http.createServer((req,res) => {
  let name;
  try { name = decodeURIComponent(new URL(req.url,'http://localhost').pathname); } catch { res.writeHead(400).end(); return; }
  const file = path.resolve(root, '.' + (name === '/' ? '/index.html' : name));
  const relative = path.relative(root,file);
  if (relative.startsWith('..') || relative.split(path.sep).some(p => p.startsWith('.')) || !['index.html','src','node_modules'].includes(relative.split(path.sep)[0])) { res.writeHead(403).end(); return; }
  fs.readFile(file,(err,data) => {
    if (err) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200,{'Content-Type':types[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}).end(data);
  });
});
server.on('error',error => {
  // 仅自动分配时重试，不连接或停止占用端口的其他服务；显式PORT保留严格语义。
  if (error.code === 'EADDRINUSE' && !explicitPort && ++attempts < range.size) {
    const previous = port;
    port = range.first + (offset + attempts) % range.size;
    console.info('Port ' + previous + ' is in use; trying ' + port + '.');
    server.listen(port,'127.0.0.1');
    return;
  }
  console.error(error.code === 'EADDRINUSE'
    ? explicitPort ? 'Requested port ' + port + ' is in use. Choose another PORT.'
      : 'All automatic ports from ' + range.first + ' to ' + (range.first + range.size - 1) + ' are in use. Set PORT to an available port.'
    : error.message);
  process.exitCode = 1;
});
server.on('listening',() => {
  const url = 'http://localhost:' + port;
  console.log('Low altitude crossing (' + (playing ? 'play' : 'development') + '): ' + url + ' (Ctrl+C to stop)');
  if(process.argv.includes('--open')&&process.platform==='darwin')spawn('open',[url],{stdio:'ignore'});
});
server.listen(port,'127.0.0.1');
