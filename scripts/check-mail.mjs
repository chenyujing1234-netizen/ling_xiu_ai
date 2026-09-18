#!/usr/bin/env node
/**
 * 发信自查。
 *
 * 这是个邀请制的工具：有人提交申请后如果没人收到提醒，他就一直被卡在门外，
 * 所以这条链路值得单独有个自查。按真实调用顺序逐段检查：
 * 配置 → 连得上 SMTP → 授权码对不对 → 真发一封。
 *
 *   npm run mail:check          # 只查配置与登录，不发信
 *   npm run mail:check -- --send  # 真发一封到 ADMIN_NOTIFY_EMAIL
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import nodemailer from 'nodemailer';

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

const HOST = process.env.SMTP_HOST || 'smtp.qq.com';
const PORT = Number(process.env.SMTP_PORT || 465);
const USER = process.env.SENDER_EMAIL || '';
const PASS = process.env.SMTP_PASSWORD || '';
const TO = process.env.ADMIN_NOTIFY_EMAIL || '594462206@qq.com';
const doSend = process.argv.includes('--send');

console.log('发信配置');
console.log(`  SMTP        ${HOST}:${PORT}${PORT === 465 ? '（SSL）' : ''}`);
console.log(`  发件人      ${USER || '（空）'}`);
console.log(`  授权码      ${PASS ? `已填，${PASS.length} 位` : '（空）'}`);
console.log(`  收件人      ${TO}`);

if (!USER || !PASS) {
  const missing = [!USER && 'SENDER_EMAIL', !PASS && 'SMTP_PASSWORD'].filter(Boolean);
  console.log(`\n× 还差 ${missing.join(' 和 ')}，申请通知发不出去（申请本身不受影响）。`);
  console.log('  在 .env.local 里填上：');
  if (!USER) console.log('    SENDER_EMAIL=你的QQ邮箱@qq.com');
  if (!PASS) console.log('    SMTP_PASSWORD=邮箱授权码（16 位，不是邮箱登录密码）');
  if (!PASS) {
    console.log('  授权码在 QQ 邮箱 → 设置 → 账号与安全 → 安全设置 →');
    console.log('  开启「IMAP/SMTP 服务」→ 生成授权码。');
  }
  process.exit(1);
}

const tx = nodemailer.createTransport({
  host: HOST,
  port: PORT,
  secure: PORT === 465,
  auth: { user: USER, pass: PASS },
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 20_000,
});

const t0 = Date.now();
try {
  await tx.verify();
  console.log(`\n√ 连上 ${HOST} 并通过授权（${Date.now() - t0}ms）`);
} catch (err) {
  const msg = String(err?.message || err);
  console.log(`\n× 登录失败：${msg}`);
  if (/authentication|535|invalid/i.test(msg)) {
    console.log('  多半是授权码不对，或者填成了邮箱登录密码 —— QQ 邮箱只认授权码。');
  } else if (/timeout|ETIMEDOUT|ECONNREFUSED/i.test(msg)) {
    console.log(`  连不上 ${HOST}:${PORT}，看看服务器出网是否被防火墙拦了 465 端口。`);
  }
  tx.close();
  process.exit(1);
}

if (!doSend) {
  console.log('\n配置没问题。加 --send 可以真发一封试试：npm run mail:check -- --send');
  tx.close();
  process.exit(0);
}

const when = new Date().toLocaleString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' });
try {
  const info = await tx.sendMail({
    from: USER,
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
  });
  console.log(`√ 已发出到 ${TO}（${info.messageId}）`);
  console.log('  去收件箱确认一下；QQ 邮箱有时会先放进"垃圾邮件"，看到了标记为非垃圾即可。');
} catch (err) {
  console.log(`× 发送失败：${err?.message || err}`);
  tx.close();
  process.exit(1);
}
tx.close();
