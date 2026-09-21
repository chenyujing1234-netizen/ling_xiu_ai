/**
 * 降级引擎（R-N3）：AI 不可用时，用规则保证灵修流程照样能走完。
 * 质量当然不如 AI，但"不能因为接口挂了就没法灵修"。
 */

export type FallbackQuestion = { layer: string; bridge: string | null; question: string };

const BRIDGES = [
  '电影《肖申克的救赎》里说"希望是好东西"',
  '《活着》里福贵一次次失去却仍然活着',
  '诗歌《你的信实广大》唱"清晨复清晨，主必赐恩惠"',
  '网上常说"努力就会有回报"',
  '《平凡的世界》里孙少平坚持读书',
  '大家常讲"996 是奋斗者的福报"',
];

/** 按文体给出四层问题模板 */
export function fallbackQuestions(ref: string, genre: string): FallbackQuestion[] {
  const bridge = BRIDGES[Math.floor(Math.random() * BRIDGES.length)];
  const flowByGenre: Record<string, string> = {
    诗歌: `这段的情绪从哪里转向了哪里？转折发生在哪一句？`,
    先知: `先知的话里，指责与应许各占多少？他为什么这样排列？`,
    书信: `作者的论证是怎么一步步推过来的？哪一句是转折？`,
    律法: `这些条例的排列有先后逻辑吗？为什么先说这个再说那个？`,
    预言: `这段的画面是怎么推进的？哪一处让你觉得最不寻常？`,
  };

  return [
    {
      layer: 'fact',
      bridge: null,
      question: `${ref}里，有哪个细节是你第一遍读的时候漏掉、回头看才注意到的？`,
    },
    {
      layer: 'flow',
      bridge: null,
      question: flowByGenre[genre] ?? `这段的情节是怎么推进的？你觉得高潮或转折在哪一节？`,
    },
    {
      layer: 'theology',
      bridge: bridge,
      question: `${bridge}——这段经文会同意这句话吗？神在这里显明的，和这种说法差在哪里？`,
    },
    {
      layer: 'application',
      bridge: null,
      question: `如果这段经文说的是真的，你今天正在做的哪一个决定需要重新想一遍？`,
    },
  ];
}

export function fallbackNudges(ref: string): string[] {
  return [
    `读${ref}的时候，哪一句让你心里"咯噔"一下？`,
    `这段里有没有哪个人的反应，你觉得换成自己也会这么做？`,
    `今天你这一天里发生的事，和这段经文有哪一点碰上了？`,
  ];
}

export type FallbackScore = {
  scores: { dimension: string; score: number; reason: string }[];
  encouragement: string;
};

/**
 * 启发式评分：看的是"投入的痕迹"而不是"答得对不对"。
 * 依据：篇幅、是否自己提出真问题、是否引用经文词句、是否有第一人称的自我涉入。
 */
export function fallbackScore(input: {
  observation: string;
  questions: string;
  answers: string;
  passage: string;
}): FallbackScore {
  const { observation, questions, answers, passage } = input;

  const len = (s: string) => s.replace(/\s/g, '').length;
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

  // 观察：篇幅 + 是否用了经文里出现过的词（说明真读了文本）
  const passageWords = new Set(
    (passage.match(/[\u4e00-\u9fa5]{2,4}/g) ?? []).filter((w) => w.length >= 2),
  );
  const overlap = (s: string) =>
    (s.match(/[\u4e00-\u9fa5]{2,4}/g) ?? []).filter((w) => passageWords.has(w)).length;

  const obsScore = clamp(Math.min(len(observation) / 60, 1) * 55 + Math.min(overlap(observation) / 4, 1) * 45);

  // 提问：问号数量 + 是否出现追问性词汇
  const qMarks = (questions.match(/[?？]/g) ?? []).length;
  const deepWords = /为什么|为何|怎么会|难道|岂|如果|究竟|凭什么|怎样才|真的吗/;
  const qScore = clamp(
    Math.min(qMarks / 2, 1) * 40 + Math.min(len(questions) / 50, 1) * 30 + (deepWords.test(questions) ? 30 : 0),
  );

  // 要义：是否触及超越情节的语汇
  const thesisWords = /神|上帝|主|恩典|罪|救|信|应许|圣洁|公义|怜悯|盟约|十字架|悔改|顺服|荣耀/;
  const thesisHits = (answers.match(new RegExp(thesisWords, 'g')) ?? []).length;
  const thScore = clamp(Math.min(len(answers) / 120, 1) * 55 + Math.min(thesisHits / 3, 1) * 45);

  // 个人化：第一人称 + 生活语汇
  const selfWords = /我|自己|我的|我们家|昨天|今天|最近|这段时间|工作|孩子|父母|同事|丈夫|妻子/;
  const selfHits = (answers.concat(observation).match(new RegExp(selfWords, 'g')) ?? []).length;
  const pScore = clamp(Math.min(selfHits / 4, 1) * 70 + Math.min(len(answers) / 150, 1) * 30);

  const mk = (dimension: string, score: number, reason: string) => ({ dimension, score, reason });
  return {
    scores: [
      mk('observation', obsScore, obsScore >= 60 ? '你写下的观察扣着经文本身，这是好的起点。' : '观察还比较笼统，试着写出经文里具体的人、动作和顺序。'),
      mk('inquiry', qScore, qScore >= 60 ? '你提的问题里有真实的困惑。' : '试着提出让你自己也答不上来的问题，那才是真问题。'),
      mk('thesis', thScore, thScore >= 60 ? '你已经越过情节，摸到这段要说的事。' : '还停在"发生了什么"，再问一句"神在这里是怎样的神"。'),
      mk('personal', pScore, pScore >= 60 ? '你把自己放进去了，这一步很关键。' : '这段经文和你这几天的生活有什么碰撞？把它写出来。'),
    ],
    encouragement:
      '（当前离线评估）你已经动笔思考了，这比读完更要紧。接下来的引导会顺着你写的内容往下走。',
  };
}

