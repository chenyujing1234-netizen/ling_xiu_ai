/**
 * 阿里云短信验证码（申请页用）。
 *
 * 配置在 .env.local：ALIYUN_ACCESS_KEY_ID / ALIYUN_ACCESS_KEY_SECRET /
 * SMS_SIGN_NAME / SMS_TEMPLATE_CODE（模板变量为 ${code}）。
 * 未配置时生产环境直接失败；开发环境在日志输出验证码并视为成功，方便本地联调。
 */

import crypto from 'crypto';

const ACCESS_KEY_ID = process.env.ALIYUN_ACCESS_KEY_ID || '';
const ACCESS_KEY_SECRET = process.env.ALIYUN_ACCESS_KEY_SECRET || '';
const SIGN_NAME = process.env.SMS_SIGN_NAME || '';
const TEMPLATE_CODE = process.env.SMS_TEMPLATE_CODE || '';

export const SMS_CONFIGURED = Boolean(ACCESS_KEY_ID && ACCESS_KEY_SECRET && SIGN_NAME && TEMPLATE_CODE);

/** 生成 6 位数字验证码 */
export function generateSmsCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/** 验证码哈希（带手机号盐），入库不存明文 */
export function hashSmsCode(phone: string, code: string): string {
  return crypto.createHash('sha256').update(`${phone}:${code}`).digest('hex');
}

/** 生成阿里云 API 签名（HMAC-SHA1，RPC 风格） */
function generateSignature(params: Record<string, string>): string {
  const sortedKeys = Object.keys(params).sort();
  const canonicalized = sortedKeys
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');
  const stringToSign = `GET&${encodeURIComponent('/')}&${encodeURIComponent(canonicalized)}`;
  return crypto.createHmac('sha1', `${ACCESS_KEY_SECRET}&`).update(stringToSign).digest('base64');
}

/** 发送短信验证码；返回是否成功 */
export async function sendSmsCode(phone: string, code: string): Promise<boolean> {
  if (!SMS_CONFIGURED) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[sms] 未配置阿里云短信环境变量，无法发送');
      return false;
    }
    console.log(`[sms] 开发模式（未配置）：${phone} 的验证码是 ${code}`);
    return true;
  }

  try {
    const params: Record<string, string> = {
      AccessKeyId: ACCESS_KEY_ID,
      Action: 'SendSms',
      Format: 'JSON',
      PhoneNumbers: phone,
      RegionId: 'cn-hangzhou',
      SignName: SIGN_NAME,
      SignatureMethod: 'HMAC-SHA1',
      SignatureNonce: crypto.randomBytes(12).toString('hex'),
      SignatureVersion: '1.0',
      TemplateCode: TEMPLATE_CODE,
      TemplateParam: JSON.stringify({ code }),
      Timestamp: new Date().toISOString(),
      Version: '2017-05-25',
    };
    params.Signature = generateSignature(params);

    const queryString = Object.keys(params)
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');

    const response = await fetch(`https://dysmsapi.aliyuncs.com/?${queryString}`, { method: 'GET' });
    const result = (await response.json()) as { Code?: string; Message?: string };

    if (result.Code === 'OK') return true;
    console.error(`[sms] 发送失败 [${result.Code}]: ${result.Message}`);
    return false;
  } catch (err) {
    console.error('[sms] 发送异常:', (err as Error).message || err);
    return false;
  }
}
