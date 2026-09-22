/** 推荐给朋友用的分享文案：新教灵修语气，邀请制，多版本可选 */

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

export const SHARE_APP_VARIANTS: ShareAppVariant[] = [
  {
    id: 'quiet-time',
    label: '清晨与主',
    hint: '安静灵修，把时间留给神的话',
    build: (base) => `弟兄姊妹，我在用「晨光」灵修。

每天留一段安静的时间，打开圣经，先观察、自己向神提问、默想，再把心里的话祷告回给主。不是赶进度，是与主相遇、让神的话塑造我。

${footer(base)}`,
  },
  {
    id: 'think-first',
    label: '先思想神的话',
    hint: '先自己读、自己问，再领受引导',
    build: (base) => `推荐一个读经灵修工具「晨光」。

读经常有两个难处：读完就忘，或一打开就看别人的讲解。这里反过来——先自己思想神的话：观察、提问、默想、把生命里的实事带到主面前祷告，之后才有引导。陪读者只带你往深处走，不替你下神学定论。

经文是新标点和合本，也可中英对照。
${footer(base)}`,
  },
  {
    id: 'by-the-word',
    label: '靠神口里的话',
    hint: '以经文起头，偏敬虔、偏喂养',
    build: (base) => `「人活着，不是单靠食物，乃是靠神口里所出的一切话。」（马太福音 4:4）

我在「晨光」里按着圣经灵修：读一章、记下观察、向神提问、默想作答，再把生命里的实事带到主面前祷告。盼望不是多划了几章，而是被神的话光照、更新。

${footer(base)}`,
  },
  {
    id: 'fellowship',
    label: '邀弟兄姊妹同读',
    hint: '适合发给小组、门训同伴',
    build: (base) => `我们在用「晨光」一起读经灵修。

每人先自己读神的话、提问、默想、祷告，再来交通，就不容易只听别人讲。适合小组、门训里安静操练，也适合个人每天与主亲近。

${footer(base)}`,
  },
];

export function buildShareAppText(appUrl: string, variantId?: string) {
  const base = normalizeBase(appUrl);
  const variant =
    SHARE_APP_VARIANTS.find((v) => v.id === variantId) ?? SHARE_APP_VARIANTS[0];
  return variant.build(base);
}
