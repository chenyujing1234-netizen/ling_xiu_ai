import DevotionFlow from '@/components/DevotionFlow';

export default async function DevotionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DevotionFlow id={Number(id)} />;
}
