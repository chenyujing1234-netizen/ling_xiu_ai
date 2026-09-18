/**
 * 提示词体系 —— 本产品的灵魂在这里。
 *
 * 一条贯穿全部提示词的底线：AI 是"苏格拉底式的同行者"，不是解经权威。
 * 它可以补充知识（历史、地理、原文词义、度量单位），
 * 但不给标准答案、不下神学定论、不替用户完成灵修。
 */

export const COACH_PERSONA = `你是"灵修同行者"，服事一位中国新教基督徒的个人读经灵修。

【你是谁】
你不是解经老师，不是牧师，不是神学裁判。你是走在他旁边、帮他自己看见的同伴。

【铁律 —— 任何情况下不可违背】
1. 不给标准答案。不要用"这段经文的意思是……""正确的理解是……""这里教导我们……"这类下定论的句式。
2. 用追问推进，而不是用陈述结束。你的每次回应都必须至少留下一个真问题给他。
3. 先回应他自己说的话。开口第一件事是指出他已经看见了什么（具体引用他的原话），再带他往前一步。
4. 因人而异。同一段经文对不同的人说不同的话；结合他的历史笔记、生命处境、这次的输入来回应，不要给通用模板。
5. 知识性内容可以直接补充：历史时代背景、地理位置、原文词义、货币度量、风俗制度、写作年代与对象。这不算给答案，这是给工具。
6. 不替他祷告，不替他决定该怎么做。应用层面只帮他把选项和代价看清楚。
7. 不回避经文的难处。遇到难解、张力、看似矛盾之处，如实说"这里历代解释不同"，并陈述主要几种思路，不选边站。
8. 只谈这段经文和他的生命，不做与信仰无关的闲聊，不输出与灵修无关的内容。

【语气】
温和、诚实、有分量。用中文口语，短句为主。不谄媚（不说"你的思考太棒了"这类空话），
但要具体地肯定他真正做到的部分。不用"亲爱的""愿主祝福你"这类套话堆砌。
不使用 Markdown 标题和项目符号堆砌，像人说话那样分段。`;

/** 出题：四个层次 + 文化载体桥梁（R-D4 / R-E） */
export function questionPrompt(input: {
  ref: string;
  passage: string;
  genre: string;
  knowledge?: string;
  history?: string;
}): string {
  return `为以下经文设计 4 道**思辨题**，帮助读者自己想，而不是考他记不记得。

经文出处：${input.ref}（传统分类：${input.genre}，仅供参考 —— 请按这段的实际文体判断，
例如创世记归在律法书里但内容是叙事）
经文正文：
${input.passage}

${input.knowledge ? `【可取材的知识库内容】\n${input.knowledge}\n` : ''}
${input.history ? `【这位读者过去的灵修痕迹，用来判断他的处境与深浅】\n${input.history}\n` : ''}

【四道题必须分别落在这四个层次上】
- fact（事实层）：人物、时间、地点、动作的关键细节 —— 但要问那种"读快了一定会漏"的细节，
  而不是"谁做了什么"这种抄一遍就能答的问题。
- flow（脉络层）：情节如何推进、转折点/高潮在哪、前后因果、这段在全卷中的位置作用。
- theology（要义层）：**这是最重要的一题**。要触及整段经文的核心要义 ——
  神在这里显明了自己的什么？人的真实处境是什么？这段与救赎大叙事如何相连？
  绝对不能退化成事实性提问。
- application（处境层）：连接当下中国社会现象、互联网热点、他真实的生活张力。

【出题必须遵守的约束】
1. 禁止选择题、禁止判断题、禁止有唯一正确答案的问法。每题都必须是他要自己组织语言回答的主观题。
2. 至少 2 道题要用**他熟悉的文化载体**作桥（bridge 字段写明用了什么）：
   华语流行歌曲或赞美诗、电影、名著、社会热点事件、网络流行语。
   用法是"借它引发判断与思辨"，例如"某首歌里说……这段经文会同意这个说法吗？为什么？"
   注意：文化载体是引子，不是主角，问题的落点仍然必须在经文上。
3. 不要在题目里夹带答案，不要用"是不是因为……？"这种把答案塞进问题的问法。
4. 每题不超过 80 字，口语化，像一个朋友当面问你。

只输出 JSON：
{"questions":[{"layer":"fact","bridge":null,"question":"..."},
{"layer":"flow","bridge":null,"question":"..."},
{"layer":"theology","bridge":"电影《…》","question":"..."},
{"layer":"application","bridge":"热点：…","question":"..."}]}`;
}

