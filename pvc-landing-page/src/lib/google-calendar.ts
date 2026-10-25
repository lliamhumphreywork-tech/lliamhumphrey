export const prerender = false;

// Google Calendar API helper — OAuth2 with a stored refresh token
// Env vars needed:
//   GOOGLE_OAUTH_CLIENT_ID
//   GOOGLE_OAUTH_CLIENT_SECRET
//   GOOGLE_OAUTH_REFRESH_TOKEN

const CLIENT_ID     = import.meta.env.GOOGLE_OAUTH_CLIENT_ID ?? '';
const CLIENT_SECRET = import.meta.env.GOOGLE_OAUTH_CLIENT_SECRET ?? '';
const REFRESH_TOKEN = import.meta.env.GOOGLE_OAUTH_REFRESH_TOKEN ?? '';

export function isConfigured(): boolean {
  return !!(CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN);
}

async function getAccessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type:    'refresh_token',
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`OAuth token refresh failed: ${data.error ?? JSON.stringify(data)}`);
  return data.access_token;
}

export interface CalendarEvent {
  id:       string;
  summary:  string;
  start:    string; // ISO datetime or date
  end:      string;
  location?: string;
  description?: string;
  isAllDay: boolean;
}

export async function getEvents(timeMin: Date, timeMax: Date, maxResults = 20): Promise<CalendarEvent[]> {
  if (!isConfigured()) return [];
  const token  = await getAccessToken();
  const params = new URLSearchParams({
    timeMin:      timeMin.toISOString(),
    timeMax:      timeMax.toISOString(),
    singleEvents: 'true',
    orderBy:      'startTime',
    maxResults:   String(maxResults),
  });
  const res  = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!data.items) throw new Error(`Calendar API error: ${data.error?.message ?? JSON.stringify(data)}`);
  return (data.items as any[]).map(e => ({
    id:          e.id,
    summary:     e.summary ?? '(No title)',
    start:       e.start?.dateTime ?? e.start?.date ?? '',
    end:         e.end?.dateTime   ?? e.end?.date   ?? '',
    location:    e.location,
    description: e.description,
    isAllDay:    !!e.start?.date && !e.start?.dateTime,
  }));
}

export function formatEventTime(event: CalendarEvent, tz = 'Africa/Johannesburg'): string {
  if (event.isAllDay) return 'all day';
  const start = new Date(event.start);
  return start.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', timeZone: tz, hour12: false });
}
