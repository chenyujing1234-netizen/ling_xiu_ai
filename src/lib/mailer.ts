import nodemailer from 'nodemailer';

/**
 * 发信。目前只用来把"有人提交了使用申请"通知给管理员 ——
 * 这是个邀请制的工具，申请如果没人看见，人就一直被卡在门外。
 *
 * 走 QQ 邮箱的 SMTP over SSL（465），和 http_server_src/email_helper.py 一个路子：
 * SMTP_PASSWORD 填的是**邮箱授权码**，不是登录密码。
 */
const HOST = process.env.SMTP_HOST || 'smtp.qq.com';
const PORT = Number(process.env.SMTP_PORT || 465);
const USER = process.env.SENDER_EMAIL || '';
const PASS = process.env.SMTP_PASSWORD || '';
const TO = process.env.ADMIN_NOTIFY_EMAIL || '594462206@qq.com';
const APP_URL = process.env.APP_URL || '';

export const mailerConfigured = Boolean(USER && PASS);

/** 手机号在邮件里也遮一半：邮箱不一定只有我一个人能看到 */
function maskPhone(phone: string) {
  return phone.length === 11 ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : phone;
}

async function send(subject: string, text: string) {
  if (!mailerConfigured) {
    console.warn('[mail] 没配 SENDER_EMAIL / SMTP_PASSWORD，跳过发信：', subject);
    return false;
  }
  // 每次现建：申请是低频动作，长连接白占着还容易被服务端掐断
  const tx = nodemailer.createTransport({
    host: HOST,
    port: PORT,
    secure: PORT === 465,
    auth: { user: USER, pass: PASS },
    // 卡住也别拖着：调用方多半在 after() 里，超时了记一笔日志就够
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  try {
    const info = await tx.sendMail({ from: USER, to: TO, subject, text });
    console.log(`[mail] 已发出 → ${TO}（${info.messageId}）`);
    return true;
  } catch (err) {
    // 发不出去不该影响业务，但一定要留下痕迹，否则申请就静悄悄丢了
    console.error(`[mail] 发送失败：${(err as Error).message}`);
    return false;
  } finally {
    tx.close();
  }
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
      : '去后台「管理」页审批：先给他分配一个初始密码，他首次登录后会被要求改掉。',
    '',
    '—— 灵修工具',
  ];
  return send(`[灵修] 新的使用申请 ${masked}`, lines.join('\n'));
}
