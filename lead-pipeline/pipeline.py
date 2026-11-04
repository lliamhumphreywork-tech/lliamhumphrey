#!/usr/bin/env python3
"""
Lead Generation Pipeline — Brandscaling Business JHB
Runs: scrape → enrich → analyse gaps → draft outreach
Output: ready-to-send CSV per niche
"""

import argparse
import json
import csv
import time
import re
import os
import sys
import logging
import requests
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse, quote_plus

# ── Setup ──────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
CONFIG_PATH = BASE_DIR / "config" / "settings.json"
OUTPUT_DIR = BASE_DIR / "output"
PROMPTS_DIR = BASE_DIR / "prompts"
OUTPUT_DIR.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(OUTPUT_DIR / "pipeline.log"),
        logging.StreamHandler(sys.stdout)
    ]
)
log = logging.getLogger(__name__)

with open(CONFIG_PATH) as f:
    CONFIG = json.load(f)

SERPAPI_KEY = CONFIG["api_keys"]["serpapi"]
ANTHROPIC_KEY = CONFIG["api_keys"]["anthropic"]
DELAY = CONFIG["pipeline"]["delay_between_requests"]
TODAY = datetime.now().strftime("%Y-%m-%d")


# ── Helpers ────────────────────────────────────────────────────────────────────

def save_progress(leads: list, stage: str, niche: str):
    """Save leads to CSV after each stage so nothing is lost."""
    path = OUTPUT_DIR / f"{niche}_{stage}_{TODAY}.csv"
    if not leads:
        return path
    keys = leads[0].keys()
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=keys)
        writer.writeheader()
        writer.writerows(leads)
    log.info(f"Saved {len(leads)} leads → {path}")
    return path


def load_csv(path: str) -> list:
    with open(path, encoding="utf-8") as f:
        return list(csv.DictReader(f))


def clean_phone(phone: str) -> str:
    if not phone:
        return ""
    digits = re.sub(r"[^\d+]", "", phone)
    if digits.startswith("0") and len(digits) >= 9:
        return "+27" + digits[1:]
    return digits


def domain_from_url(url: str) -> str:
    if not url:
        return ""
    try:
        return urlparse(url).netloc.replace("www.", "")
    except Exception:
        return url


def deduplicate(leads: list) -> list:
    seen_phones, seen_domains = set(), set()
    unique = []
    for lead in leads:
        phone = clean_phone(lead.get("phone", ""))
        domain = domain_from_url(lead.get("website", ""))
        key = phone or domain
        if key and key not in seen_phones and key not in seen_domains:
            if phone:
                seen_phones.add(phone)
            if domain:
                seen_domains.add(domain)
            unique.append(lead)
        elif not key:
            unique.append(lead)  # keep leads with no phone/site — enrich may find contact
    return unique


def is_disqualified(business_name: str, niche_config: dict) -> bool:
    name_lower = business_name.lower()
    return any(d.lower() in name_lower for d in niche_config.get("disqualifiers", []))


# ── Stage 1: SCRAPE ────────────────────────────────────────────────────────────

