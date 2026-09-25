/**
 * 灵修 LLM 固定检索的 book_rag 知识库。
 * 不再按经文名/关键词临时挑选；能用尽用，管理员可在后台开关。
 */

export type RagKbCategory =
  | 'bible'
  | 'commentary'
  | 'creed'
  | 'theology'
  | 'history'
  | 'devotion'
  | 'preaching'
  | 'gospel'
  | 'life'
  | 'culture'
  | 'care';

export type RagKbEntry = {
  id: string;
  name: string;
  category: RagKbCategory;
  why: string;
};

export const RAG_KB_CATEGORY_LABEL: Record<RagKbCategory, string> = {
  bible: '圣经文本',
  commentary: '经卷注释与查经',
  creed: '信经与要理',
  theology: '教义与系统神学',
  history: '教会历史与背景',
  devotion: '灵修、祷告与敬虔',
  preaching: '讲道与牧养',
  gospel: '福音、护教与门训',
  life: '生活、家庭与教育',
  culture: '历史文化与处境',
  care: '人心与沟通（牧养辅助）',
};

export const RAG_KB_CATALOG: RagKbEntry[] = [
  { id: 'e8ec2c8d-5a8f-4999-a4f2-ff42d6bf54ce', name: '和合本修订版', category: 'bible', why: '圣经文本与原文' },
  { id: 'f52985ff-5413-43f5-910b-ca61cee0f3bb', name: '希腊文新约圣经_westcott__hort版holybiblegreeknewtestamentwescott-hort', category: 'bible', why: '圣经文本与原文' },
  { id: '1722a40c-838a-41d9-bc43-5480236c6134', name: '20 雅各书研经--冯国泰', category: 'commentary', why: '经卷注释、讲义或叙事' },
  { id: 'c2d03e34-881e-46f9-a470-19de880abe52', name: 'M5878 圣经结构式注释 雅各书 李保罗', category: 'commentary', why: '经卷注释、讲义或叙事' },
  { id: 'ac035457-6e7d-4973-b7f7-4749f7ef6e64', name: '《大卫宝库一》查尔斯司布真著 有书签', category: 'commentary', why: '经卷注释、讲义或叙事' },
  { id: '2fd8482f-db4c-42bd-982f-add719fead6f', name: '《雅各书》小组书卷专题查经课程 卫斯理（A4', category: 'commentary', why: '经卷注释、讲义或叙事' },
  { id: '7a1f0f08-4253-4f25-8a8a-1606829c6ce0', name: '三个国王的故事', category: 'commentary', why: '经卷注释、讲义或叙事' },
  { id: 'e1cded42-e0c7-44f8-ba13-3e28e1667f77', name: '以弗所书注释史普罗Ephesians-Sproul-FINAL-PDF', category: 'commentary', why: '经卷注释、讲义或叙事' },
  { id: '26640456-ae21-4f60-b1fa-9765ddc8d6c5', name: '使徒行传讲义', category: 'commentary', why: '经卷注释、讲义或叙事' },
  { id: '00150051-49d0-40f4-a909-e123b55c75a6', name: '加拉太书注释', category: 'commentary', why: '经卷注释、讲义或叙事' },
  { id: 'df214e68-e943-4998-9065-7ae278bb28b9', name: '唐崇荣-雅各书-06', category: 'commentary', why: '经卷注释、讲义或叙事' },
  { id: '0d9d8c64-ed61-45ea-a637-481a3499c13d', name: '基督释放我们 得自由 ——史普罗加拉太书解经注释FINAL-PDF-加拉太书_Galatians-12-05-23', category: 'commentary', why: '经卷注释、讲义或叙事' },
  { id: '8a5ce0ad-8000-420b-a562-01644360fd98', name: '雅各书注释(未知来源)', category: 'commentary', why: '经卷注释、讲义或叙事' },
  { id: 'e329e1dd-ec88-418e-b82f-2266dcb89e6b', name: '马大和马利亚', category: 'commentary', why: '经卷注释、讲义或叙事' },
  { id: '2a417ab7-a1ff-4aa7-9ff8-72933e254dd7', name: '《使徒信经》简释', category: 'creed', why: '信经与要理问答' },
  { id: 'c846815b-acdc-48b8-989f-7014586a4c93', name: '《海德堡要理问答》附经文和解释', category: 'creed', why: '信经与要理问答' },
  { id: '9dca6ca0-7df7-40eb-b3ee-7fcac0bdc378', name: '《海德堡要理问答》附经文和解释 (1)', category: 'creed', why: '信经与要理问答' },
  { id: '3fd94357-6fb1-44f0-bc4d-5553496cc3d7', name: '亚他那修信经简释', category: 'creed', why: '信经与要理问答' },
  { id: '78a3c88d-8ca3-44fd-a60e-4cf7a97b2551', name: '威斯敏斯特标准西敏信仰告白大小要理问答RTF-Westminster-Standards-FINAL-DIGITAL', category: 'creed', why: '信经与要理问答' },
  { id: '358fabe7-7e2c-4adc-9c9f-93df30fbf9d3', name: '25_《预定论的方式与次序》电子书终稿——20240416', category: 'theology', why: '教义与系统神学' },
  { id: '61914e6b-a7f6-48d6-9fc6-0d780e2d9953', name: '《新情感的驱逐力》电子书终稿——20240519-R2', category: 'theology', why: '教义与系统神学' },
  { id: '102456e9-d33c-4b87-98de-fe7df2a21c5d', name: '三一神论', category: 'theology', why: '教义与系统神学' },
  { id: '03a74994-dbf8-485f-acde-cfc54577303c', name: '与我们立约的神-God-to-Us-FINAL-PDF-DIGITAL-2', category: 'theology', why: '教义与系统神学' },
  { id: '195e6483-7ea7-4ee4-aea7-5fdf6e9c8d48', name: '主曾晓谕：无误圣经', category: 'theology', why: '教义与系统神学' },
  { id: '1d52bb05-b1cb-4eb6-bb8f-928b21540200', name: '主曾晓谕：无误圣经 (1)', category: 'theology', why: '教义与系统神学' },
  { id: 'eafc929a-ed74-4b2b-9234-5bd53dfdf969', name: '主的筵席', category: 'theology', why: '教义与系统神学' },
  { id: '1bf72ca6-df0c-44fb-9f51-6650a7b88d29', name: '主的筵席 (1)', category: 'theology', why: '教义与系统神学' },
  { id: '134e77c1-c08a-488f-a0a0-204abd16ee7e', name: '人文主义批判', category: 'theology', why: '教义与系统神学' },
  { id: 'c1cc38e3-892b-471c-ab57-ece6f6dd107b', name: '什么是预定论？ 史普罗', category: 'theology', why: '教义与系统神学' },
  { id: '25fe07fd-b4c8-42d0-8434-8e6b2784490e', name: '信仰的深情', category: 'theology', why: '教义与系统神学' },
  { id: 'e7441fc5-1f1c-4384-8073-ad66b1e95fdb', name: '信心', category: 'theology', why: '教义与系统神学' },
  { id: '21575d74-415f-4b21-9da6-18ec19be86ee', name: '信心与重生', category: 'theology', why: '教义与系统神学' },
  { id: '1849d464-95b5-497a-b719-1676889362a7', name: '再思救赎奇恩', category: 'theology', why: '教义与系统神学' },
  { id: '902de591-9507-44e2-acd2-218ed6015ed1', name: '加尔文主义讲座', category: 'theology', why: '教义与系统神学' },
  { id: 'b253664c-08b3-44df-a9f5-8fdafdd5ae5b', name: '加尔文主义讲座 (1)', category: 'theology', why: '教义与系统神学' },
  { id: 'a6611958-a0c9-4fda-bd98-e3ff1e35cae7', name: '相信悔改不可分开', category: 'theology', why: '教义与系统神学' },
  { id: 'fb47d06d-0e20-4cae-b79f-d4e2ac182bdb', name: '神学文集+Vol-11', category: 'theology', why: '教义与系统神学' },
  { id: '38a7bea1-3843-450d-9efd-b89295d66ba9', name: '自由意志', category: 'theology', why: '教义与系统神学' },
  { id: '512b1677-944a-4423-ae6e-92c65cdc6143', name: '《清教徒金句宝藏》中文版_电子书终稿——20250113_R2-1', category: 'history', why: '历史与传统' },
  { id: '500a7691-5fd3-4034-bf97-8d0772d3e36e', name: '初代教会史', category: 'history', why: '历史与传统' },
  { id: 'b3b893c1-938f-41f8-bec6-64ff3f54ef80', name: '基督大能两千年早期教父时代Needham-VOL1-FINAL-PDF-DIGITAL-1', category: 'history', why: '历史与传统' },
  { id: '503697da-6196-47a0-b28f-4378d32f406d', name: '完全跟随神清教徒简介FOLLOWING-GOD-FULLY-FINAL-PDF-DIGITAL', category: 'history', why: '历史与传统' },
  { id: '083069f0-9c2c-482a-98ca-7ca3e19953a0', name: '犹太古史', category: 'history', why: '历史与传统' },
  { id: '917baa66-398b-411a-b2d5-154c783c08ce', name: '32_《基督徒生活之道》电子书终稿_——20241028_R2', category: 'devotion', why: '灵修、祷告与敬虔' },
  { id: '4fe3bd81-e664-48ee-bf57-50e291d3def1', name: '37.《真敬虔之路》电子书终稿-20250315-R1', category: 'devotion', why: '灵修、祷告与敬虔' },
  { id: '1416d303-1b3c-46ac-901d-d0b0a732ca8f', name: '与基督相交', category: 'devotion', why: '灵修、祷告与敬虔' },
  { id: 'c068e584-b3ff-429f-8dfd-cc46c7385f6f', name: '与撒但争战', category: 'devotion', why: '灵修、祷告与敬虔' },
  { id: 'd9c42f40-48c1-4660-9262-c386f96f00b3', name: '作完全人', category: 'devotion', why: '灵修、祷告与敬虔' },
  { id: 'f13a4abd-2469-424e-85d1-5511f6e9b8f9', name: '内在生活', category: 'devotion', why: '灵修、祷告与敬虔' },
  { id: '83f1fdfa-e0c4-4771-af76-be0e35762c30', name: '司布真 怎么祷告', category: 'devotion', why: '灵修、祷告与敬虔' },
  { id: 'd397ae7e-76a1-4217-a7cd-f6a867816632', name: '司布真 怎么读圣经', category: 'devotion', why: '灵修、祷告与敬虔' },
  { id: 'ad525d59-55c8-4932-adbc-bf8e7b899989', name: '在灵里拾取麦穗', category: 'devotion', why: '灵修、祷告与敬虔' },
  { id: 'e123f360-f313-4ee2-a889-a8774fe668d8', name: '培养健康的祷告生活周必克 (1)', category: 'devotion', why: '灵修、祷告与敬虔' },
  { id: '01b38ed8-d184-476f-8ef7-7ba1b95b9491', name: '磐石之上-大字版', category: 'devotion', why: '灵修、祷告与敬虔' },
  { id: 'db255a9f-7624-4314-bd51-f218a48260d9', name: '荒漠甘泉', category: 'devotion', why: '灵修、祷告与敬虔' },
  { id: '5e8716f0-a340-48fe-9a87-d2600bf9a549', name: '谦卑 慕安得烈', category: 'devotion', why: '灵修、祷告与敬虔' },
  { id: 'a6b2980d-2a2c-45d9-a8de-cd944493b2bd', name: '走向十字架上的真', category: 'devotion', why: '灵修、祷告与敬虔' },
  { id: 'f76eda4d-ac55-4796-8f85-3142fddc26ef', name: '(9B)仰望的人--司布真', category: 'preaching', why: '讲道与牧养' },
  { id: '3c4662bc-30bc-4b45-b034-b8248b1585de', name: '29.《狱中的话》电子书终稿——20240615-R2 (1)', category: 'preaching', why: '讲道与牧养' },
  { id: '63ab526b-be62-4356-9f09-7cb2264a6930', name: 'wangYi', category: 'preaching', why: '讲道与牧养' },
  { id: 'e2d92eb4-32ef-4a33-88bf-14959fdbb6ca', name: '《众弟子啊，你们当来》—司布真', category: 'preaching', why: '讲道与牧养' },
  { id: 'b6d3ecb0-7de7-4235-9d7c-2230dd6b9ae2', name: '一篇切合当前的讲道', category: 'preaching', why: '讲道与牧养' },
  { id: 'fdbdb972-0ddb-459a-9795-7d536cd49c01', name: '儿童讲道集', category: 'preaching', why: '讲道与牧养' },
  { id: '3fceb63f-6d7d-45a6-a0a2-885ae716d483', name: '司不真 牧师疲乏', category: 'preaching', why: '讲道与牧养' },
  { id: 'dbd2c685-5230-4ce5-af5f-cf50c65fe8bb', name: '司布真', category: 'preaching', why: '讲道与牧养' },
  { id: '60069c92-8d57-4db7-9cb7-4b880ad182c4', name: '司布真 为真理果断', category: 'preaching', why: '讲道与牧养' },
  { id: '062d658d-fffa-477f-a13d-87a97efe736e', name: '司布真 讲道内容', category: 'preaching', why: '讲道与牧养' },
  { id: '8fd0dfbf-6f24-4552-a377-8f19b2684f8e', name: '司布真2', category: 'preaching', why: '讲道与牧养' },
  { id: 'f64cc26f-2432-43ac-9cf4-ddb7bf32f4b0', name: '司布真劝告', category: 'preaching', why: '讲道与牧养' },
  { id: '29be4b58-bb07-4d59-90bb-4626a3ce34a4', name: '痛棒下沉默的基督徒 (1)', category: 'preaching', why: '讲道与牧养' },
  { id: '459c2c3d-265d-4ba1-8044-f71d94337230', name: '都是恩典-司布真', category: 'preaching', why: '讲道与牧养' },
  { id: 'a0dbe1b1-6fc8-4563-b238-a87a3057af7c', name: '《活出热情》约翰派博', category: 'gospel', why: '福音、护教与门训' },
  { id: '68849e31-d6a3-4295-9187-475f3d4fab6a', name: '《论良心》电子书终稿_20230815 (1)', category: 'gospel', why: '福音、护教与门训' },
  { id: '6ab1755f-20b4-4065-a92e-47818abf7410', name: '《论贪婪》古旧福音20230826终稿 (1)', category: 'gospel', why: '福音、护教与门训' },
  { id: 'd391cd44-b467-4d8a-922e-fe30aac5e3b9', name: '传福音常遇见的难题', category: 'gospel', why: '福音、护教与门训' },
  { id: 'f0f4b585-9cd6-4761-bcd4-164f3079ca25', name: '你是活人还是死人', category: 'gospel', why: '福音、护教与门训' },
  { id: 'b2a3d8f7-c421-4b0c-911e-f37805c0aafe', name: '十一奉献', category: 'gospel', why: '福音、护教与门训' },
  { id: '714901f3-cba2-415e-9ebe-0ae09e223657', name: '捕鸟人的网罗', category: 'gospel', why: '福音、护教与门训' },
  { id: 'b931c140-b428-4581-84ce-cc211b4c5224', name: '游子吟', category: 'gospel', why: '福音、护教与门训' },
  { id: 'e39438d0-c48c-4763-96f0-f49650e5af29', name: '家庭习惯', category: 'life', why: '生活、家庭与教育' },
  { id: 'd1aac1d1-3ea0-420a-9f08-d7ff36644a80', name: '教育', category: 'life', why: '生活、家庭与教育' },
  { id: '7616e65f-da39-4efc-b587-5dd4bf41a7d9', name: '《我看见的世界》【豆瓣评分9.1】', category: 'culture', why: '历史文化与处境' },
  { id: 'fcf49e52-0eea-4624-8c38-b57b274df574', name: '中国文化的深层结构 孙隆基著', category: 'culture', why: '历史文化与处境' },
  { id: '4b2b3fd8-a13f-42e5-a3bb-2838eadb75af', name: '中文公版书', category: 'culture', why: '历史文化与处境' },
  { id: 'abf56019-eaec-4844-968c-2890d2f6ae5f', name: '《影响力》罗伯特·西奥迪尼', category: 'care', why: '人心与沟通（牧养辅助）' },
  { id: 'bc82b592-edee-4672-a420-329873d8da4d', name: '《逻辑表达：高效沟通的金字塔思维》张巍', category: 'care', why: '人心与沟通（牧养辅助）' },
  { id: '44cb9871-cc94-4f23-a2c5-8cacee7a4e0d', name: '发展心理学：探索人生发展的轨迹', category: 'care', why: '人心与沟通（牧养辅助）' },
  { id: 'bd98ec56-5ef7-4309-8890-5d0ee8ac4a3e', name: '同理心：做个让人舒服的共情高手', category: 'care', why: '人心与沟通（牧养辅助）' },
  { id: '58cf7f03-bda8-460a-ac6d-a9897dadb8e5', name: '思考，快与慢中文版', category: 'care', why: '人心与沟通（牧养辅助）' },
  { id: 'e55211e6-2a6a-4094-b4ad-b7993b49328b', name: '情商：为什么情商比智商更重要', category: 'care', why: '人心与沟通（牧养辅助）' },
  { id: '5b80e61a-cdcc-4f5e-b1ce-2684d8634c90', name: '情绪急救', category: 'care', why: '人心与沟通（牧养辅助）' },
  { id: 'adc0e852-7411-4f74-a940-a109173cafe9', name: '罗纳德·b·阿德勒《沟通的艺术：看入人里看出人外》', category: 'care', why: '人心与沟通（牧养辅助）' },
  { id: 'b56d9b56-2599-4a7a-82dc-a006869ccf8e', name: '非暴力沟通 (美) 马歇尔.卢森堡', category: 'care', why: '人心与沟通（牧养辅助）' },
];

const byId = new Map(RAG_KB_CATALOG.map((e) => [e.id, e]));

export function ragKbById(id: string): RagKbEntry | undefined {
  return byId.get(id);
}

export function defaultRagKbIds(): string[] {
  return RAG_KB_CATALOG.map((e) => e.id);
}

export const RAG_KB_CATEGORY_ORDER: RagKbCategory[] = [
  'bible', 'commentary', 'creed', 'theology', 'history', 'devotion', 'preaching', 'gospel', 'life', 'culture', 'care',
];
