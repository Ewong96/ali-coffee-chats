"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelBooking } from "@/app/actions/member";
import { fmtDateTime, tzAbbrev } from "@/lib/time";

export type ChatRow = {
  id: string;
  studentName: string;
  studentEmail: string;
  studentNotes: string;
  startsAt: string;
  mode: "in_person" | "virtual";
  location: string;
  calendarError: string | null;
  hostName?: string;
};

export default function UpcomingChats({ bookings, showHost = false }: { bookings: ChatRow[]; showHost?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!bookings.length) return <p className="text-sm text-stone-500">No upcoming chats yet. Once students book, they&apos;ll show up here.</p>;

  return (
    <div>
      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <ul className="divide-y divide-stone-100">
        {bookings.map((b) => {
          const d = new Date(b.startsAt);
          const isLink = /^https?:\/\//.test(b.location);
          return (
            <li key={b.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="font-medium text-stone-900">
                  {fmtDateTime(d)} <span className="text-stone-400">{tzAbbrev(d)}</span>
                </div>
                <div className="text-sm text-stone-700">
                  {b.studentName} · <a className="underline decoration-stone-300" href={`mailto:${b.studentEmail}`}>{b.studentEmail}</a>
                  {showHost && b.hostName && <span className="text-stone-500"> · with {b.hostName}</span>}
                </div>
                <div className="text-sm text-stone-500">
                  {b.mode === "in_person" ? "📍 " : "💻 "}
                  {isLink ? <a className="underline" href={b.location} target="_blank" rel="noreferrer">{b.location}</a> : b.location || (b.mode === "virtual" ? "Google Meet" : "")}
                </div>
                {b.studentNotes && <div className="mt-1 text-sm italic text-stone-600">“{b.studentNotes}”</div>}
                {b.calendarError && (
                  <div className="mt-1 rounded bg-red-50 px-2 py-1 text-xs text-red-700">
                    Calendar invite failed: {b.calendarError}. Please email the student directly.
                  </div>
                )}
              </div>
              <button
                className="btn-danger"
                disabled={pending}
                onClick={() => {
                  if (!confirm(`Cancel the chat with ${b.studentName}? They'll get a cancellation from Google Calendar.`)) return;
                  setError(null);
                  start(async () => {
                    const res = await cancelBooking(b.id);
                    if (!res.ok) setError(res.error ?? "Could not cancel.");
                    router.refresh();
                  });
                }}
              >
                Cancel
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
