module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, name, social } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });

  const attributes = {};
  if (name) attributes.FIRSTNAME = name;
  if (social) attributes.SOCIAL_HANDLE = social;

  const r = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      attributes: Object.keys(attributes).length ? attributes : undefined,
      listIds: [Number(process.env.BREVO_LIST_ID)],
      updateEnabled: true,
    }),
  });

  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch (_) { json = { raw: text }; }

  res.status(r.ok || r.status === 204 ? 200 : 500).json(json);
};
