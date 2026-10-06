import { getSession } from '@/lib/auth';
import { getSettings } from '@/lib/bible';
import DevotionFlow from '@/components/DevotionFlow';

export default async function DevotionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  const settings = await getSettings(session!.uid);
  const unlockScore = Number(process.env.DEVOTION_UNLOCK_SCORE || 40);
  const showTour = !settings.guide_seen;
  return <DevotionFlow id={Number(id)} showTour={showTour} unlockScore={unlockScore} />;
}
