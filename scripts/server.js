import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, resolve, sep } from 'node:path';
import { execFile } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const portIndex = process.argv.indexOf('--port');
const port = Number(portIndex < 0 ? 4180 : process.argv[portIndex + 1]);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Некорректный порт');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const route = pathname === '/' ? '/index.html' : pathname;
    if (!['/index.html', '/styles.css'].includes(route) && !/^\/(src|assets)\//.test(route)) {
      response.writeHead(404).end();
      return;
    }
    const path = resolve(root, `.${route}`);
    if (!path.startsWith(resolve(root) + sep)) {
      response.writeHead(403).end();
      return;
    }
    const content = await readFile(path);
    response.writeHead(200, { 'Content-Type': `${types[extname(path)] || 'application/octet-stream'}; charset=utf-8`, 'Cache-Control': 'no-store' });
    response.end(content);
  } catch {
    response.writeHead(404).end();
  }
});
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE'
    ? `Порт ${port} уже занят. Если игра запущена, откройте http://127.0.0.1:${port}. Для другого порта: start-local.bat 4181`
    : `Не удалось запустить сервер: ${error.message}`);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${port}`;
  console.log(`ARPG: ${url}`);
  if (process.argv.includes('--open') && process.platform === 'win32') {
    execFile('cmd.exe', ['/d', '/c', 'start', '""', url], { windowsHide: true }, error => {
      if (error) console.error(`Откройте игру в браузере: ${url}`);
    });
  }
});
