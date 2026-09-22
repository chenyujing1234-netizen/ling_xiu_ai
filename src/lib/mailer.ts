import { spawn } from 'node:child_process';
import path from 'node:path';

/**
 * 发信。目前只用来把"有人提交了使用申请"通知给管理员 ——
 * 这是个邀请制的工具，申请如果没人看见，人就一直被卡在门外。
 *
 * 发信路径与 /home/chenyj/http_server_src/email_helper.py 相同：
 * smtplib.SMTP_SSL('smtp.qq.com', 465) + SENDER_EMAIL / SMTP_PASSWORD（授权码）。
 */
const USER = process.env.SENDER_EMAIL || '';
const PASS = process.env.SMTP_PASSWORD || '';
const TO = process.env.ADMIN_NOTIFY_EMAIL || '594462206@qq.com';
const APP_URL = process.env.APP_URL || '';

export const mailerConfigured = Boolean(USER && PASS);

const SCRIPT = path.join(process.cwd(), 'scripts/send_mail.py');

function runMail(args: string[], stdin?: string): Promise<{ ok: boolean; out: string }> {
  return new Promise((resolve) => {
    const child = spawn('python3', [SCRIPT, ...args], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (chunk) => {
      out += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      err += String(chunk);
    });
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
    }, 25_000);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, out: (out + err).trim() });
    });
    child.on('error', (e) => {
      clearTimeout(timer);
      resolve({ ok: false, out: e.message });
    });
    if (stdin) child.stdin.write(stdin);
    child.stdin.end();
  });
}

/** 手机号在邮件里也遮一半：邮箱不一定只有我一个人能看到 */
function maskPhone(phone: string) {
  return phone.length === 11 ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : phone;
}

async function send(subject: string, text: string) {
  if (!mailerConfigured) {
    console.warn('[mail] 没配 SENDER_EMAIL / SMTP_PASSWORD，跳过发信：', subject);
    return false;
  }
  const payload = JSON.stringify({ to: TO, subject, text });
  const res = await runMail(['--send'], payload);
  if (res.ok) {
    console.log(`[mail] 已发出 → ${TO}（${res.out || 'smtp_ssl'}）`);
    return true;
  }
  console.error(`[mail] 发送失败：${res.out || 'python send_mail.py 失败'}`);
  return false;
}

/** 有人提交使用申请 → 通知管理员去审批 */
export async function notifyAccessRequest(r: {
  phone: string;
  note?: string | null;
  pendingCount: number;
}) {
  const masked = maskPhone(r.phone);
  const when = new Date().toLocaleString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' });
  const lines = [
    '有人申请使用灵修工具，等你审批。',
    '',
    `手机号：${r.phone}`,
    `提交时间：${when}`,
    `申请理由：${r.note?.trim() || '（没填）'}`,
    '',
    `目前待审批：${r.pendingCount} 条`,
    '',
    APP_URL
      ? `去审批：${APP_URL.replace(/\/$/, '')}/admin`
      : '去后台「管理」页审批；申请人已在提交时自设登录密码，通过后可直接登录。',
    '',
    '—— 灵修工具',
  ];
  return send(`[灵修] 新的使用申请 ${masked}`, lines.join('\n'));
}
