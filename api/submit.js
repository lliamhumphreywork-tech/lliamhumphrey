module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { name, email, company, stage, kind, budget, timing, about } = req.body;

  const r = await fetch(`https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_TABLE_ID}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.AIRTABLE_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: {
        Name: name,
        Email: email,
        Company: company,
        Stage: stage,
        Need: Array.isArray(kind) ? kind.join(', ') : kind,
        Budget: budget,
        Timing: timing,
        Notes: about,
      },
    }),
  });

  const json = await r.json();
  res.status(r.ok ? 200 : 500).json(json);
};
