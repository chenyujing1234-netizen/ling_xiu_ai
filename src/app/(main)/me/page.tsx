import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { summaryOf } from '@/lib/stats';
import { getSettings, refLabel } from '@/lib/bible';
import LogoutButton from '@/components/LogoutButton';

export default async function MePage() {
  const session = await getSession();
  const s = summaryOf(session!.uid);
  const settings = getSettings(session!.uid);

  const links = [
    { href: '/me/notes', label: '我的读经笔记', desc: `${s.totalNotes} 条 · ${s.godSpokeCount} 处神对我说话` },
    { href: '/devotion', label: '我的灵修记录', desc: `完成 ${s.totalDevotions} 次 · 平均 ${s.avgScore} 分` },
    { href: '/me/settings', label: '读经设置', desc: `每日 ${settings.daily_chapters} 章 · 进度在 ${refLabel(settings.cursor_book, settings.cursor_chapter)}` },
    { href: '/me/password', label: '修改密码', desc: '定期更换更安全' },
  ];

  return (
    <div className="px-4 py-5">
      <header className="mb-5 flex items-center gap-3.5">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 text-xl font-medium text-white">
          {session!.name.slice(0, 1)}
        </div>
        <div>
          <p className="text-[19px] font-semibold">{session!.name}</p>
          <p className="mt-0.5 text-xs text-muted">
            {session!.role === 'admin' ? '管理员' : '成员'} · 连续读经 {s.streak} 天
          </p>
        </div>
      </header>

      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="card flex items-center justify-between px-4 py-3.5 active:bg-brand-50">
              <div>
                <p className="text-[15px] font-medium">{l.label}</p>
                <p className="mt-0.5 text-xs text-muted">{l.desc}</p>
              </div>
              <span className="text-muted">›</span>
            </Link>
          </li>
        ))}

        {session!.role === 'admin' && (
          <li>
            <Link href="/admin" className="card flex items-center justify-between px-4 py-3.5 active:bg-brand-50">
              <div>
                <p className="text-[15px] font-medium text-accent">管理后台</p>
                <p className="mt-0.5 text-xs text-muted">审批申请 · 分配密码 · 讲道资源</p>
              </div>
              <span className="text-muted">›</span>
            </Link>
          </li>
        )}
      </ul>

      <LogoutButton />

      <p className="mt-6 text-center text-[11px] leading-relaxed text-muted">
        经文：新标点和合本（简体）· 英文：KJV
        <br />
        仅供受邀弟兄姊妹内部学习使用
      </p>
    </div>
  );
}

export const dynamic = 'force-dynamic';
