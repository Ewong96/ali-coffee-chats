"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveProfile } from "@/app/actions/member";
import type { Member } from "@/db/schema";

export default function ProfileForm({ member }: { member: Member }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [mode, setMode] = useState(member.defaultMode);

  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          await saveProfile(fd);
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
          router.refresh();
        });
      }}
    >
      <div>
        <label className="label" htmlFor="pf-name">Name</label>
        <input id="pf-name" name="name" className="input" defaultValue={member.name} required />
      </div>
      <div>
        <label className="label" htmlFor="pf-title">Role on eboard</label>
        <input id="pf-title" name="title" className="input" defaultValue={member.title} placeholder="e.g. VP of Marketing" />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="pf-bio">Short bio <span className="font-normal normal-case text-stone-400">(optional)</span></label>
        <input id="pf-bio" name="bio" className="input" defaultValue={member.bio} placeholder="Junior studying Econ, into consulting recruiting" />
      </div>

      <div className="sm:col-span-2">
        <span className="label">Default meeting format</span>
        <div className="flex gap-2">
          {(["in_person", "virtual"] as const).map((m) => (
            <label key={m} className={`flex-1 cursor-pointer rounded-lg border px-3 py-2 text-sm ${mode === m ? "border-amber-700 bg-amber-50 text-amber-900" : "border-stone-300 text-stone-700 hover:bg-stone-50"}`}>
              <input type="radio" name="defaultMode" value={m} className="sr-only" checked={mode === m} onChange={() => setMode(m)} />
              {m === "in_person" ? "📍 In person" : "💻 Virtual"}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-stone-500">You can override this per slot in the grid below.</p>
      </div>

      <div>
        <label className="label" htmlFor="pf-location">In-person spot</label>
        <input id="pf-location" name="location" className="input" defaultValue={member.location} placeholder="e.g. Starbucks in the student union" />
      </div>
      <div>
        <label className="label" htmlFor="pf-virtual">Virtual link <span className="font-normal normal-case text-stone-400">(Zoom, etc.)</span></label>
        <input id="pf-virtual" name="virtualLink" className="input" defaultValue={member.virtualLink} placeholder="Leave blank to auto-create a Google Meet" />
      </div>

      <label className="flex items-center gap-2 text-sm text-stone-700 sm:col-span-2">
        <input type="checkbox" name="checkGoogleBusy" defaultChecked={member.checkGoogleBusy} className="h-4 w-4 rounded border-stone-300 accent-amber-800" />
        Hide slots that conflict with events already on my Google Calendar
      </label>

      <div className="flex items-center gap-3 sm:col-span-2">
        <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save profile"}</button>
        {saved && <span className="text-sm text-emerald-700">Saved</span>}
      </div>
    </form>
  );
}
