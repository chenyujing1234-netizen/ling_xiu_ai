/** 推荐给朋友用的分享文案：邀请制，多版本可选；对外转发前会弱化敏感词 */

export type ShareAppVariant = {
  id: string;
  label: string;
  hint: string;
  build: (base: string) => string;
};

function normalizeBase(appUrl: string) {
  return appUrl.replace(/\/$/, '');
}

function footer(base: string) {
  return `目前是邀请制、小范围使用。你若也想一起来，可以先申请：
${base}/apply

已有账号登录：${base}/login`;
}

/**
 * 微信等外链转发：弱化宗教敏感字眼（产品内仍用原表述）。
 * 规则示例：主→zhu，神→他（先处理「神学」等组合词），祷告→心语等。
 */
export function softenShareCopy(text: string): string {
  let s = text;
  s = s.replace(/神学定论/g, '学理定论');
  s = s.replace(/神学/g, '学理');
  s = s.replace(/弟兄姊妹/g, '朋友们');
  s = s.replace(/敬虔/g, '安静');
  s = s.replace(/马太福音\s*4\s*:\s*4/g, '经典摘句');
  s = s.replace(/（马太福音\s*4\s*:\s*4）/g, '（经典摘句）');
  s = s.replace(/与主相遇/g, '与自己安静相遇');
  s = s.replace(/与主亲近/g, '与zhu亲近');
  s = s.replace(/主面前/g, 'zhu面前');
  s = s.replace(/回给主/g, '写给zhu');
  s = s.replace(/带到主面前/g, '写进心里');
  s = s.replace(/与主/g, '与zhu');
  s = s.replace(/主/g, 'zhu');
  s = s.replace(/向神/g, '向他');
  s = s.replace(/给神/g, '给他');
  s = s.replace(/靠神/g, '靠他');
  s = s.replace(/被神/g, '被他');
  s = s.replace(/神口里/g, '他口里');
  s = s.replace(/神的话/g, '他的话');
  s = s.replace(/读神/g, '读他');
  s = s.replace(/神/g, '他');
  s = s.replace(/祷告/g, '心语');
  s = s.replace(/门训/g, '小组');
  s = s.replace(/圣经/g, '书卷');
  s = s.replace(/经文/g, '篇章');
  s = s.replace(/灵修/g, '晨读');
  return s;
}

export const SHARE_APP_VARIANTS: ShareAppVariant[] = [
  {
    id: 'quiet-time',
    label: '清晨时光',
    hint: '安静晨读，把时间留给他所说的话',
    build: (base) => `朋友，我在用「晨光」做晨读。

每天留一段安静的时间，打开书卷，先观察、自己向他提问、默想，再把心里的话写给zhu。不是赶进度，是与zhu相遇、让他说的话塑造我。

${footer(base)}`,
  },
  {
    id: 'think-first',
    label: '先思想他的话',
    hint: '先自己读、自己问，再领受引导',
    build: (base) => `推荐一个读经工具「晨光」。

读经常有两个难处：读完就忘，或一打开就看别人的讲解。这里反过来——先自己思想他的话：观察、提问、默想、把生命里的实事带到心里写心语，之后才有引导。陪读者只带你往深处走，不替你下学理定论。

篇章是新标点和合本，也可中英对照；遇到难处，再查注释、背景与导图。
${footer(base)}`,
  },
  {
    id: 'study-tools',
    label: '研读小帮手',
    hint: '注释、背景、导图，读不懂时搭把手',
    build: (base) => `推荐一个读经工具「晨光」。

几处顺手的设计：读不懂的节，点开「注释」有马唐纳、丁道尔的讲解；每章配一页「背景」，讲当时的时代与风俗；读完再用「思维导图」「知识图谱」把整章脉络串起来。先自己读，工具只在需要时搭把手。

${footer(base)}`,
  },
  {
    id: 'by-the-word',
    label: '靠他口里的话',
    hint: '以摘引起头，偏安静、偏喂养',
    build: (base) => `「人活着，不是单靠食物，乃是靠他口里所出的一切话。」（经典摘句）

我在「晨光」里按着书卷晨读：读一章、记下观察、向他提问、默想作答，再把生命里的实事写进心里。盼望不是多划了几章，而是被他的话光照、更新。

${footer(base)}`,
  },
  {
    id: 'fellowship',
    label: '邀朋友同读',
    hint: '适合发给小组、同伴',
    build: (base) => `我们在用「晨光」一起读经晨读。

每人先自己读他的话、提问、默想、写心语，再来交流，就不容易只听别人讲。适合小组里安静操练，也适合个人每天与zhu亲近。

${footer(base)}`,
  },
];

export function buildShareAppText(appUrl: string, variantId?: string) {
  const base = normalizeBase(appUrl);
  const variant =
    SHARE_APP_VARIANTS.find((v) => v.id === variantId) ?? SHARE_APP_VARIANTS[0];
  return softenShareCopy(variant.build(base));
}

/** 列表预览用（与复制到剪贴板一致） */
export function shareAppPreviewLines(appUrl: string, variantId: string, lines = 3) {
  const base = normalizeBase(appUrl);
  const variant = SHARE_APP_VARIANTS.find((v) => v.id === variantId);
  if (!variant) return '';
  return softenShareCopy(variant.build(base)).split('\n').slice(0, lines).join('\n');
}