/** AI 不可用时的引导文本：仍然坚持"不给答案、以问题收尾" */
export function fallbackGuide(ref: string, questions: string): string {
  const first = questions.split(/\n/).find((l) => l.trim())?.trim() || '你提的问题';
  return `你问的这个——「${first}」——问到了点子上。真正值得留意的是：你会这样问，说明你已经感觉到这段经文里有某种不对劲或不舒服的地方。那个不舒服，往往就是神要动工的地方。

先给你两块必要的背景：读${ref}这样的经文，要留意它写给谁、在什么处境下写的。古代近东的读者与我们对"荣耀""顺服""家族"的理解并不相同，很多我们觉得刺眼的地方，在当时的语境里有另一重分量。这类知识性的东西你查得到，我建议你顺着这条线自己再挖一层。

现在把问题交回给你：你刚才写下的那些话里，有一句是你自己也没完全相信的。是哪一句？为什么你会写下自己还不敢信的话？

（当前 AI 服务暂时不可用，这是离线引导。恢复后可重新生成针对你的回应。）`;
}

/** 阶段切换时的短评（AI 不可用） */
export function fallbackStageFeedback(
  stage: 'observe' | 'inquire' | 'reflect' | 'guided' | 'life',
  userContent: string,
): string {
  const clip = userContent.trim().slice(0, 36);
  const quote = clip ? `你写到「${clip}${userContent.length > 36 ? '…' : ''}」` : '你已经留下了文字';

  switch (stage) {
    case 'observe':
      return `${quote}，说明你在对着经文看，而不是只翻页。下一步提问时，试着问一句你自己也答不上来的「为什么」。（离线简评）`;
    case 'inquire':
      return `${quote}。真问题往往带着一点不安或矛盾——带着它们进入默想，比找标准答案更重要。（离线简评）`;
    case 'reflect':
      return `${quote}，是你自己的话，这很好。若还觉得浅，回经文找一句最刺你的，再答一次。（离线简评）`;
    case 'guided':
      return clip
        ? `${quote}，陪读者会顺着你的话往下走。进入生命实事时，找一件这周真实发生的事。（离线简评）`
        : '你已经读完了陪读者的回应。进入生命实事时，写一件这周真实发生的事，比写感想更有力。（离线简评）';
    case 'life':
      return `${quote}。实事写具体了，祷告才有内容。下一步试着对神说实话，不用漂亮。（离线简评）`;
  }
}

/** 本章笔记总结（AI 不可用） */
export function fallbackChapterNotesReview(ref: string, noteCount: number): string {
  return `你在 ${ref} 写了 ${noteCount} 处笔记，说明经文在跟你说话。试着串起来：整章最抓住你的是哪一条线？最后留一个你自己还答不了的问题。（离线总结）`;
}

/** 笔记陪读者点评（AI 不可用，仍控制在短句） */
export function fallbackNoteReview(ref: string, noteContent: string): string {
  const hasQuestion = /[?？]|为什么|为何|怎么|如何|是不是|能不能|吗|呢/.test(noteContent);
  if (hasQuestion) {
    return '你在读也在问，好。关于疑问：先对照前后文，看经文是否在回应你。（离线）';
  }
  if (noteContent.trim()) {
    return '笔记接住了这节经，再读一遍，哪一句最贴你？（离线）';
  }
  return `「${ref}」旁留了笔记，写具体一点，陪读者才好回应。（离线）`;
}
