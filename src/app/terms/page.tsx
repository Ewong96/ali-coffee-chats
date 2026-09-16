import { APP_TITLE, CLUB_NAME } from "@/lib/config";

export const metadata = { title: `Terms · ${APP_TITLE}` };

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold text-stone-900">Terms of Use</h1>
      <p className="mt-2 text-sm text-stone-500">Last updated September 2026</p>
      <div className="mt-6 space-y-3 text-stone-700">
        <p>{APP_TITLE} is provided by the {CLUB_NAME} student club to schedule informal conversations between students and club board members.</p>
        <p>By booking a chat you agree to provide accurate contact details and to attend the time you booked, or to let your host know if you cannot make it.</p>
        <p>The tool is offered as is, without warranties. The club may cancel or reschedule chats and may change or discontinue the tool at any time.</p>
        <p>
          Your information is handled as described in the <a className="underline" href="/privacy">Privacy Policy</a>.
        </p>
      </div>
    </main>
  );
}
