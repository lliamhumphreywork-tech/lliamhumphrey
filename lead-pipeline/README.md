# Lead Generation Pipeline
## Setup & Usage Guide

### What this does
Scrapes leads from Google Maps → enriches with website/social data → 
uses Claude to identify gaps → drafts personalised outreach per lead.
Output: ready-to-send CSV per niche (Solar / Home Services / Airbnb).

---

## Step 1 — Install dependencies

```bash
cd lead-pipeline
pip install requests
```

That's it. No heavy frameworks needed.

---

## Step 2 — Get your API keys

### SerpAPI (Google Maps scraping)
1. Go to https://serpapi.com
2. Sign up for free (100 searches/month free tier)
3. Copy your API key from the dashboard

### Anthropic API key
1. Go to https://console.anthropic.com
2. Create an API key
3. You'll use API credits (not your claude.ai subscription)
   — roughly $0.003 per lead processed (gap analysis + outreach draft)
   — 50 leads ≈ $0.15 total

### Add keys to config
Open `config/settings.json` and replace:
- `"YOUR_SERPAPI_KEY_HERE"` with your SerpAPI key
- `"YOUR_ANTHROPIC_KEY_HERE"` with your Anthropic API key

---

## Step 3 — Run the pipeline

### Full run — all 3 niches, 20 leads each:
```bash
python pipeline.py --niche all --limit 20
```

### Single niche:
```bash
python pipeline.py --niche solar --limit 15
python pipeline.py --niche home --limit 20
python pipeline.py --niche airbnb --limit 10
```

### If you hit SerpAPI quota — enrich already-scraped leads:
```bash
python pipeline.py --enrich-only --input output/solar_stage1_raw_2026-06-07.csv
```

---

## Step 4 — Review output

Open `output/leads_[niche]_[date].csv` in Google Sheets or Excel.

Key columns to review:
- **score** — HOT / WARM / COLD (focus on HOT first)
- **gaps_found** — what Claude identified as their marketing weakness
- **outreach_message** — the personalised message, ready to send
- **outreach_channel** — where to send it (whatsapp / email / linkedin)
- **phone** — click to open WhatsApp web
- **status** — update to "Sent" after you send, "Replied", "Call Booked", etc.

---

## Step 5 — Use Claude Code for advanced runs

Open the `lead-pipeline` folder in Claude Code and say:

> "Run the full pipeline for solar leads in JHB, get me 30 HOT leads,
> and open the Facebook Ads Library for each one to check if they're running ads"

Claude Code will handle the orchestration, browser checks, and file management autonomously.

Other useful Claude Code prompts:
- "Show me only the HOT leads from today's solar run"
- "Re-draft the outreach for lead #12 — make it more casual for WhatsApp"
- "Add a column showing estimated monthly commission if I close this client"
- "Find the owner's name on LinkedIn for each lead that has a website"

---

## Output File Structure

```
output/
├── solar_stage1_raw_2026-06-07.csv      ← raw scraped leads
├── solar_stage2_enriched_2026-06-07.csv ← after website checks
├── solar_stage3_drafted_2026-06-07.csv  ← after Claude analysis
├── leads_solar_2026-06-07.csv           ← FINAL — this is what you use
├── leads_home_2026-06-07.csv
├── leads_airbnb_2026-06-07.csv
└── pipeline.log                          ← debug log if anything fails
```

---

## Troubleshooting

**"SerpAPI quota exhausted"**
→ You've used your 100 free searches. Upgrade ($50/mo) or wait for monthly reset.
→ Use `--enrich-only` to keep processing any leads already scraped.

**"Website unreachable" for many leads**
→ Normal — many SA small businesses have outdated/offline websites.
→ These leads still get outreach drafted based on their Maps listing + social.

**Claude API errors**
→ Check your API key and that you have credits at console.anthropic.com
→ The pipeline saves after each stage — re-run from `--enrich-only` to resume.

**Low HOT lead count**
→ Try different search queries in `config/settings.json`
→ Lower `min_rating` in the ideal_client config to cast a wider net

---

## Scaling Up

Once SerpAPI free tier runs out:
- Outscraper.com — pay-per-use, ~$0.001 per result, no monthly fee
- Switch to `outscraper` mode by updating `scrape_google_maps()` in pipeline.py

To add more niches: copy a niche block in `settings.json` + add a prompt file in `prompts/`.
