const NOTION_TOKEN = import.meta.env.NOTION_TOKEN ?? '';

export const NOTION_HEADERS = {
  'Authorization': `Bearer ${NOTION_TOKEN}`,
  'Content-Type': 'application/json',
  'Notion-Version': '2022-06-28',
};

// Field extractors
export const getTitle  = (p: any, k: string) => (p[k]?.title      ?? []).map((t: any) => t.plain_text).join('');
export const getText   = (p: any, k: string) => (p[k]?.rich_text  ?? []).map((t: any) => t.plain_text).join('');
export const getSelect = (p: any, k: string) => p[k]?.select?.name ?? '';
export const getMulti  = (p: any, k: string) => (p[k]?.multi_select ?? []).map((t: any) => t.name) as string[];
export const getDate   = (p: any, k: string) => p[k]?.date?.start ?? '';
export const getNum    = (p: any, k: string): number | null => p[k]?.number ?? null;
export const getEmail  = (p: any, k: string) => p[k]?.email ?? getText(p, k);
export const getPhone  = (p: any, k: string) => p[k]?.phone_number ?? '';

// Paginated DB query
export async function notionQuery(dbId: string, filter?: any, sorts?: any[]): Promise<any[]> {
  const all: any[] = [];
  let cursor: string | undefined;
  do {
    const body: any = { page_size: 100 };
    if (filter) body.filter = filter;
    if (sorts)  body.sorts  = sorts;
    if (cursor) body.start_cursor = cursor;
    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: 'POST', headers: NOTION_HEADERS, body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Notion query error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    all.push(...(data.results ?? []));
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return all;
}

// PATCH a page's properties
export async function notionPatch(pageId: string, properties: Record<string, any>): Promise<void> {
  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'PATCH', headers: NOTION_HEADERS, body: JSON.stringify({ properties }),
  });
  if (!res.ok) throw new Error(`Notion patch error ${res.status}: ${await res.text()}`);
}

// Create a new page in a database
export async function notionCreate(dbId: string, properties: Record<string, any>): Promise<any> {
  const res = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST', headers: NOTION_HEADERS,
    body: JSON.stringify({ parent: { database_id: dbId }, properties }),
  });
  if (!res.ok) throw new Error(`Notion create error ${res.status}: ${await res.text()}`);
  return res.json();
}

// Property value builders
export const richText = (content: string) => [{ text: { content } }];
export const titleProp  = (content: string) => ({ title: richText(content) });
export const textProp   = (content: string) => ({ rich_text: richText(content) });
export const selectProp = (name: string)    => ({ select: { name } });
export const dateProp   = (start: string)   => ({ date: { start } });
export const numProp    = (n: number)       => ({ number: n });
export const emailProp  = (email: string)          => ({ email });
export const checkProp  = (checked: boolean)       => ({ checkbox: checked });
export const phoneProp  = (phone: string | null)   => ({ phone_number: phone || null });
export const multiProp  = (names: string[])        => ({ multi_select: names.map(name => ({ name })) });