def scrape_google_maps(query: str, limit: int = 20) -> list:
    """Pull leads from Google Maps via SerpAPI."""
    leads = []
    params = {
        "engine": "google_maps",
        "q": query,
        "type": "search",
        "api_key": SERPAPI_KEY,
        "ll": "@-26.2041,28.0473,12z",  # Johannesburg coordinates
        "hl": "en",
    }

    try:
        resp = requests.get("https://serpapi.com/search", params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        log.error(f"SerpAPI error for '{query}': {e}")
        return []

    results = data.get("local_results", [])
    for r in results[:limit]:
        lead = {
            "business_name": r.get("title", ""),
            "owner_name": "",
            "phone": clean_phone(r.get("phone", "")),
            "email": "",
            "website": r.get("website", ""),
            "address": r.get("address", ""),
            "rating": r.get("rating", ""),
            "review_count": r.get("reviews", ""),
            "place_id": r.get("place_id", ""),
            "maps_url": r.get("link", ""),
        }
        leads.append(lead)

    time.sleep(DELAY)
    return leads


def check_fb_ads_library(business_name: str) -> dict:
    """
    Check Facebook Ads Library for active ads.
    Returns dict with running_ads (bool) and ad_count.
    Note: FB Ads Library has no official API — we check the public URL.
    Claude Code can open this in browser if needed, but basic check is URL-based.
    """
    encoded = quote_plus(business_name)
    fb_ads_url = f"https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ZA&q={encoded}&search_type=keyword_unordered"

    # For now, return the URL for manual/browser checking + flag for Claude Code to visit
    return {
        "running_ads": None,      # None = unknown, True = yes, False = no
        "ads_library_url": fb_ads_url,
        "ad_count": None
    }


def scrape_niche(niche: str, limit: int = 20) -> list:
    """Run all searches for a niche and return deduplicated leads."""
    niche_config = CONFIG["niches"][niche]
    all_leads = []
    searches = niche_config["searches"]

    log.info(f"Scraping {niche} — {len(searches)} searches, {limit} leads target")

    per_search = max(5, limit // len(searches) + 2)

    for query in searches:
        log.info(f"  → '{query}'")
        raw = scrape_google_maps(query, per_search)
        qualified = [r for r in raw if not is_disqualified(r["business_name"], niche_config)]
        all_leads.extend(qualified)
        if len(all_leads) >= limit * 2:  # gather extra, dedup will trim
            break

    deduped = deduplicate(all_leads)
    log.info(f"Raw: {len(all_leads)} | After dedup: {len(deduped)}")

    # Add niche metadata
    for lead in deduped:
        lead["niche"] = niche
        lead["niche_label"] = niche_config["label"]
        lead["sub_niche"] = ""

    return deduped[:limit]


# ── Stage 2: ENRICH ───────────────────────────────────────────────────────────

def enrich_website(url: str) -> dict:
    """Visit website and extract automation/operations signals."""
    result = {
        "has_website": bool(url),
        "website_reachable": False,
        "has_lead_form": False,
        "has_booking_system": False,
        "has_chatbot": False,
        "has_crm_signals": False,
        "has_whatsapp_link": False,
        "has_pixel": False,
        "is_mobile_friendly": None,
        "website_notes": ""
    }

    if not url:
        return result

    try:
        headers = {"User-Agent": "Mozilla/5.0 (compatible; LeadBot/1.0)"}
        resp = requests.get(url, headers=headers, timeout=12, allow_redirects=True)
        html = resp.text.lower()
        result["website_reachable"] = True

        # Check for key automation signals
        result["has_lead_form"] = any(kw in html for kw in [
            '<form', 'contact-form', 'wpcf7', 'gravity', 'contact us', 'get a quote',
            'book now', 'request a', 'enquire', 'free quote'
        ])
        result["has_booking_system"] = any(kw in html for kw in [
            'calendly', 'acuity', 'booksy', 'simplebooking', 'book an appointment',
            'schedule a', 'online booking', 'book online'
        ])
        result["has_chatbot"] = any(kw in html for kw in [
            'intercom', 'drift.com', 'tidio', 'crisp.chat', 'tawk.to',
            'manychat', 'livechat', 'chatbot', 'chatwoot'
        ])
        result["has_crm_signals"] = any(kw in html for kw in [
            'hubspot', 'pipedrive', 'salesforce', 'zoho', 'activecampaign', 'keap'
        ])
        result["has_whatsapp_link"] = 'wa.me' in html or 'whatsapp' in html
        result["has_pixel"] = 'fbq(' in html or 'facebook pixel' in html or 'connect.facebook' in html

        # Build notes — operational/automation framing
        notes = []
        if not result["has_booking_system"]:
            notes.append("No online booking")
        if not result["has_chatbot"]:
            notes.append("No chatbot/AI assistant")
        if not result["has_crm_signals"]:
            notes.append("No CRM detected")
        if not result["has_lead_form"]:
            notes.append("No lead capture form")
        if result["has_whatsapp_link"]:
            notes.append("Uses WhatsApp (good)")
        result["website_notes"] = " | ".join(notes)

    except requests.exceptions.ConnectionError:
        result["website_notes"] = "Website unreachable / offline"
    except Exception as e:
        result["website_notes"] = f"Error: {str(e)[:80]}"

    time.sleep(DELAY)
    return result


def score_lead(lead: dict) -> str:
    """Score a lead HOT / WARM / COLD based on automation gaps and
    whether the business looks like the right size to afford a system."""
    has_contact = bool(lead.get("phone") or lead.get("email"))
    name_ok = bool(lead.get("business_name"))

    automation_gaps = sum([
        not lead.get("has_booking_system"),
        not lead.get("has_chatbot"),
        not lead.get("has_crm_signals"),
        not lead.get("has_lead_form"),
    ])

    niche_config = CONFIG["niches"].get(lead.get("niche", ""), {})
    ideal = niche_config.get("ideal_client", {})
    try:
        rating = float(lead.get("rating") or 0)
    except ValueError:
        rating = 0
    try:
        review_count = int(lead.get("review_count") or 0)
    except ValueError:
        review_count = 0

    is_ideal_size = (
        ideal.get("min_reviews", 0) <= review_count <= ideal.get("max_reviews", 10**9)
        and rating >= ideal.get("min_rating", 0)
    )

    reachable = lead.get("website_reachable") or has_contact

    if has_contact and name_ok and is_ideal_size and automation_gaps >= 2:
        return "HOT"
    elif has_contact and name_ok and reachable and automation_gaps >= 1:
        return "WARM"
    else:
        return "COLD"


def enrich_leads(leads: list) -> list:
    """Enrich all leads with website and social signals."""
    log.info(f"Enriching {len(leads)} leads...")
    enriched = []

    for i, lead in enumerate(leads):
        log.info(f"  [{i+1}/{len(leads)}] {lead['business_name']}")
        web_data = enrich_website(lead.get("website", ""))
        fb_data = check_fb_ads_library(lead["business_name"])
        lead.update(web_data)
        lead.update(fb_data)
        lead["score"] = score_lead(lead)
        log.info(f"    Score: {lead['score']} | Gaps: {lead.get('website_notes', 'N/A')}")
        enriched.append(lead)

    hot = sum(1 for l in enriched if l["score"] == "HOT")
    warm = sum(1 for l in enriched if l["score"] == "WARM")
    cold = sum(1 for l in enriched if l["score"] == "COLD")
    log.info(f"Enrichment complete: HOT={hot} WARM={warm} COLD={cold}")
    return enriched


# ── Stage 3 & 4: ANALYSE + DRAFT OUTREACH (Claude) ───────────────────────────

def load_prompt(filename: str) -> str:
    path = PROMPTS_DIR / filename
    if path.exists():
        return path.read_text(encoding="utf-8")
    return ""


def call_claude(prompt: str, max_tokens: int = 600) -> str:
    """Call Claude API to generate analysis or outreach copy."""
    headers = {
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    }
    body = {
        "model": CONFIG["model"],
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": prompt}]
    }
    try:
        resp = requests.post(
            "https://api.anthropic.com/v1/messages",
            headers=headers,
            json=body,
            timeout=30
        )
        resp.raise_for_status()
        return resp.json()["content"][0]["text"].strip()
    except Exception as e:
        log.error(f"Claude API error: {e}")
        return ""


def build_gap_analysis_prompt(lead: dict) -> str:
    """Build the prompt for Claude to analyse a lead's marketing gaps."""
    base = load_prompt("enrich.txt")
    if not base:
        base = """You are a digital marketing analyst reviewing a local South African business.
Based on the data below, identify 2-3 SPECIFIC, factual marketing gaps this business has.
Be concrete. Reference actual missing elements (no pixel, no lead form, no ads running, etc.).
Write in plain English, max 3 bullet points. No fluff.

Business Data:
{data}

Output format:
- [Gap 1]
- [Gap 2]
- [Gap 3] (optional)"""

    data_str = "\n".join([
        f"Business: {lead.get('business_name', 'Unknown')}",
        f"Niche: {lead.get('niche_label', '')}",
        f"Website: {lead.get('website', 'None')}",
        f"Website reachable: {lead.get('website_reachable', False)}",
        f"Has online booking system: {lead.get('has_booking_system', False)}",
        f"Has chatbot/AI assistant: {lead.get('has_chatbot', False)}",
        f"Has CRM signals: {lead.get('has_crm_signals', False)}",
        f"Has lead capture form: {lead.get('has_lead_form', False)}",
        f"Uses WhatsApp: {lead.get('has_whatsapp_link', False)}",
        f"Has Facebook Pixel (relevant only if ads come up): {lead.get('has_pixel', False)}",
        f"Rating: {lead.get('rating', 'N/A')} ({lead.get('review_count', '?')} reviews)",
        f"Website notes: {lead.get('website_notes', 'N/A')}",
        f"Address: {lead.get('address', 'N/A')}",
    ])
    return base.replace("{data}", data_str)


def build_outreach_prompt(lead: dict, gaps: str) -> str:
    """Build the prompt for Claude to write the outreach message."""
    niche = lead.get("niche", "solar")
    prompt_file = f"outreach_{niche}.txt"
    base = load_prompt(prompt_file)

    if not base:
        base = """You are writing a cold outreach message offering a free business
automation audit to a local SME in Johannesburg, South Africa.

The offer: a free, no-obligation audit showing where they're losing time or
revenue to manual processes, plus what AI/automation system would fix it.
Paid ads are a possible later add-on, not the opener.

Business details:
{details}

Specific gaps identified:
{gaps}

Write ONE personalised outreach message for {channel}.
Requirements:
- Under 120 words for WhatsApp, under 200 for email
- Reference the business by name
- Mention ONE specific gap you noticed (not all of them)
- Offer the free audit as the ask — explicitly low-friction, no cost, no commitment
- End with low-friction CTA: "want a free audit?" OR "worth a 15-min call?"
- Sound human. No "I hope this email finds you well." No corporate speak.
- Do NOT mention your agency name or website

Output: just the message text, nothing else."""

    channel = lead.get("outreach_channels", ["whatsapp"])[0] if isinstance(
        lead.get("outreach_channels"), list) else "whatsapp"

    niche_config = CONFIG["niches"].get(niche, {})
    channel = niche_config.get("outreach_channels", ["whatsapp"])[0]

    details = "\n".join([
        f"Business name: {lead.get('business_name', '')}",
        f"Niche: {lead.get('niche_label', '')}",
        f"Location: {lead.get('address', 'Johannesburg')}",
        f"Rating: {lead.get('rating', 'N/A')} stars, {lead.get('review_count', '?')} reviews",
        f"Has website: {lead.get('has_website', False)}",
        f"Has online booking: {lead.get('has_booking_system', False)}",
        f"Has chatbot/AI assistant: {lead.get('has_chatbot', False)}",
        f"Has CRM signals: {lead.get('has_crm_signals', False)}",
    ])

    return (base
            .replace("{details}", details)
            .replace("{gaps}", gaps)
            .replace("{channel}", channel))


def analyse_and_draft(leads: list) -> list:
    """Run Claude on each HOT/WARM lead to generate gaps + outreach."""
    actionable = [l for l in leads if l["score"] in ("HOT", "WARM")]
    log.info(f"Running Claude on {len(actionable)} actionable leads...")

    for i, lead in enumerate(leads):
        if lead["score"] not in ("HOT", "WARM"):
            lead["gaps_found"] = ""
            lead["outreach_channel"] = ""
            lead["outreach_message"] = ""
            lead["status"] = "Cold — skip"
            continue

        log.info(f"  [{i+1}] Analysing: {lead['business_name']}")

        # Gap analysis
        gap_prompt = build_gap_analysis_prompt(lead)
        gaps = call_claude(gap_prompt, max_tokens=300)
        lead["gaps_found"] = gaps
        time.sleep(1)

        # Outreach draft
        outreach_prompt = build_outreach_prompt(lead, gaps)
        message = call_claude(outreach_prompt, max_tokens=400)
        niche = lead.get("niche", "solar")
        channel = CONFIG["niches"].get(niche, {}).get("outreach_channels", ["whatsapp"])[0]
        lead["outreach_channel"] = channel
        lead["outreach_message"] = message
        lead["status"] = "Ready"
        time.sleep(DELAY)

    return leads


# ── Stage 5: OUTPUT ───────────────────────────────────────────────────────────

def build_final_csv(leads: list, niche: str) -> Path:
    """Write the final output CSV with all columns."""
    columns = CONFIG["output"]["csv_columns"]
    path = OUTPUT_DIR / f"leads_{niche}_{TODAY}.csv"

    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(leads)

    log.info(f"Final output: {path}")
    return path


def print_summary(leads: list, niche: str, output_path: Path):
    hot = [l for l in leads if l.get("score") == "HOT"]
    warm = [l for l in leads if l.get("score") == "WARM"]
    cold = [l for l in leads if l.get("score") == "COLD"]
    ready = [l for l in leads if l.get("status") == "Ready"]

    print("\n" + "="*60)
    print(f"  PIPELINE COMPLETE — {niche.upper()} NICHE")
    print("="*60)
    print(f"  Total leads processed : {len(leads)}")
    print(f"  HOT                   : {len(hot)}")
    print(f"  WARM                  : {len(warm)}")
    print(f"  COLD                  : {len(cold)}")
    print(f"  Ready to send         : {len(ready)}")
    print(f"  Output file           : {output_path}")
    print("="*60)
    if hot:
        print(f"\n  TOP HOT LEADS:")
        for l in hot[:5]:
            print(f"  • {l['business_name']} — {l.get('phone', 'no phone')} — {l.get('website', 'no site')}")
    print()


# ── Main ───────────────────────────────────────────────────────────────────────

def run_pipeline(niche: str, limit: int, enrich_only: bool = False, input_file: str = None):
    niches_to_run = list(CONFIG["niches"].keys()) if niche == "all" else [niche]

    for n in niches_to_run:
        log.info(f"\n{'='*50}\nSTARTING PIPELINE: {n.upper()}\n{'='*50}")

        # Stage 1: Scrape (or load existing)
        if enrich_only and input_file:
            log.info("Loading existing leads from file...")
            leads = load_csv(input_file)
        else:
            leads = scrape_niche(n, limit)
            save_progress(leads, "stage1_raw", n)

        if not leads:
            log.warning(f"No leads found for {n}. Check SerpAPI key and quota.")
            continue

        # Stage 2: Enrich
        leads = enrich_leads(leads)
        save_progress(leads, "stage2_enriched", n)

        # Stage 3 & 4: Analyse + Draft
        leads = analyse_and_draft(leads)
        save_progress(leads, "stage3_drafted", n)

        # Stage 5: Output
        output_path = build_final_csv(leads, n)
        print_summary(leads, n, output_path)

        # Optional: sync new leads to the master Google Sheet
        if CONFIG.get("google_sheets", {}).get("enabled"):
            try:
                from sync_to_sheets import sync as sync_to_sheets
                sync_to_sheets(output_path)
            except Exception as e:
                log.error(f"Google Sheets sync failed (output CSV is still saved): {e}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Lead Generation Pipeline")
    parser.add_argument("--niche", choices=["home", "solar", "clinics", "professional", "logistics", "all"], default="all")
    parser.add_argument("--limit", type=int, default=20, help="Leads per niche")
    parser.add_argument("--enrich-only", action="store_true")
    parser.add_argument("--input", type=str, help="Input CSV for enrich-only mode")
    args = parser.parse_args()

    # Validate API keys
    if SERPAPI_KEY == "YOUR_SERPAPI_KEY_HERE":
        log.error("Set your SerpAPI key in config/settings.json")
        sys.exit(1)
    if ANTHROPIC_KEY == "YOUR_ANTHROPIC_KEY_HERE":
        log.error("Set your Anthropic API key in config/settings.json")
        sys.exit(1)

    run_pipeline(args.niche, args.limit, args.enrich_only, args.input)
