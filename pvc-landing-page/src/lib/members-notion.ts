const NOTION_TOKEN = import.meta.env.NOTION_TOKEN;
const MEMBERS_DB_ID = import.meta.env.NOTION_MEMBERS_DB_ID;

export interface Member {
  id: string;
  name: string;
  email: string;
  business: string;
  role: string;
  instagram: string;
  location: string;
  joinedDate: string;
  tier: string;
  photo: string;
}

function getStr(prop: any): string {
  return (prop?.rich_text ?? []).map((t: any) => t.plain_text).join('') ||
         (prop?.title ?? []).map((t: any) => t.plain_text).join('') || '';
}

function pageToMember(page: any): Member {
  const p = page.properties;
  return {
    id: page.id,
    name: getStr(p['Name'] ?? p['Full Name']),
    email: p['Email']?.email ?? '',
    business: getStr(p['Business'] ?? p['Company']),
    role: getStr(p['Role'] ?? p['What They Do']),
    instagram: getStr(p['Instagram'] ?? p['IG']),
    location: getStr(p['Location'] ?? p['City']),
    joinedDate: p['Joined']?.date?.start ?? p['Created']?.created_time?.slice(0, 10) ?? '',
    tier: p['Tier']?.select?.name ?? p['Membership']?.select?.name ?? '',
    photo: p['Photo']?.files?.[0]?.file?.url ?? p['Photo']?.files?.[0]?.external?.url ?? '',
  };
}

export async function getMemberByEmail(email: string): Promise<Member | null> {
  if (!NOTION_TOKEN || !MEMBERS_DB_ID) return null;
  const res = await fetch(`https://api.notion.com/v1/databases/${MEMBERS_DB_ID}/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({
      filter: { property: 'Email', email: { equals: email.toLowerCase() } },
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const page = data.results?.[0];
  if (!page) return null;
  return pageToMember(page);
}

export async function getMemberById(id: string): Promise<Member | null> {
  if (!NOTION_TOKEN) return null;
  const res = await fetch(`https://api.notion.com/v1/pages/${id}`, {
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
    },
  });
  if (!res.ok) return null;
  const page = await res.json();
  return pageToMember(page);
}

export async function createMember(email: string, fields: {
  name: string; business?: string; role?: string; instagram?: string; location?: string;
}): Promise<string | null> {
  if (!NOTION_TOKEN || !MEMBERS_DB_ID) return null;
  const res = await fetch('https://api.notion.com/v1/pages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({
      parent: { database_id: MEMBERS_DB_ID },
      properties: {
        'Name': { title: [{ text: { content: fields.name } }] },
        'Email': { email: email.toLowerCase() },
        ...(fields.business ? { 'Business': { rich_text: [{ text: { content: fields.business } }] } } : {}),
        ...(fields.role ? { 'Role': { rich_text: [{ text: { content: fields.role } }] } } : {}),
        ...(fields.instagram ? { 'Instagram': { rich_text: [{ text: { content: fields.instagram } }] } } : {}),
        ...(fields.location ? { 'Location': { rich_text: [{ text: { content: fields.location } }] } } : {}),
      },
    }),
  });
  if (!res.ok) return null;
  const page = await res.json();
  return page.id ?? null;
}

export async function updateMember(id: string, fields: Partial<{
  name: string; business: string; role: string; instagram: string; location: string;
}>): Promise<boolean> {
  if (!NOTION_TOKEN) return false;
  const properties: any = {};
  if (fields.name) properties['Name'] = { title: [{ text: { content: fields.name } }] };
  if (fields.business !== undefined) properties['Business'] = { rich_text: [{ text: { content: fields.business } }] };
  if (fields.role !== undefined) properties['Role'] = { rich_text: [{ text: { content: fields.role } }] };
  if (fields.instagram !== undefined) properties['Instagram'] = { rich_text: [{ text: { content: fields.instagram } }] };
  if (fields.location !== undefined) properties['Location'] = { rich_text: [{ text: { content: fields.location } }] };
  const res = await fetch(`https://api.notion.com/v1/pages/${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({ properties }),
  });
  return res.ok;
}

export async function getAllMembers(): Promise<Member[]> {
  if (!NOTION_TOKEN || !MEMBERS_DB_ID) return [];
  const members: Member[] = [];
  let cursor: string | undefined;
  do {
    const body: any = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const res = await fetch(`https://api.notion.com/v1/databases/${MEMBERS_DB_ID}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) break;
    const data = await res.json();
    for (const page of data.results ?? []) {
      const m = pageToMember(page);
      if (m.email) members.push(m);
    }
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return members;
}
