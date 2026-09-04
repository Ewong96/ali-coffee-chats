import Link from "next/link";
import { currentMember } from "@/auth";
import { APP_TITLE } from "@/lib/config";

export default async function Header() {
  let me: Awaited<ReturnType<typeof currentMember>> = null;
  try {
    me = await currentMember();
  } catch {
    me = null;
  }
  return (
    <header className="border-b border-stone-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold text-stone-900">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-800 text-white">☕</span>
          {APP_TITLE}
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/" className="rounded-md px-3 py-1.5 text-stone-600 hover:bg-stone-100 hover:text-stone-900">Book a chat</Link>
          <Link href="/member" className="rounded-md px-3 py-1.5 text-stone-600 hover:bg-stone-100 hover:text-stone-900">
            {me ? "My availability" : "Eboard login"}
          </Link>
          {me?.isAdmin && (
            <Link href="/admin" className="rounded-md px-3 py-1.5 text-stone-600 hover:bg-stone-100 hover:text-stone-900">Admin</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
