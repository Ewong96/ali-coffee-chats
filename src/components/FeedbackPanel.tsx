"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { logManualChat, saveFeedback, type FeedbackInput } from "@/app/actions/member";
import { CLASS_YEARS, yearLabel } from "@/lib/config";
import { fmtDateTime } from "@/lib/time";

export type PastChat = {
  id: string;
  studentName: string;
  studentEmail: string;
  studentYear: string;
  studentNotes: string;
  startsAt: string;
  manual?: boolean;
  feedback: { attended: boolean; program: string; rating: number | null; notes: string } | null;
};

export default function FeedbackPanel({ chats, today }: { chats: PastChat[]; today: string }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [logging, setLogging] = useState(false);
  const pending = chats.filter((c) => !c.feedback).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-stone-600">Chatted with someone who didn&apos;t book through the site? Log it here so it counts.</p>
        <button className={logging ? "btn-secondary" : "btn-primary"} onClick={() => setLogging((v) => !v)}>
          {logging ? "Close" : "+ Log a chat"}
        </button>
      </div>
      {logging && <ManualChatForm today={today} onDone={() => setLogging(false)} />}
      {!chats.length && <p className="text-sm text-stone-500">No past chats yet. Once a chat has happened it will appear here.</p>}
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
                <div className="font-medium text-stone-900">
                  {fmtDateTime(new Date(c.startsAt))}
                  {c.manual && <span className="ml-2 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-normal text-stone-600">logged manually</span>}
                </div>
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

function ManualChatForm({ today, onDone }: { today: string; onDone: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentYear, setStudentYear] = useState("");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("12:00");
  const [attended, setAttended] = useState(true);
  const [program, setProgram] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await logManualChat({ studentName, studentEmail, studentYear, date, time, feedback: { attended, program, rating: attended ? rating : null, notes } });
      if (!res.ok) return setError(res.error ?? "Could not save.");
      router.refresh();
      onDone();
    });
  }

  return (
    <form onSubmit={submit} className="mb-5 grid gap-4 rounded-xl border border-amber-200 bg-amber-50/40 p-4 sm:grid-cols-2">
      <div className="sm:col-span-2 text-sm font-semibold text-stone-800">Log a chat that wasn&apos;t booked here</div>
      <div>
        <label className="label" htmlFor="mc-name">Student name</label>
        <input id="mc-name" className="input" value={studentName} onChange={(e) => setStudentName(e.target.value)} required />
      </div>
      <div>
        <label className="label" htmlFor="mc-email">Student email <span className="font-normal normal-case text-stone-400">(optional)</span></label>
        <input id="mc-email" type="email" className="input" value={studentEmail} onChange={(e) => setStudentEmail(e.target.value)} placeholder="name@stern.nyu.edu" />
      </div>
      <div>
        <label className="label" htmlFor="mc-year">Class year</label>
        <select id="mc-year" className="input" value={studentYear} onChange={(e) => setStudentYear(e.target.value)}>
          <option value="">Not sure</option>
          {CLASS_YEARS.map((y) => (
            <option key={y.id} value={y.id}>{y.label}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label" htmlFor="mc-date">Date</label>
          <input id="mc-date" type="date" className="input" value={date} max={today} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div>
          <label className="label" htmlFor="mc-time">Time</label>
          <input id="mc-time" type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>

      <div className="sm:col-span-2 border-t border-amber-200 pt-3 text-sm font-semibold text-stone-800">Feedback</div>
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
        <label className="label" htmlFor="mc-program">Program they&apos;re applying to</label>
        <input id="mc-program" className="input" value={program} onChange={(e) => setProgram(e.target.value)} placeholder="e.g. Analyst program, Marketing track" />
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
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="mc-notes">Notes</label>
        <textarea id="mc-notes" className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What stood out, questions they asked, anything the board should know…" />
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{error}</p>}
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button type="button" className="btn-secondary" onClick={onDone} disabled={pending}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save chat & feedback"}</button>
      </div>
    </form>
  );
}
