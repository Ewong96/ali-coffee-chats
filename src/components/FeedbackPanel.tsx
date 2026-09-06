"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveFeedback, type FeedbackInput } from "@/app/actions/member";
import { yearLabel } from "@/lib/config";
import { fmtDateTime } from "@/lib/time";

export type PastChat = {
  id: string;
  studentName: string;
  studentEmail: string;
  studentYear: string;
  studentNotes: string;
  startsAt: string;
  feedback: { attended: boolean; program: string; rating: number | null; notes: string } | null;
};

export default function FeedbackPanel({ chats }: { chats: PastChat[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (!chats.length) return <p className="text-sm text-stone-500">No past chats yet. Once a chat has happened it will appear here.</p>;
  const pending = chats.filter((c) => !c.feedback).length;

  return (
    <div>
      {pending > 0 && (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {pending} chat{pending === 1 ? "" : "s"} still need{pending === 1 ? "s" : ""} feedback.
        </p>
      )}
      <ul className="divide-y divide-stone-100">
        {chats.map((c) => (
          <li key={c.id} className="py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-medium text-stone-900">{fmtDateTime(new Date(c.startsAt))}</div>
                <div className="text-sm text-stone-700">
                  {c.studentName}{c.studentYear && <span className="text-stone-500"> · {yearLabel(c.studentYear)}</span>} · <span className="text-stone-500">{c.studentEmail}</span>
                </div>
                {c.feedback && (
                  <div className="mt-1 text-sm text-stone-600">
                    {c.feedback.attended ? (
                      <>
                        <span className="text-emerald-700">Attended</span>
                        {c.feedback.rating ? ` · Fit ${c.feedback.rating}/5` : ""}
                        {c.feedback.program ? ` · ${c.feedback.program}` : ""}
                      </>
                    ) : (
                      <span className="text-red-700">No-show</span>
                    )}
                  </div>
                )}
              </div>
              <button className={c.feedback ? "btn-secondary" : "btn-primary"} onClick={() => setOpenId(openId === c.id ? null : c.id)}>
                {openId === c.id ? "Close" : c.feedback ? "Edit feedback" : "Leave feedback"}
              </button>
            </div>
            {openId === c.id && <FeedbackForm chat={c} onDone={() => setOpenId(null)} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FeedbackForm({ chat, onDone }: { chat: PastChat; onDone: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [attended, setAttended] = useState(chat.feedback?.attended ?? true);
  const [program, setProgram] = useState(chat.feedback?.program ?? "");
  const [rating, setRating] = useState<number | null>(chat.feedback?.rating ?? null);
  const [notes, setNotes] = useState(chat.feedback?.notes ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const input: FeedbackInput = { attended, program, rating: attended ? rating : null, notes };
    start(async () => {
      const res = await saveFeedback(chat.id, input);
      if (!res.ok) return setError(res.error ?? "Could not save.");
      router.refresh();
      onDone();
    });
  }

  return (
    <form onSubmit={submit} className="mt-3 grid gap-4 rounded-xl border border-stone-200 bg-stone-50 p-4 sm:grid-cols-2">
      {chat.studentNotes && (
        <p className="text-sm italic text-stone-600 sm:col-span-2">They wanted to talk about: “{chat.studentNotes}”</p>
      )}
      <div className="sm:col-span-2">
        <span className="label">Did the chat happen?</span>
        <div className="flex gap-2">
          {[true, false].map((v) => (
            <button
              key={String(v)}
              type="button"
              onClick={() => setAttended(v)}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm ${attended === v ? "border-amber-700 bg-amber-50 text-amber-900" : "border-stone-300 bg-white text-stone-700 hover:bg-stone-100"}`}
            >
              {v ? "Yes, we chatted" : "No-show"}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="label" htmlFor={`fb-program-${chat.id}`}>Program they&apos;re applying to</label>
        <input id={`fb-program-${chat.id}`} className="input" value={program} onChange={(e) => setProgram(e.target.value)} placeholder="e.g. Analyst program, Marketing track" />
      </div>
      <div>
        <span className="label">Fit rating {attended ? "" : <span className="font-normal normal-case text-stone-400">(n/a for no-show)</span>}</span>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              disabled={!attended}
              onClick={() => setRating(n)}
              className={`h-10 flex-1 rounded-lg border text-sm font-medium transition disabled:opacity-40 ${rating === n && attended ? "border-amber-700 bg-amber-800 text-white" : "border-stone-300 bg-white text-stone-700 hover:bg-stone-100"}`}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-stone-500">1 = weak fit, 5 = great fit</p>
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor={`fb-notes-${chat.id}`}>Notes</label>
        <textarea id={`fb-notes-${chat.id}`} className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What stood out, questions they asked, anything the board should know…" />
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{error}</p>}
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button type="button" className="btn-secondary" onClick={onDone} disabled={pending}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save feedback"}</button>
      </div>
    </form>
  );
}
