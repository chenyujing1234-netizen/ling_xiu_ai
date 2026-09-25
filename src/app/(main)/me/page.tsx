import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { summaryOf } from '@/lib/stats';
import { getSettings } from '@/lib/bible';
import LogoutButton from '@/components/LogoutButton';
import AdminMeLink from '@/components/AdminMeLink';
import ShareAppBlock from '@/components/ShareAppBlock';
import {
  IconChevronRight,
  IconFlame,
  IconLock,
  IconNotes,
  IconSettings,
  IconTile,
} from '@/components/Ui';

export default async function MePage() {
  const session = await getSession();
  const [s, settings] = await Promise.all([summaryOf(session!.uid), getSettings(session!.uid)]);
  const appUrl = process.env.APP_URL?.replace(/\/$/, '') || 'https://linkpal.cloud';

  const links = [
    {
      href: '/me/notes',
      label: '我的读经笔记',
      desc: `${s.totalNotes} 条`,
      icon: <IconNotes size={20} />,
    },
    {
      href: '/devotion',
      label: '我的灵修记录',
      desc: `完成 ${s.totalDevotions} 次 · 平均 ${s.avgScore} 分`,
      icon: <IconFlame size={20} />,
    },
    {
      href: '/me/settings',
      label: '读经与外观',
      desc: `每日 ${settings.daily_chapters} 章 · 可换界面风格`,
      icon: <IconSettings size={20} />,
    },
    {
      href: '/me/password',
      label: '修改密码',
      desc: '定期更换更安全',
      icon: <IconLock size={20} />,
    },
  ];

  return (
    <div className="px-4 py-5">
      <header className="mb-5 flex items-center gap-3.5">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 text-xl font-bold text-white shadow-soft">
          {session!.name.slice(0, 1)}
        </div>
        <div>
          <p className="text-[19px] font-bold">{session!.name}</p>
          <p className="mt-0.5 text-xs text-muted">
            {session!.role === 'admin' ? '管理员' : '成员'} · 连续读经 {s.streak} 天
          </p>
        </div>
      </header>

      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="card flex items-center gap-3 px-4 py-3.5 active:bg-brand-50">
              <IconTile>{l.icon}</IconTile>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold">{l.label}</p>
                <p className="mt-0.5 text-xs font-medium text-muted">{l.desc}</p>
              </div>
              <IconChevronRight className="shrink-0 text-muted" />
            </Link>
          </li>
        ))}

        {session!.role === 'admin' && <AdminMeLink />}
        <ShareAppBlock appUrl={appUrl} />
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
