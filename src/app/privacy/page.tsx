import { APP_TITLE, CLUB_NAME } from "@/lib/config";

export const metadata = { title: `Privacy · ${APP_TITLE}` };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold text-stone-900">Privacy Policy</h1>
      <p className="mt-2 text-sm text-stone-500">Last updated September 2026</p>
      <div className="prose prose-stone mt-6 max-w-none text-stone-700 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-stone-900 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6">
        <p>
          {APP_TITLE} is a scheduling tool run by the {CLUB_NAME} student club. It lets students book short conversations with club board
          members. This page explains what information the tool handles and why.
        </p>

        <h2>Information from students who book a chat</h2>
        <ul>
          <li>Name, email address, and class year, so a board member can be matched and a calendar invite can be sent.</li>
          <li>An optional note about what you would like to discuss, shared with your host.</li>
        </ul>

        <h2>Information from board members who sign in with Google</h2>
        <ul>
          <li>Your Google account name, email address, and profile picture, used to identify you in the tool.</li>
          <li>
            Google Calendar access, used only to (a) add a calendar event for each chat you host, with the student as a guest, and (b)
            check when you are busy so those times are not offered to students. The tool never reads event titles, descriptions, or
            attendees of your other events, and never modifies events it did not create.
          </li>
          <li>A long-lived sign-in token, stored so events can be created when a student books while you are offline. You can revoke it
            at any time at <a className="underline" href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>.</li>
        </ul>

        <h2>How information is used</h2>
        <p>
          Only to schedule chats, send the related calendar invites and confirmation emails, and let the club&apos;s board review how
          chats went. Board members may record short private notes after a chat, which are visible only to club board administrators.
          Information is never sold or shared with third parties beyond the services needed to run the tool (hosting, database, and
          email delivery).
        </p>

        <h2>Retention and deletion</h2>
        <p>
          Records are kept for the duration of the club&apos;s recruiting activities. To have your information removed, email the club
          at the address on the club&apos;s website or the address your invite came from, and it will be deleted.
        </p>

        <h2>Google API Services</h2>
        <p>
          This tool&apos;s use of information received from Google APIs adheres to the{" "}
          <a className="underline" href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noreferrer">
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>
      </div>
    </main>
  );
}
