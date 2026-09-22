#!/usr/bin/env node
/**
 * 发信自查。与 http_server_src/email_helper.py 同一条路径：
 * python3 scripts/send_mail.py → SMTP_SSL smtp.qq.com:465
 *
 *   npm run mail:check          # 只查配置与登录，不发信
 *   npm run mail:check -- --send  # 真发一封到 ADMIN_NOTIFY_EMAIL
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

for (const file of ['.env.local', '.env']) {
  try {
    for (const line of readFileSync(join(process.cwd(), file), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* 没有这个文件就算了 */
  }
}

const USER = process.env.SENDER_EMAIL || '';
const PASS = process.env.SMTP_PASSWORD || '';
const TO = process.env.ADMIN_NOTIFY_EMAIL || '594462206@qq.com';
const HOST = process.env.SMTP_HOST || 'smtp.qq.com';
const PORT = process.env.SMTP_PORT || '465';
const doSend = process.argv.includes('--send');
const script = join(process.cwd(), 'scripts/send_mail.py');

console.log('发信配置（与 http_server_src/email_helper.py 相同：SMTP_SSL）');
console.log(`  SMTP        ${HOST}:${PORT}（SSL）`);
console.log(`  发件人      ${USER || '（空）'}`);
console.log(`  授权码      ${PASS ? `已填，${PASS.length} 位` : '（空）'}`);
console.log(`  收件人      ${TO}`);

if (!USER || !PASS) {
  const missing = [!USER && 'SENDER_EMAIL', !PASS && 'SMTP_PASSWORD'].filter(Boolean);
  console.log(`\n× 还差 ${missing.join(' 和 ')}，申请通知发不出去（申请本身不受影响）。`);
  console.log('  在 .env.local 里填上 QQ 邮箱授权码（不是登录密码）：');
  console.log('    SMTP_PASSWORD=16位授权码');
  console.log('  或与 http_server_src 共用：在 /home/chenyj/http_server_src/.env 写入同样两项。');
  process.exit(1);
}

function run(args, stdin) {
  return spawnSync('python3', [script, ...args], {
    encoding: 'utf8',
    input: stdin,
    env: process.env,
    timeout: 25_000,
  });
}

const t0 = Date.now();
const verified = run(['--verify']);
if (verified.status !== 0) {
  const msg = `${verified.stderr || ''}${verified.stdout || ''}`.trim();
  console.log(`\n× 登录失败：${msg}`);
  if (/authentication|535|invalid/i.test(msg)) {
    console.log('  多半是授权码不对，或者填成了邮箱登录密码 —— QQ 邮箱只认授权码。');
  } else if (/timeout|ETIMEDOUT|ECONNREFUSED/i.test(msg)) {
    console.log(`  连不上 ${HOST}:${PORT}，看看服务器出网是否被防火墙拦了 465 端口。`);
  }
  process.exit(1);
}
console.log(`\n√ 连上 ${HOST} 并通过授权（${Date.now() - t0}ms）`);

if (!doSend) {
  console.log('\n配置没问题。加 --send 可以真发一封试试：npm run mail:check -- --send');
  process.exit(0);
}

const when = new Date().toLocaleString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' });
const sent = run(
  ['--send'],
  JSON.stringify({
    to: TO,
    subject: '[灵修] 发信自查',
    text: [
      '这是一封自查邮件，说明"有人提交使用申请"的通知能正常发到这个邮箱。',
      '',
      `发出时间：${when}`,
      `发件账号：${USER}`,
      '',
      '真实的申请通知里会带上申请人手机号、申请理由、当前待审批条数和审批链接。',
      '',
      '—— 灵修工具',
    ].join('\n'),
  }),
);
if (sent.status !== 0) {
  console.log(`× 发送失败：${(sent.stderr || sent.stdout || '').trim()}`);
  process.exit(1);
}
console.log(`√ 已发出到 ${TO}（${(sent.stdout || '').trim()}）`);
console.log('  去收件箱确认一下；QQ 邮箱有时会先放进"垃圾邮件"，看到了标记为非垃圾即可。');
