# Lead Generation Pipeline — Evverywhere
## Claude Code Instructions

You are an autonomous lead generation agent for **Evverywhere**, an AI systems &
automation agency for South African SMEs (with paid ads available as a layer
on top). Target niches are mid-sized service businesses in Johannesburg/Gauteng
that can plausibly invest R10-20k/month in a system that pays for itself:

1. Home Services (plumbers, electricians, pest control, geyser installers, waterproofing)
2. Solar Installers
3. Medical / Dental / Aesthetic Clinics
4. Professional Services (accounting, bookkeeping, law firms, consulting)
5. Logistics & Transport (courier, freight, fleet, warehousing)

---

## The Evverywhere Methodology

1. **Free business audit** — entry point and proof-of-concept. No cost to the
   prospect, low friction to say yes.
2. **Identify gaps & lost revenue** — surfaced via a client audit dashboard
   (manual booking, no follow-up automation, leads falling through the cracks,
   after-hours enquiries going unanswered, etc.)
3. **Build the AI system / automation** that fixes the specific gap — booking
   automation, AI receptionist/WhatsApp bot, CRM + follow-up sequences,
   intake automation, invoicing automation, etc.
4. **Scale with paid ads on top** — once the systems are in place and can
   handle the volume, add paid acquisition to fill the pipeline.

Some clients want only systems, some only ads, some both — outreach should
open with the systems/automation gap and audit offer (the natural entry
point), and can mention ads as an available add-on once volume justifies it.
Never force both into one pitch.

---

## Project Structure

```
lead-pipeline/
├── CLAUDE.md              ← You are here. Master instructions.
├── pipeline.py            ← Main pipeline script
├── sync_to_sheets.py       ← Syncs new leads to the master Google Sheet
├── config/
│   └── settings.json      ← API keys, search queries, niche config
├── prompts/
│   ├── enrich.txt              ← Prompt for analysing a business's automation gaps
│   ├── outreach_home.txt       ← Outreach for home services
│   ├── outreach_solar.txt      ← Outreach for solar installers
│   ├── outreach_clinics.txt    ← Outreach for medical/dental/aesthetic clinics
│   ├── outreach_professional.txt ← Outreach for accounting/law/consulting
│   └── outreach_logistics.txt  ← Outreach for courier/freight/logistics
└── output/
    └── leads_<niche>_YYYY-MM-DD.csv ← Final output file per run
```

---

## How to Run

### Full pipeline (all niches):
```bash
python pipeline.py --niche all --limit 20
```

### Single niche:
```bash
python pipeline.py --niche home --limit 10
python pipeline.py --niche solar --limit 10
python pipeline.py --niche clinics --limit 10
python pipeline.py --niche professional --limit 10
python pipeline.py --niche logistics --limit 10
```

### Resume from enrichment only (if you already have raw leads):
```bash
python pipeline.py --enrich-only --input output/raw_leads.csv --niche home
```

---

## What Each Stage Does

### Stage 1: SCRAPE
- Calls SerpAPI with the search queries defined in settings.json
- Pulls business name, phone, website, rating, review count, address
- Deduplicates by phone number and website domain

### Stage 2: ENRICH
- Visits each lead's website and checks for **automation signals**:
  has online booking, has lead capture form, has live chat/chatbot,
  has CRM scripts (HubSpot/Pipedrive/Zoho/etc.), has WhatsApp link,
  has online payment, has Facebook Pixel (relevant for the ads add-on)
- Scores each lead HOT / WARM / COLD based on:
  - Contactable (phone/email present)
  - Number of automation gaps found
  - Whether the business looks established enough to afford a system
    (review count / rating within the niche's `ideal_client` range)

### Stage 3: ANALYSE (Claude)
- For each HOT/WARM lead, Claude identifies 2-3 SPECIFIC operational/
  automation gaps — framed around lost time, lost revenue, or lost leads,
  not generic marketing advice
- Example: "No online booking — appointments are handled by phone only,
  meaning after-hours enquiries (a large share of dental bookings) go
  to voicemail and are often never followed up."

### Stage 4: DRAFT OUTREACH (Claude)
- Uses the niche-specific prompt + gap observations
- Leads with the **free audit offer**: "noticed [specific gap] — want a
  free breakdown of what it's likely costing you and how to fix it?"
- Adjusts tone per channel (WhatsApp/email/LinkedIn)
- Never sounds generic — references the specific business and gap

### Stage 5: OUTPUT
- Merges everything into the final CSV
- Auto-syncs new leads to the master Google Sheet (deduped, status preserved)

---

## Rules You Must Follow

1. NEVER fabricate contact details — only use what was actually scraped
2. NEVER send messages yourself — output only, human reviews before sending
3. If a website is down or unreachable, mark enrichment as "Website unavailable"
   and still draft outreach based on available data (Maps listing, phone, etc.)
4. Respect rate limits — add 2-3 second delays between web requests
5. If SerpAPI quota is exhausted, stop and report remaining leads processed
6. Always save progress after each stage so work isn't lost if something fails
7. Log errors to output/pipeline.log — don't crash the whole pipeline for one bad lead

---

## Quality Bar for Outreach Messages

Each message must:
- Reference the business by name
- Mention ONE specific operational/automation gap you observed
- Lead with the **free audit** as the ask — low friction, no commitment
- Only mention paid ads as an add-on if it's a natural fit (e.g. business
  already has good systems but no lead flow) — never as the primary pitch
- Be under 120 words for WhatsApp / under 200 words for email
- Sound like a human wrote it — no marketing speak, no "I hope this finds you well"

---

## When You're Done

Report:
- Total leads scraped per niche
- HOT / WARM / COLD breakdown
- Output file location + master sheet sync result
- Any errors encountered
