import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { allBooks } from '@/lib/bible';
import AdminPanel from '@/components/AdminPanel';

export default async function AdminPage() {
  const session = await getSession();
  if (session?.role !== 'admin') redirect('/');

  const books = (await allBooks()).map((b) => ({ id: b.id, name: b.name_cn, chapters: b.chapters }));
  return <AdminPanel books={books} />;
}
