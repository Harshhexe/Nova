import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform === 'darwin') {
  const root = dirname(fileURLToPath(import.meta.url));
  const headers = [
    process.env.NOVA_NODE_HEADERS,
    resolve(dirname(process.execPath), '../include/node'),
    '/opt/homebrew/include/node',
    '/usr/local/include/node'
  ].find(path => path && existsSync(resolve(path, 'node_api.h')));
  if (!headers) throw new Error('Set NOVA_NODE_HEADERS to the directory containing node_api.h');
  execFileSync('clang++', [
    '-arch', process.arch, '-std=c++17', '-fobjc-arc', '-bundle', '-undefined', 'dynamic_lookup',
    '-framework', 'AppKit', '-I', headers,
    resolve(root, 'trackpad.mm'), resolve(root, 'default-browser.mm'), resolve(root, 'app-update.mm'),
    '-o', resolve(root, 'trackpad.node')
  ], { stdio: 'inherit' });
}
