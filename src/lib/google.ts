import { TIMEZONE } from "./config";

type TokenResponse = { access_token: string; expires_in: number };

/** Placeholder stored by the local-only dev login; never a real Google credential. */
export const DEV_FAKE_TOKEN = "dev-fake-token";

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

export async function accessTokenFor(refreshToken: string): Promise<string> {
  if (refreshToken === DEV_FAKE_TOKEN) throw new Error("Dev login has no real Google Calendar connection");
  const cached = tokenCache.get(refreshToken);
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token;

  const body = new URLSearchParams({
    client_id: process.env.AUTH_GOOGLE_ID ?? "",
    client_secret: process.env.AUTH_GOOGLE_SECRET ?? "",
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Google token refresh failed (${res.status}): ${await res.text()}`);
  const json = (await res.json()) as TokenResponse;
  tokenCache.set(refreshToken, { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 });
  return json.access_token;
}

export type BusyInterval = { start: Date; end: Date };

const busyCache = new Map<string, { at: number; busy: BusyInterval[] }>();
const BUSY_TTL_MS = 2 * 60 * 1000;

/** Busy intervals on the member's primary calendar. Cached briefly; failures return []. */
export async function freeBusy(refreshToken: string, timeMin: Date, timeMax: Date): Promise<BusyInterval[]> {
  if (refreshToken === DEV_FAKE_TOKEN) return [];
  const key = `${refreshToken}|${timeMin.toISOString()}|${timeMax.toISOString()}`;
  const cached = busyCache.get(key);
  if (cached && Date.now() - cached.at < BUSY_TTL_MS) return cached.busy;
  try {
    const token = await accessTokenFor(refreshToken);
    const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        timeZone: TIMEZONE,
        items: [{ id: "primary" }],
      }),
    });
    if (!res.ok) throw new Error(`freeBusy ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as { calendars?: { primary?: { busy?: { start: string; end: string }[] } } };
    const busy = (json.calendars?.primary?.busy ?? []).map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));
    busyCache.set(key, { at: Date.now(), busy });
    return busy;
  } catch (err) {
    console.error("freeBusy failed", err);
    return [];
  }
}

export function invalidateBusyCache() {
  busyCache.clear();
}

export type CreateEventInput = {
  refreshToken: string;
  summary: string;
  description: string;
  start: Date;
  end: Date;
  attendees: { email: string; displayName?: string }[];
  location?: string;
  createMeet?: boolean;
  requestId: string;
};

export type CreatedEvent = { id: string; htmlLink?: string; hangoutLink?: string };

export async function createEvent(input: CreateEventInput): Promise<CreatedEvent> {
  const token = await accessTokenFor(input.refreshToken);
  const body: Record<string, unknown> = {
    summary: input.summary,
    description: input.description,
    start: { dateTime: input.start.toISOString(), timeZone: TIMEZONE },
    end: { dateTime: input.end.toISOString(), timeZone: TIMEZONE },
    attendees: input.attendees,
    guestsCanModify: false,
    reminders: { useDefault: true },
  };
  if (input.location) body.location = input.location;
  if (input.createMeet) {
    body.conferenceData = {
      createRequest: { requestId: input.requestId, conferenceSolutionKey: { type: "hangoutsMeet" } },
    };
  }
  const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  url.searchParams.set("sendUpdates", "all");
  url.searchParams.set("conferenceDataVersion", "1");
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Calendar insert failed (${res.status}): ${await res.text()}`);
  const json = (await res.json()) as CreatedEvent;
  invalidateBusyCache();
  return json;
}

export async function deleteEvent(refreshToken: string, eventId: string): Promise<void> {
  const token = await accessTokenFor(refreshToken);
  const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`);
  url.searchParams.set("sendUpdates", "all");
  const res = await fetch(url, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
  // 404/410 mean it is already gone; treat as success.
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Calendar delete failed (${res.status}): ${await res.text()}`);
  }
  invalidateBusyCache();
}