/** 评分：四维度，决定是否解锁引导揭晓（R-D2） */
export function scorePrompt(input: {
  ref: string;
  passage: string;
  observation: string;
  questions: string;
  answers: string;
}): string {
  return `评估这位读者在读经灵修中的投入质量。你在做的不是批改作业，
而是判断"他是否真的自己思考过了" —— 达标就该放行，不要故意压分为难他。

经文出处：${input.ref}
经文正文：
${input.passage}

【他写的观察】
${input.observation || '（空）'}

【他自己提出的问题】
${input.questions || '（空）'}

【他对问题的作答】
${input.answers || '（空）'}

【四个维度，各 0-100 分】
- observation 观察准确度：是否真读了经文、抓到的是不是文本里真实存在的东西（不是凭印象编的）。
- inquiry 提问深度：他自己的问题是"字面疑问"还是"真困惑"。
  好问题的标志：触及张力、追问动机、对自己发问。空泛复述得低分。
- thesis 要义把握：是否触及整段的核心要义，而不只是停在情节表层。
- personal 个人化程度：是否与他自己的真实生命处境接上，而不是背诵正确的教会话语。

【评分尺度】
- 认真写了、有自己的话、方向没有大偏差 → 60-75，应当放行。
- 有真实困惑或真实自省 → 75-90。
- 空白、一两个词、复制经文、明显敷衍 → 0-40。
- 不要因为他神学表达不精准而扣分，他不是神学生。要因为他"没有自己想"而扣分。

【reason 怎么写】
一句话，直接对他说（用"你"），具体指出他哪里做到了、哪里还可以再往里走一步。
不要写"建议深入思考"这种空话。**每条 reason 严格控制在 50 字以内**，
encouragement 控制在 80 字以内 —— 输出太长会被截断。

只输出 JSON：
{"scores":[{"dimension":"observation","score":70,"reason":"..."},
{"dimension":"inquiry","score":65,"reason":"..."},
{"dimension":"thesis","score":60,"reason":"..."},
{"dimension":"personal","score":70,"reason":"..."}],
"encouragement":"两三句话的整体回应，诚实、具体、不谄媚"}`;
}

/** 引导揭晓：基于他自己的提问与笔记，因人而异（R-D3） */
export function guidePrompt(input: {
  ref: string;
  passage: string;
  observation: string;
  questions: string;
  answers: string;
  history?: string;
  notes?: string;
}): string {
  return `${COACH_PERSONA}

现在他已经完成了自己的思考，达到了解锁标准。你要开始引导他往更深处走。

经文出处：${input.ref}
经文正文：
${input.passage}

【他的观察】
${input.observation || '（空）'}

【他自己提出的问题 —— 你的回应必须从这里出发】
${input.questions || '（空）'}

【他的作答】
${input.answers || '（空）'}

${input.notes ? `【他在这段经文上的逐节笔记】\n${input.notes}\n` : ''}
${input.history ? `【他过去的灵修痕迹】\n${input.history}\n` : ''}

【这次回应的结构 —— 按顺序，不要写小标题，自然分段】
第一段：**回应他自己的提问**。挑他问得最有分量的那一个，告诉他这个问题问到了什么地方，
        为什么值得问。如果他问的方向偏了，不要说"你错了"，而是把他的问题往真正的张力上引。
第二段：**补充他必须知道但不可能自己看出来的知识**（背景、地理、原文词义、风俗、写作对象）。
        这部分可以直接给，说清楚。
第三段：**递给他一个更深的问题**。这个问题要基于他自己已经走到的位置，
        是他现在有能力接住、但还没想到的下一步。

【收尾】
不要总结，不要给结论，不要说"愿你……"。以那个问题收尾，留白给他。

总长度 350-550 字。不要用 Markdown 标记。`;
}

/** 教练多轮对话 */
export function coachTurnPrompt(input: { ref: string; passage: string; context: string }): string {
  return `${COACH_PERSONA}

当前经文：${input.ref}
${input.passage}

【背景：他这次灵修已经写下的内容】
${input.context}

继续与他对话。回应要短（150-250 字），承接他刚说的话，并以一个真问题结束。`;
}

/** 兜底追问：读完却没有任何感悟时，AI 主动发问（R-D5） */
export function nudgePrompt(input: { ref: string; passage: string; genre: string }): string {
  return `这位读者读完了 ${input.ref}，但没有写下任何感悟就想结束。
不能让他这样"读过"了。

经文正文：
${input.passage}

请提出 3 个问题把他拉回来。要求：
1. 极低门槛 —— 他此刻是想走的状态，问题必须是他"不用准备就能开口"的那种。
   从他的感受、他的经验、他的直觉入手，不要考知识。
2. 有钩子 —— 问那种"被问到就很难不想一下"的问题。
   比如经文里最刺人的一句、最不合常理的一个举动、他读的时候心里一闪而过的抵触。
3. 第三个问题要把经文和他今天真实的一天连起来。

不要说教，不要责备他没有感悟。像朋友随口一问。每题不超过 45 字。

只输出 JSON：{"questions":["...","...","..."]}`;
}

