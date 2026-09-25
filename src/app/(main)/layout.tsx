import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import BottomTab from '@/components/BottomTab';
import LastPathTracker from '@/components/LastPathTracker';
import { getSession } from '@/lib/auth';
import { countPendingAccessRequests } from '@/lib/admin-pending';
import { getSettings } from '@/lib/bible';
import AdminPendingProvider from '@/components/AdminPendingProvider';
import FontScaleSync from '@/components/FontScaleSync';
import SubpageBackBar from '@/components/SubpageBackBar';
import ThemeSync from '@/components/ThemeSync';
import { normalizeFontScale } from '@/lib/font-scale';
import OnboardingGuide from '@/components/OnboardingGuide';
import { BackgroundJobsProvider } from '@/components/BackgroundJobsProvider';
import { normalizeTheme } from '@/lib/themes';

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  // 中间件已挡过一层；这里再查一次数据库，确保被停用的账号立即失效（R-A1）。
  // 强制改密的跳转由中间件负责，避免与改密页本身互相重定向。
  if (!session) redirect('/login');

  const settings = await getSettings(session.uid);
  const theme = normalizeTheme(settings.theme);
  const fontScale = normalizeFontScale(settings.font_scale);
  const isAdmin = session.role === 'admin';
  const pendingRequests = isAdmin ? await countPendingAccessRequests() : 0;
  const showOnboarding = !settings.guide_seen;

  return (
    <BackgroundJobsProvider>
    <AdminPendingProvider isAdmin={isAdmin} initialPending={pendingRequests}>
      <OnboardingGuide
        show={showOnboarding}
        unlockScore={Number(process.env.DEVOTION_UNLOCK_SCORE || 40)}
      />
      <ThemeSync theme={theme} />
      <FontScaleSync fontScale={fontScale} />
      <Suspense fallback={null}>
        <LastPathTracker />
      </Suspense>
      <main className="page page-canvas">
        <Suspense fallback={null}>
          <SubpageBackBar />
        </Suspense>
        {children}
      </main>
      <BottomTab />
    </AdminPendingProvider>
    </BackgroundJobsProvider>
  );
}
