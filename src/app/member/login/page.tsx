import { redirect } from "next/navigation";
import { auth, signIn, DEV_LOGIN_ENABLED } from "@/auth";
import { CLUB_NAME } from "@/lib/config";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  NotAllowed: "That Google account isn't on the eboard list. Ask an admin to add your email, then try again.",
  AccessDenied: "That Google account isn't on the eboard list. Ask an admin to add your email, then try again.",
  Configuration: "Google sign-in isn't configured yet. Check AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET and AUTH_SECRET.",
  OAuthCallbackError: "Google sign-in was cancelled or failed. Please try again.",
};

export default async function LoginPage({ searchParams }: PageProps<"/member/login">) {
  const session = await auth();
  if (session?.user?.email) redirect("/member");
  const { error } = await searchParams;
  const message = typeof error === "string" ? (ERRORS[error] ?? "Sign-in failed. Please try again.") : null;

  return (
    <main className="mx-auto max-w-md px-4 py-20">
      <div className="card p-8">
        <h1 className="text-2xl font-bold text-stone-900">{CLUB_NAME} eboard sign in</h1>
        <p className="mt-2 text-sm text-stone-600">
          Sign in with the Google account you want coffee chats scheduled on. We&apos;ll ask for permission to add events to your calendar
          and to check when you&apos;re busy.
        </p>
        {message && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>}
        <form
          className="mt-6"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/member" });
          }}
        >
          <button type="submit" className="btn-primary w-full">Continue with Google</button>
        </form>
        {DEV_LOGIN_ENABLED && (
          <form
            className="mt-6 rounded-lg border border-dashed border-stone-300 p-4"
            action={async (fd: FormData) => {
              "use server";
              await signIn("dev-login", { email: String(fd.get("email") ?? ""), redirectTo: "/member" });
            }}
          >
            <div className="label">Dev login (local only)</div>
            <div className="flex gap-2">
              <input name="email" type="email" required className="input" placeholder="eboard@school.edu" />
              <button className="btn-secondary whitespace-nowrap">Sign in</button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