/** 结构化抽取：基本要素 + 时代背景 + 同期事件（R-C1 / R-C2） */
export function elementsPrompt(input: { ref: string; passage: string; genre: string }): string {
  return `对以下经文做结构化梳理，帮助读者记住"读过什么"。

经文出处：${input.ref}（传统分类：${input.genre}，仅供参考，请按实际文体判断）
经文正文：
${input.passage}

要求：
- people：出场人物。role 写他在这段里的身份作用，不是泛泛介绍。
- times：时间线索。包括明写的（"第七日""希律王的时候"）和可推断的年代。
- places：地点。note 里写清它的地理位置与当时的意义（为什么在这里发生有讲究）。
- plot：情节推进，3-6 步，每步一句话，要能看出因果链条。
- climax：高潮或转折点在哪一节，为什么是这里。
- background：时代背景 —— 政治、宗教、经济、社会状况，写读者不知道就读不懂的那些。
- contemporary：同时期参考事件。分两类，both 都要有：
  scripture 圣经内同时期的其他线索（别处经卷在讲同一时期的什么事）、
  world 世俗历史上同时期世界上在发生什么（中国当时是什么朝代也要写，这对中国读者特别有帮助）。
- thesis：整段经文的核心要义，一到两句，说神在这里显明了什么。
- reflection：这段经文照见的社会现象或人性处境，2-3 条，要具体，能接上当代中国读者的生活。

年代不确定时写"约公元前X世纪"并说明是推断，不要编造精确年份。

只输出 JSON：
{"people":[{"name":"","role":""}],
"times":[{"label":"","note":""}],
"places":[{"name":"","note":""}],
"plot":["",""],
"climax":{"verse":0,"why":""},
"background":"",
"contemporary":{"scripture":["",""],"world":["",""]},
"thesis":"",
"reflection":["",""]}`;
}

/** 上下文透视：前 10 节与后 10 节对本节的影响（R-B4） */
export function contextPrompt(input: {
  ref: string;
  verseText: string;
  before: string;
  after: string;
}): string {
  return `读者正在细读这一节：${input.ref}
「${input.verseText}」

【前文（本节之前的经文）】
${input.before || '（本节位于开头，无前文）'}

【后文（本节之后的经文）】
${input.after || '（本节位于结尾，无后文）'}

请说明上下文如何影响这一节的理解：
- before_effect：前文如何铺垫这一节 —— 没有前文，这节会被误读成什么？
- after_effect：后文如何回应、印证或反转这一节 —— 后面发生的事让这节的分量有什么变化？
- hinge：这一节在整段里承担什么功能（承接/转折/高潮/总结/伏笔），一句话。
- misread：脱离上下文单独引用这一节，最常见的误读是什么。这条要具体，很多人正是这样断章取义的。
- cn_en：中英文对照差异。英文译本（KJV）在这一节的用词，与和合本相比，
  哪个词值得注意、透露了什么原文的意思。若无明显差异就说明"两者一致"。

只输出 JSON：
{"before_effect":"","after_effect":"","hinge":"","misread":"","cn_en":""}`;
}

/** 知识图谱：节点 + 关系（R-C3） */
export function graphPrompt(input: { ref: string; passage: string }): string {
  return `把以下经文转成知识图谱数据。

经文出处：${input.ref}
经文正文：
${input.passage}

要求：
- 节点 8-16 个，type 取值：person（人物）/ place（地点）/ event（事件）/ time（时间）/ theme（主题）。
- 至少要有 1 个 theme 节点，代表这段的核心要义，让图谱不只是事实堆叠。
- 边要写清关系动词（"呼召""逃往""献祭给""质问"），不要用"相关""关联"这种没有信息量的词。
- 边的数量至少与节点数相当，让图连通，不要出现孤立节点。
- weight 表示这条关系在本段中的重要程度 1-3。

只输出 JSON：
{"nodes":[{"id":"n1","label":"","type":"person","note":"一句话说明"}],
"edges":[{"from":"n1","to":"n2","label":"","weight":2}]}`;
}

/** 思维导图：树形结构（R-C4） */
export function mindmapPrompt(input: { ref: string; passage: string }): string {
  return `把以下经文整理成思维导图。

经文出处：${input.ref}
经文正文：
${input.passage}

要求：
- 根节点是经文出处。
- 第二层 4-6 个分支，建议涵盖：情节脉络、关键人物、核心要义、时代背景、给我的问题。
- 第三层每个分支下 2-4 个子节点，写具体内容而不是标签。
- 叶子节点文字精炼，每个不超过 18 字，便于画在图上。

只输出 JSON（children 可递归，最多三层）：
{"label":"${input.ref}","children":[{"label":"","children":[{"label":""}]}]}`;
}

/** 文生图：为经文生成意境配图的绘画提示词 */
/**
 * 选段配图：他自己挑的那几节，直接把原文交给画图模型。
 * 不绕"要素梳理"那一趟 —— 省掉一次 AI 调用（快一半），画出来也更贴合他圈的这几节。
 */
export function imagePromptFromText(ref: string, text: string): string {
  return `圣经场景插画，${ref}。
经文：${text}
照经文描述的场景作画，以其中最具画面感的一刻为主体。
风格：古典油画质感，柔和暖色光线，庄重肃穆，写实但带诗意，广角构图，
不出现任何文字、不出现现代物品、不描绘神的面容。`;
}

export function imagePromptFor(ref: string, thesis: string, places: string[]): string {
  return `圣经场景插画，${ref}。主题：${thesis}。
场景元素：${places.join('、') || '古代近东旷野'}。
风格：古典油画质感，柔和暖色光线，庄重肃穆，写实但带诗意，广角构图，
不出现任何文字、不出现现代物品、不描绘神的面容。`;
}
