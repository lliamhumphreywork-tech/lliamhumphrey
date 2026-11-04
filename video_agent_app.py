"""
Premium Video Editing Agent — Desktop UI
Requires: pip install customtkinter anthropic openai-whisper moviepy
"""

import sys
import os
import json
import subprocess
import tempfile
import threading
import time
import random
import tkinter as tk
from tkinter import filedialog
import customtkinter as ctk
import anthropic

# Fix SSL certificate verification for Python 3.14 on Mac
try:
    import certifi
    os.environ["SSL_CERT_FILE"] = certifi.where()
    os.environ["REQUESTS_CA_BUNDLE"] = certifi.where()
except ImportError:
    pass

# ── Optional dependencies ─────────────────────────────────────────────────────

try:
    from moviepy.editor import (
        VideoFileClip, concatenate_videoclips,
    )
    MOVIEPY = True
except ImportError:
    MOVIEPY = False

try:
    import whisper
    WHISPER = True
except ImportError:
    WHISPER = False


# ── FFmpeg helpers ────────────────────────────────────────────────────────────

def ffmpeg(*args) -> dict:
    try:
        r = subprocess.run(
            ["ffmpeg", "-y"] + list(args),
            capture_output=True, text=True
        )
        if r.returncode != 0:
            return {"success": False, "error": r.stderr[-800:]}
        return {"success": True}
    except FileNotFoundError:
        return {"success": False, "error": "FFmpeg not found. Please install FFmpeg first."}


def ffprobe_json(input_path):
    r = subprocess.run(
        ["ffprobe", "-v", "quiet", "-print_format", "json",
         "-show_streams", "-show_format", input_path],
        capture_output=True, text=True
    )
    if r.returncode != 0:
        return None
    return json.loads(r.stdout)


# ── Caption helpers ───────────────────────────────────────────────────────────

_LIBASS = None

def _has_libass() -> bool:
    global _LIBASS
    if _LIBASS is None:
        try:
            r = subprocess.run(["ffmpeg", "-filters"], capture_output=True, text=True)
            _LIBASS = any(
                len(p := line.strip().split()) >= 2 and p[1] in ("ass", "subtitles")
                for line in r.stdout.splitlines()
            )
        except Exception:
            _LIBASS = False
    return _LIBASS


def format_ass_time(s: float) -> str:
    h = int(s // 3600); m = int((s % 3600) // 60); sec = s % 60
    return f"{h}:{m:02d}:{int(sec):02d}.{int((sec % 1) * 100):02d}"


def _write_ass(path: str, style_line: str, events: list):
    with open(path, "w", encoding="utf-8") as f:
        f.write(
            "[Script Info]\nScriptType: v4.00+\nWrapStyle: 0\nScaledBorderAndShadow: yes\n\n"
            "[V4+ Styles]\n"
            "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, "
            "BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, "
            "BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n"
            f"{style_line}\n\n[Events]\n"
            "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
        )
        for start, end, text in events:
            f.write(f"Dialogue: 0,{format_ass_time(start)},{format_ass_time(end)},Default,,0,0,0,,{text}\n")


def _esc(p: str) -> str:
    return p.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")


def _tmp_file(ext: str) -> str:
    return f"/tmp/cap_{int(time.time() * 1000) % 10_000_000}_{random.randint(100, 999)}.{ext}"


def _find_font(name: str, size: int):
    from PIL import ImageFont
    dirs = [
        "/Library/Fonts",
        "/System/Library/Fonts/Supplemental",
        "/System/Library/Fonts",
        os.path.expanduser("~/Library/Fonts"),
    ]
    for fname in [name, "Helvetica", "Arial", "Verdana", "Geneva"]:
        for d in dirs:
            for suffix in [".ttf", ".otf", "Bold.ttf"]:
                p = os.path.join(d, fname + suffix)
                if os.path.exists(p):
                    try:
                        return ImageFont.truetype(p, size)
                    except Exception:
                        pass
    return ImageFont.load_default()


def _overlay_captions(input_path: str, output_path: str, events: list,
                       font_name: str, font_size: int, font_color: tuple,
                       shadow: bool, get_pos) -> dict:
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        return {
            "success": False,
            "error": (
                "Pillow not installed. Run:  pip3 install Pillow\n"
                "For best quality (Georgia font) reinstall FFmpeg:\n"
                "  brew tap homebrew-ffmpeg/ffmpeg\n"
                "  brew unlink ffmpeg\n"
                "  brew install homebrew-ffmpeg/ffmpeg/ffmpeg"
            )
        }

    info = get_video_info(input_path)
    vw = info.get("width", 1080)
    vh = info.get("height", 1920)
    fps_str = info.get("fps", "30/1")
    try:
        n, d = fps_str.split("/")
        fps = max(1, int(float(n) / float(d)))
    except Exception:
        fps = 30

    font = _find_font(font_name, font_size)
    png_events = []

    for start, end, text in events:
        img = Image.new("RGBA", (vw, vh), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        try:
            bb = draw.textbbox((0, 0), text, font=font)
            tw, th = bb[2] - bb[0], bb[3] - bb[1]
        except AttributeError:
            tw, th = font.getsize(text)
        x, y = get_pos(tw, th, vw, vh)
        if shadow:
            draw.text((x + 2, y + 2), text, font=font, fill=(0, 0, 0, 180))
        draw.text((x, y), text, font=font, fill=(*font_color, 255))
        png = _tmp_file("png")
        img.save(png, "PNG")
        png_events.append((png, start, end))

    args = ["-i", input_path]
    for png, _, _ in png_events:
        args += ["-loop", "1", "-framerate", str(fps), "-i", png]

    fc_parts = []
    prev = "[0:v]"
    for i, (_, start, end) in enumerate(png_events):
        ov = f"[ov{i}]"
        out = f"[v{i}]"
        fc_parts.append(f"[{i+1}:v]format=rgba{ov}")
        fc_parts.append(
            f"{prev}{ov}overlay=enable='between(t,{start:.3f},{end:.3f})':format=auto{out}"
        )
        prev = out

    args += [
        "-filter_complex", ";".join(fc_parts),
        "-map", prev, "-map", "0:a",
        "-c:v", "libx264", "-c:a", "copy", "-shortest",
        output_path,
    ]
    r = ffmpeg(*args)

    for png, _, _ in png_events:
        try:
            os.remove(png)
        except Exception:
            pass
    return r


def _burn_captions(input_path: str, output_path: str, events: list,
                    ass_style_line: str,
                    font_name: str, font_size: int, font_color: tuple,
                    shadow: bool, get_pos) -> dict:
    if _has_libass():
        ass_path = _tmp_file("ass")
        _write_ass(ass_path, ass_style_line, events)
        ep = _esc(ass_path)
        r = ffmpeg("-i", input_path, "-vf", f"ass=filename={ep}", "-c:a", "copy", output_path)
        try:
            os.remove(ass_path)
        except Exception:
            pass
        return r
    else:
        return _overlay_captions(
            input_path, output_path, events,
            font_name, font_size, font_color, shadow, get_pos
        )


# ── Tool functions ────────────────────────────────────────────────────────────

def get_video_info(input_path: str) -> dict:
    try:
        data = ffprobe_json(input_path)
        if not data:
            return {"error": "Could not read video"}
        info = {"file": input_path}
        for s in data.get("streams", []):
            if s.get("codec_type") == "video":
                info.update({
                    "width": s.get("width"),
                    "height": s.get("height"),
                    "fps": s.get("r_frame_rate"),
                    "video_codec": s.get("codec_name"),
                })
            elif s.get("codec_type") == "audio":
                info["audio_codec"] = s.get("codec_name")
        fmt = data.get("format", {})
        info["duration_seconds"] = round(float(fmt.get("duration", 0)), 2)
        info["size_mb"] = round(int(fmt.get("size", 0)) / 1024 / 1024, 1)
        return info
    except Exception as e:
        return {"error": str(e)}


def trim_clip(input_path: str, output_path: str, start_time: float, end_time: float) -> dict:
    r = ffmpeg("-i", input_path, "-ss", str(start_time), "-to", str(end_time), "-c", "copy", output_path)
    if r["success"]:
        r["output"] = output_path
    return r


def merge_clips(video_paths: list, output_path: str, transition: str = "none") -> dict:
    if transition in ("fade", "crossfade") and MOVIEPY:
        try:
            clips = [VideoFileClip(p) for p in video_paths]
            d = 0.5
            if transition == "fade":
                processed = []
                for i, c in enumerate(clips):
                    if i > 0: c = c.fadein(d)
                    if i < len(clips) - 1: c = c.fadeout(d)
                    processed.append(c)
                final = concatenate_videoclips(processed)
            else:
                final = concatenate_videoclips(clips, method="compose", padding=-d)
            final.write_videofile(output_path, codec="libx264", audio_codec="aac", logger=None)
            for c in clips: c.close()
            return {"success": True, "output": output_path}
        except Exception as e:
            return {"success": False, "error": str(e)}
    else:
        list_file = tempfile.mktemp(suffix=".txt")
        with open(list_file, "w") as f:
            for p in video_paths:
                f.write(f"file '{os.path.abspath(p)}'\n")
        r = ffmpeg("-f", "concat", "-safe", "0", "-i", list_file, "-c", "copy", output_path)
        os.remove(list_file)
        if r["success"]: r["output"] = output_path
        return r


def add_captions(input_path: str, output_path: str, style: str = "modern") -> dict:
    if not WHISPER:
        return {"success": False, "error": "Whisper not installed. Run: pip install openai-whisper"}
    styles = {
        "modern":   {"font": "Arial", "size": 22, "outline": 2, "marginv": 40,
                     "ass_color": "&H00FFFFFF", "rgb": (255, 255, 255)},
        "capcut":   {"font": "Arial", "size": 26, "outline": 3, "marginv": 35,
                     "ass_color": "&H00FFFFFF", "rgb": (255, 255, 255)},
        "yellow":   {"font": "Arial", "size": 24, "outline": 2, "marginv": 40,
                     "ass_color": "&H0000FFFF", "rgb": (255, 255, 0)},
        "bold_red": {"font": "Arial", "size": 28, "outline": 3, "marginv": 40,
                     "ass_color": "&H000000FF", "rgb": (255, 0, 0)},
    }
    s = styles.get(style, styles["modern"])
    try:
        model = whisper.load_model("base")
        result = whisper.transcribe(model, input_path)
        segments = result.get("segments", [])
        events = [(seg["start"], seg["end"], seg["text"].strip()) for seg in segments]
        ass_style = (
            f"Style: Default,{s['font']},{s['size']},{s['ass_color']},&H000000FF,"
            f"&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,{s['outline']},0,"
            f"2,10,10,{s['marginv']},1"
        )
        mv = s["marginv"]
        r = _burn_captions(
            input_path, output_path, events, ass_style,
            font_name=s["font"], font_size=s["size"], font_color=s["rgb"],
            shadow=True,
            get_pos=lambda tw, th, vw, vh: ((vw - tw) // 2, vh - th - mv),
        )
        if r["success"]:
            return {"success": True, "output": output_path, "caption_count": len(segments), "style": style}
        return r
    except Exception as e:
        return {"success": False, "error": str(e)}


def word_by_word_captions(input_path: str, output_path: str, style: str = "capcut") -> dict:
    """CapCut-style captions where each word appears one at a time."""
    if not WHISPER:
        return {"success": False, "error": "Whisper not installed. Run: pip install openai-whisper"}
    styles = {
        "capcut": {"font": "Arial", "size": 26, "outline": 3, "marginv": 35,
                   "ass_color": "&H00FFFFFF", "rgb": (255, 255, 255)},
        "yellow": {"font": "Arial", "size": 24, "outline": 2, "marginv": 40,
                   "ass_color": "&H0000FFFF", "rgb": (255, 255, 0)},
        "bold":   {"font": "Arial", "size": 30, "outline": 3, "marginv": 35,
                   "ass_color": "&H00FFFFFF", "rgb": (255, 255, 255)},
    }
    s = styles.get(style, styles["capcut"])
    try:
        model = whisper.load_model("base")
        result = whisper.transcribe(model, input_path, word_timestamps=True)
        events = []
        for seg in result.get("segments", []):
            words = seg.get("words", [])
            if not words:
                events.append((seg["start"], seg["end"], seg["text"].strip()))
                continue
            for w in words:
                wt = w.get("word", "").strip()
                if wt:
                    events.append((w["start"], w["end"], wt))
        ass_style = (
            f"Style: Default,{s['font']},{s['size']},{s['ass_color']},&H000000FF,"
            f"&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,{s['outline']},0,"
            f"2,10,10,{s['marginv']},1"
        )
        mv = s["marginv"]
        r = _burn_captions(
            input_path, output_path, events, ass_style,
            font_name=s["font"], font_size=s["size"], font_color=s["rgb"],
            shadow=True,
            get_pos=lambda tw, th, vw, vh: ((vw - tw) // 2, vh - th - mv),
        )
        if r["success"]:
            return {"success": True, "output": output_path, "style": f"word-by-word {style}"}
        return r
    except Exception as e:
        return {"success": False, "error": str(e)}


def lliam_captions(input_path: str, output_path: str) -> dict:
    """Lliam's signature caption style: Georgia serif, word-by-word, right-aligned, clean white, no outline."""
    if not WHISPER:
        return {"success": False, "error": "Whisper not installed. Run: pip install openai-whisper"}
    try:
        model = whisper.load_model("base")
        result = whisper.transcribe(model, input_path, word_timestamps=True)
        events = []
        for seg in result.get("segments", []):
            words = seg.get("words", [])
            if not words:
                events.append((seg["start"], seg["end"], seg["text"].strip()))
                continue
            for w in words:
                wt = w.get("word", "").strip()
                if wt:
                    events.append((w["start"], w["end"], wt))
        ass_style = (
            "Style: Default,Georgia,38,&H00FFFFFF,&H000000FF,"
            "&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,"
            "6,0,80,20,1"
        )
        def right_middle(tw, th, vw, vh):
            return (vw - tw - 80, (vh - th) // 2)

        r = _burn_captions(
            input_path, output_path, events, ass_style,
            font_name="Georgia", font_size=38, font_color=(255, 255, 255),
            shadow=False,
            get_pos=right_middle,
        )
        if r["success"]:
            return {"success": True, "output": output_path, "style": "Lliam signature serif captions"}
        return r
    except Exception as e:
        return {"success": False, "error": str(e)}


def add_text_overlay(input_path: str, output_path: str, text: str,
                     position: str = "center", style: str = "title",
                     start_time: float = 0, duration: float = 3) -> dict:
    info = get_video_info(input_path)
    h = info.get("height", 1080)
    y_map = {"center": "(h-text_h)/2", "top": "h*0.08", "bottom": "h*0.88", "lower_third": "h*0.78"}
    size_map = {"title": max(48, h // 20), "subtitle": max(32, h // 30), "lower_third": max(28, h // 35), "highlight": max(40, h // 24)}
    color_map = {"title": "white", "subtitle": "white", "lower_third": "white", "highlight": "yellow"}
    y_pos = y_map.get(position, y_map["center"])
    font_size = size_map.get(style, 48)
    color = color_map.get(style, "white")
    safe_text = text.replace("'", "\\'")
    enable = f"between(t\\,{start_time}\\,{start_time + duration})"
    vf = (f"drawtext=text='{safe_text}':fontfile=/System/Library/Fonts/Helvetica.ttc:"
          f"fontsize={font_size}:fontcolor={color}:borderw=3:bordercolor=black:"
          f"x=(w-text_w)/2:y={y_pos}:enable='{enable}'")
    r = ffmpeg("-i", input_path, "-vf", vf, "-c:a", "copy", output_path)
    if r["success"]: r["output"] = output_path
    return r


def add_background_music(video_path: str, music_path: str, output_path: str,
                          music_volume: float = 0.3, fade_out: bool = True) -> dict:
    info = get_video_info(video_path)
    duration = info.get("duration_seconds", 0)
    fade_filter = f",afade=t=out:st={max(0, duration - 2)}:d=2" if fade_out else ""
    af = (f"[0:a]volume=1.0[orig];[1:a]volume={music_volume}{fade_filter}[music];"
          f"[orig][music]amix=inputs=2:duration=first[out]")
    r = ffmpeg("-i", video_path, "-i", music_path, "-filter_complex", af,
               "-map", "0:v", "-map", "[out]", "-c:v", "copy", "-c:a", "aac", output_path)
    if r["success"]: r["output"] = output_path
    return r


def color_grade(input_path: str, output_path: str, preset: str = "cinematic") -> dict:
    presets = {
        "cinematic":    ("curves=r='0/0 0.12/0.08 0.88/0.93 1/1':"
                         "g='0/0 0.12/0.09 0.88/0.91 1/1':"
                         "b='0/0.02 0.5/0.5 1/0.97',"
                         "eq=contrast=1.08:saturation=0.82"),
        "orange_teal":  ("colorchannelmixer=rr=1.15:rb=-0.05:gb=-0.08:bb=1.12:bg=0.08,"
                         "eq=saturation=1.3:contrast=1.06"),
        "film":         ("curves=vintage,"
                         "eq=contrast=1.04:saturation=0.88:brightness=-0.01"),
        "warm":         ("colorbalance=rs=0.08:gs=0.03:bs=-0.08:rm=0.04:gm=0.01:bm=-0.04,"
                         "eq=contrast=1.05:saturation=1.12:brightness=0.02"),
        "cool":         ("colorbalance=rs=-0.06:gs=0:bs=0.09:rm=-0.03:gm=0.01:bm=0.05,"
                         "eq=contrast=1.05:saturation=1.0"),
        "moody":        ("curves=r='0/0 0.5/0.44 1/0.88':g='0/0 0.5/0.43 1/0.87':b='0/0.04 0.5/0.5 1/0.84',"
                         "eq=contrast=1.22:saturation=0.78:brightness=-0.05"),
        "vibrant":      "eq=contrast=1.12:saturation=1.55:brightness=0.02",
        "bright":       "eq=brightness=0.1:contrast=0.95:saturation=1.12",
        "matte":        ("curves=r='0/0.05 1/0.92':g='0/0.04 1/0.91':b='0/0.06 1/0.88',"
                         "eq=contrast=0.92:saturation=0.85"),
        "sunset":       ("colorchannelmixer=rr=1.18:rb=0.02:gb=0.02:gr=-0.05:bb=0.82,"
                         "eq=saturation=1.25:contrast=1.08"),
        # Lliam's signature preset — built for dark skin in natural/golden light
        # v2: pulled back yellow, cooled highlights for more natural look
        "lliam":        ("curves=r='0/0.04 0.15/0.21 0.5/0.57 0.85/0.88 1/1':"
                         "g='0/0.02 0.15/0.19 0.5/0.52 0.85/0.86 1/1':"
                         "b='0/0.01 0.15/0.14 0.5/0.47 0.85/0.83 1/0.95',"
                         "colorbalance=rs=0.03:gs=0.01:bs=-0.04:"
                         "rm=0.06:gm=0.01:bm=-0.06:"
                         "rh=0.01:gh=0.00:bh=0.01,"
                         "eq=contrast=1.06:saturation=1.18:brightness=0.02"),
    }
    vf = presets.get(preset)
    if not vf:
        return {"success": False, "error": f"Unknown preset. Options: {list(presets.keys())}"}
    r = ffmpeg("-i", input_path, "-vf", vf, "-c:a", "copy", output_path)
    if r["success"]:
        r["output"] = output_path
        r["preset"] = preset
    return r


def add_cinematic_bars(input_path: str, output_path: str, ratio: str = "2.39") -> dict:
    info = get_video_info(input_path)
    w = info.get("width", 1920)
    h = info.get("height", 1080)
    ratio_f = float(ratio)
    target_h = int(w / ratio_f)
    if target_h >= h:
        return {"success": False, "error": f"Video is already wider than {ratio}:1"}
    bar_h = (h - target_h) // 2
    vf = f"crop={w}:{target_h}:0:{bar_h},pad={w}:{h}:0:{bar_h}:black"
    r = ffmpeg("-i", input_path, "-vf", vf, "-c:a", "copy", output_path)
    if r["success"]:
        r["output"] = output_path
        r["effect"] = f"{ratio}:1 cinematic bars"
    return r


def add_vignette(input_path: str, output_path: str, intensity: str = "medium") -> dict:
    angle_map = {"light": 0.5, "medium": 0.8, "strong": 1.2}
    angle = angle_map.get(intensity, 0.8)
    vf = f"vignette=angle={angle}:mode=forward"
    r = ffmpeg("-i", input_path, "-vf", vf, "-c:a", "copy", output_path)
    if r["success"]:
        r["output"] = output_path
        r["effect"] = f"{intensity} vignette"
    return r


def ken_burns_zoom(input_path: str, output_path: str,
                   direction: str = "in", zoom_factor: float = 1.3) -> dict:
    info = get_video_info(input_path)
    w = info.get("width", 1920)
    h = info.get("height", 1080)
    duration = info.get("duration_seconds", 10)
    fps_str = info.get("fps", "30/1")
    try:
        num, den = fps_str.split("/")
        fps = float(num) / float(den)
    except Exception:
        fps = 30.0
    n = int(duration * fps)
    zoom_factor = max(1.05, min(2.0, zoom_factor))
    step = (zoom_factor - 1.0) / n
    if direction == "in":
        z_expr = f"min(pzoom+{step:.6f},{zoom_factor})"
    else:
        z_expr = f"max(pzoom-{step:.6f},1.0)"
    vf = (f"zoompan=z='{z_expr}':"
          f"x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':"
          f"d={n}:s={w}x{h}:fps={fps}")
    r = ffmpeg("-i", input_path, "-vf", vf, "-c:a", "copy", output_path)
    if r["success"]:
        r["output"] = output_path
        r["effect"] = f"Ken Burns zoom {direction}"
    return r


def resize_for_platform(input_path: str, output_path: str, platform: str = "youtube") -> dict:
    targets = {
        "youtube":   ("1920", "1080"),
        "tiktok":    ("1080", "1920"),
        "reels":     ("1080", "1920"),
        "shorts":    ("1080", "1920"),
        "instagram": ("1080", "1080"),
        "twitter":   ("1280", "720"),
    }
    dims = targets.get(platform.lower())
    if not dims:
        return {"success": False, "error": f"Unknown platform. Options: {list(targets.keys())}"}
    w, h = dims
    vf = (f"scale={w}:{h}:force_original_aspect_ratio=decrease,"
          f"pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:black")
    r = ffmpeg("-i", input_path, "-vf", vf, "-c:a", "copy", output_path)
    if r["success"]:
        r["output"] = output_path
        r["resolution"] = f"{w}x{h}"
        r["platform"] = platform
    return r


def add_fade(input_path: str, output_path: str, fade_in: float = 0.5, fade_out: float = 0.5) -> dict:
    info = get_video_info(input_path)
    dur = info.get("duration_seconds", 0)
    vf_parts, af_parts = [], []
    if fade_in > 0:
        vf_parts.append(f"fade=t=in:st=0:d={fade_in}")
        af_parts.append(f"afade=t=in:st=0:d={fade_in}")
    if fade_out > 0:
        fo = max(0, dur - fade_out)
        vf_parts.append(f"fade=t=out:st={fo}:d={fade_out}")
        af_parts.append(f"afade=t=out:st={fo}:d={fade_out}")
    args = ["-i", input_path]
    if vf_parts: args += ["-vf", ",".join(vf_parts)]
    if af_parts: args += ["-af", ",".join(af_parts)]
    args += ["-c:v", "libx264", "-c:a", "aac", output_path]
    r = ffmpeg(*args)
    if r["success"]: r["output"] = output_path
    return r


def change_speed(input_path: str, output_path: str, speed: float) -> dict:
    speed = max(0.25, min(4.0, speed))
    vf = f"setpts={1/speed}*PTS"
    if speed < 0.5:
        af = f"atempo=0.5,atempo={speed/0.5}"
    elif speed > 2.0:
        af = f"atempo=2.0,atempo={speed/2.0}"
    else:
        af = f"atempo={speed}"
    r = ffmpeg("-i", input_path, "-vf", vf, "-af", af, output_path)
    if r["success"]:
        r["output"] = output_path
        r["speed"] = speed
    return r


def remove_audio(input_path: str, output_path: str) -> dict:
    r = ffmpeg("-i", input_path, "-an", "-c:v", "copy", output_path)
    if r["success"]: r["output"] = output_path
    return r


# ── Tool registry ─────────────────────────────────────────────────────────────

TOOLS = [
    {
        "name": "get_video_info",
        "description": "Get information about a video: duration, resolution, fps, file size.",
        "input_schema": {"type": "object", "properties": {"input_path": {"type": "string"}}, "required": ["input_path"]}
    },
    {
        "name": "trim_clip",
        "description": "Cut/trim a video to keep only a specific time range.",
        "input_schema": {
            "type": "object",
            "properties": {
                "input_path": {"type": "string"}, "output_path": {"type": "string"},
                "start_time": {"type": "number"}, "end_time": {"type": "number"}
            },
            "required": ["input_path", "output_path", "start_time", "end_time"]
        }
    },
    {
        "name": "merge_clips",
        "description": "Join multiple video clips into one. Transitions: none, fade, crossfade.",
        "input_schema": {
            "type": "object",
            "properties": {
                "video_paths": {"type": "array", "items": {"type": "string"}},
                "output_path": {"type": "string"},
                "transition":  {"type": "string", "enum": ["none", "fade", "crossfade"]}
            },
            "required": ["video_paths", "output_path"]
        }
    },
    {
        "name": "add_captions",
        "description": "Auto-transcribe speech and burn in styled captions. Styles: modern, capcut, yellow, bold_red.",
        "input_schema": {
            "type": "object",
            "properties": {
                "input_path": {"type": "string"}, "output_path": {"type": "string"},
                "style": {"type": "string", "enum": ["modern", "capcut", "yellow", "bold_red"]}
            },
            "required": ["input_path", "output_path"]
        }
    },
    {
        "name": "word_by_word_captions",
        "description": "CapCut-style captions where each word pops up individually as it's spoken. Very premium and engaging. Styles: capcut, yellow, bold.",
        "input_schema": {
            "type": "object",
            "properties": {
                "input_path": {"type": "string"}, "output_path": {"type": "string"},
                "style": {"type": "string", "enum": ["capcut", "yellow", "bold"]}
            },
            "required": ["input_path", "output_path"]
        }
    },
    {
        "name": "lliam_captions",
        "description": "Lliam's signature caption style — Georgia serif, word-by-word, right-aligned, clean white, no outline. Editorial and cinematic. Use as default caption style for Lliam's content.",
        "input_schema": {
            "type": "object",
            "properties": {
                "input_path": {"type": "string"}, "output_path": {"type": "string"}
            },
            "required": ["input_path", "output_path"]
        }
    },
    {
        "name": "add_text_overlay",
        "description": "Add stylized text — title cards, lower thirds, highlights. Styles: title, subtitle, lower_third, highlight. Positions: center, top, bottom, lower_third.",
        "input_schema": {
            "type": "object",
            "properties": {
                "input_path": {"type": "string"}, "output_path": {"type": "string"},
                "text": {"type": "string"},
                "position": {"type": "string", "enum": ["center", "top", "bottom", "lower_third"]},
                "style": {"type": "string", "enum": ["title", "subtitle", "lower_third", "highlight"]},
                "start_time": {"type": "number"}, "duration": {"type": "number"}
            },
            "required": ["input_path", "output_path", "text"]
        }
    },
    {
        "name": "add_background_music",
        "description": "Mix background music into the video. Adjustable volume, auto fade-out.",
        "input_schema": {
            "type": "object",
            "properties": {
                "video_path": {"type": "string"}, "music_path": {"type": "string"},
                "output_path": {"type": "string"},
                "music_volume": {"type": "number"},
                "fade_out": {"type": "boolean"}
            },
            "required": ["video_path", "music_path", "output_path"]
        }
    },
    {
        "name": "color_grade",
        "description": "Apply professional cinematic color grade. Presets: cinematic, orange_teal, film, warm, cool, moody, vibrant, bright, matte, sunset.",
        "input_schema": {
            "type": "object",
            "properties": {
                "input_path": {"type": "string"}, "output_path": {"type": "string"},
                "preset": {"type": "string", "enum": ["cinematic", "orange_teal", "film", "warm", "cool", "moody", "vibrant", "bright", "matte", "sunset", "lliam"]}
            },
            "required": ["input_path", "output_path"]
        }
    },
    {
        "name": "add_cinematic_bars",
        "description": "Add cinematic letterbox black bars (2.39:1 or 2.35:1). Makes content look like a film.",
        "input_schema": {
            "type": "object",
            "properties": {
                "input_path": {"type": "string"}, "output_path": {"type": "string"},
                "ratio": {"type": "string", "enum": ["2.39", "2.35"]}
            },
            "required": ["input_path", "output_path"]
        }
    },
    {
        "name": "add_vignette",
        "description": "Add a cinematic vignette — darkens the edges to draw focus to the center. Intensities: light, medium, strong.",
        "input_schema": {
            "type": "object",
            "properties": {
                "input_path": {"type": "string"}, "output_path": {"type": "string"},
                "intensity": {"type": "string", "enum": ["light", "medium", "strong"]}
            },
            "required": ["input_path", "output_path"]
        }
    },
    {
        "name": "ken_burns_zoom",
        "description": "Slow cinematic zoom in or out (Ken Burns effect). Direction: in or out. zoom_factor: 1.2 subtle, 1.5 dramatic.",
        "input_schema": {
            "type": "object",
            "properties": {
                "input_path": {"type": "string"}, "output_path": {"type": "string"},
                "direction": {"type": "string", "enum": ["in", "out"]},
                "zoom_factor": {"type": "number"}
            },
            "required": ["input_path", "output_path"]
        }
    },
    {
        "name": "resize_for_platform",
        "description": "Resize for social media. Platforms: youtube (16:9), tiktok/reels/shorts (9:16), instagram (1:1), twitter.",
        "input_schema": {
            "type": "object",
            "properties": {
                "input_path": {"type": "string"}, "output_path": {"type": "string"},
                "platform": {"type": "string", "enum": ["youtube", "tiktok", "reels", "shorts", "instagram", "twitter"]}
            },
            "required": ["input_path", "output_path", "platform"]
        }
    },
    {
        "name": "add_fade",
        "description": "Add smooth fade-in and/or fade-out.",
        "input_schema": {
            "type": "object",
            "properties": {
                "input_path": {"type": "string"}, "output_path": {"type": "string"},
                "fade_in": {"type": "number"}, "fade_out": {"type": "number"}
            },
            "required": ["input_path", "output_path"]
        }
    },
    {
        "name": "change_speed",
        "description": "Speed up or slow down. 2.0 = 2x faster, 0.5 = slow motion.",
        "input_schema": {
            "type": "object",
            "properties": {
                "input_path": {"type": "string"}, "output_path": {"type": "string"},
                "speed": {"type": "number"}
            },
            "required": ["input_path", "output_path", "speed"]
        }
    },
    {
        "name": "remove_audio",
        "description": "Remove/mute audio from the video.",
        "input_schema": {
            "type": "object",
            "properties": {
                "input_path": {"type": "string"}, "output_path": {"type": "string"}
            },
            "required": ["input_path", "output_path"]
        }
    },
]

TOOL_MAP = {
    "get_video_info": get_video_info,
    "trim_clip": trim_clip,
    "merge_clips": merge_clips,
    "add_captions": add_captions,
    "word_by_word_captions": word_by_word_captions,
    "lliam_captions": lliam_captions,
    "add_text_overlay": add_text_overlay,
    "add_background_music": add_background_music,
    "color_grade": color_grade,
    "add_cinematic_bars": add_cinematic_bars,
    "add_vignette": add_vignette,
    "ken_burns_zoom": ken_burns_zoom,
    "resize_for_platform": resize_for_platform,
    "add_fade": add_fade,
    "change_speed": change_speed,
    "remove_audio": remove_audio,
}

SYSTEM = """You are a world-class video editor with deep experience in Final Cut Pro, DaVinci Resolve, and CapCut. You create premium, cinematic social media content for Lliam.

LLIAM'S SIGNATURE STYLE (use this by default unless asked otherwise):
- Color grade: "lliam" preset — built for his dark skin tone in natural/golden light. Lifts shadows so skin detail pops, warms midtones, brings out environment. Never default to "moody" or "cinematic" — they crush dark skin.
- Captions: lliam_captions — Georgia serif, word-by-word, right-aligned, clean white, no outline. Like fin.kwong / marcel.stxm.
- Always add medium vignette
- Always fade in and out
- Cinematic bars 2.39:1 for landscape content
- Feel: short film, not a social media clip. Intentional, premium, cinematic.

MY STYLE WORKFLOW (when user says "my style" or "make it mine"):
1. Color grade → "lliam" preset
2. Vignette → medium
3. Captions → lliam_captions
4. Cinematic bars 2.39:1 (landscape only)
5. Fade in/out 0.5s
6. Resize for platform

COLOR GRADE GUIDE:
- lliam: Lliam's personal preset — dark skin, golden light, lifted shadows ← DEFAULT
- Cinematic: timeless, desaturated, slight blue shadows
- Orange & Teal: Hollywood blockbuster
- Film: vintage, soft, organic
- Moody: dark, dramatic — avoid as default for dark skin
- Vibrant: punchy, energetic social media
- Sunset: golden hour, travel
- Matte: aesthetic, soft, faded

Always tell the user exactly what file was created and what was done. Be specific. Suggest next steps."""


def run_agent(messages: list, on_tool=None) -> str:
    client = anthropic.Anthropic()
    while True:
        response = client.messages.create(
            model="claude-opus-4-7",
            max_tokens=4096,
            system=SYSTEM,
            tools=TOOLS,
            messages=messages,
        )
        if response.stop_reason == "end_turn":
            for block in response.content:
                if hasattr(block, "text"):
                    return block.text
            return "Done."
        if response.stop_reason == "tool_use":
            messages.append({"role": "assistant", "content": response.content})
            results = []
            for block in response.content:
                if block.type == "tool_use":
                    if on_tool:
                        label = block.name.replace("_", " ").title()
                        on_tool("tool", f"⚙️  {label}...", None)
                    fn = TOOL_MAP.get(block.name)
                    result = fn(**block.input) if fn else {"error": "Unknown tool"}
                    if on_tool:
                        if not result.get("success", True):
                            on_tool("error", f"❌  {result.get('error', 'unknown error')}", None)
                        else:
                            out = result.get("output", "")
                            on_tool("output", os.path.basename(out) if out else "", out or None)
                    results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": json.dumps(result),
                    })
            messages.append({"role": "user", "content": results})


# ── Colour palette ────────────────────────────────────────────────────────────

BG_DEEP    = "#0d1117"   # very dark navy
BG_CARD    = "#161b22"   # dark card bg
BG_SURFACE = "#1c2128"   # slightly lighter
ACCENT     = "#6366f1"   # indigo/purple
ACCENT_DIM = "#4f46e5"
TEXT_PRIMARY   = "#e6edf3"
TEXT_SECONDARY = "#8b949e"
TEXT_MUTED     = "#484f58"
SUCCESS        = "#3fb950"
ERROR_COLOR    = "#f85149"
BUBBLE_USER    = "#21262d"   # slightly lighter than card for user bubbles
PILL_BG        = "#21262d"


# ── Main Application ──────────────────────────────────────────────────────────

class VideoAgentApp(ctk.CTk):
    def __init__(self):
        super().__init__()
        ctk.set_appearance_mode("dark")

        self.title("🎬 Video Editor Agent")
        self.geometry("900x720")
        self.minsize(700, 560)
        self.configure(fg_color=BG_DEEP)

        self.messages: list = []
        self.current_file: str = ""
        self._typing_job = None
        self._typing_frame = None
        self._dot_step = 0

        self._build_ui()

    # ── UI construction ───────────────────────────────────────────────────────

    def _build_ui(self):
        # ---- Header ----
        header = ctk.CTkFrame(self, fg_color=BG_CARD, height=60, corner_radius=0)
        header.pack(fill="x", side="top")
        header.pack_propagate(False)

        header_inner = ctk.CTkFrame(header, fg_color="transparent")
        header_inner.pack(fill="both", expand=True, padx=20)

        ctk.CTkLabel(
            header_inner,
            text="🎬  Video Editor Agent",
            font=ctk.CTkFont(family="SF Pro Display", size=18, weight="bold"),
            text_color=TEXT_PRIMARY,
        ).pack(side="left", pady=16)

        # Status indicator (right side)
        self._status_dot = ctk.CTkLabel(
            header_inner,
            text="● Ready",
            font=ctk.CTkFont(size=12),
            text_color=SUCCESS,
        )
        self._status_dot.pack(side="right", pady=16)

        # ---- Quick actions bar ----
        actions_bar = ctk.CTkFrame(self, fg_color=BG_SURFACE, height=54, corner_radius=0)
        actions_bar.pack(fill="x", side="top")
        actions_bar.pack_propagate(False)

        actions_inner = ctk.CTkFrame(actions_bar, fg_color="transparent")
        actions_inner.pack(fill="y", side="left", padx=14)

        quick_actions = [
            ("⭐  My Style",  "Apply my signature style to [file]: lliam color grade, serif captions, vignette, cinematic bars, and fade in/out"),
            ("✂️  Trim",      "Trim [file] from [start] to [end] seconds"),
            ("🎨  Grade",     "Apply my lliam color grade to [file]"),
            ("📝  Captions",  "Add my signature serif captions to [file]"),
            ("🎬  Cinematic", "Make [file] cinematic: lliam grade, vignette, cinematic bars, fade in/out"),
            ("📱  TikTok",    "Format [file] for TikTok"),
            ("📱  Reels",     "Format [file] for Instagram Reels"),
            ("📱  YouTube",   "Format [file] for YouTube"),
        ]

        for label, template in quick_actions:
            btn = ctk.CTkButton(
                actions_inner,
                text=label,
                width=90,
                height=30,
                fg_color=BG_CARD,
                hover_color=BG_DEEP,
                text_color=TEXT_SECONDARY,
                font=ctk.CTkFont(size=12),
                corner_radius=6,
                border_width=1,
                border_color=TEXT_MUTED,
                command=lambda t=template: self._insert_template(t),
            )
            btn.pack(side="left", padx=4, pady=12)

        # ---- Chat area ----
        self._chat_outer = ctk.CTkFrame(self, fg_color=BG_DEEP, corner_radius=0)
        self._chat_outer.pack(fill="both", expand=True)

        self._chat_scroll = ctk.CTkScrollableFrame(
            self._chat_outer,
            fg_color=BG_DEEP,
            scrollbar_button_color=BG_SURFACE,
            scrollbar_button_hover_color=TEXT_MUTED,
            corner_radius=0,
        )
        self._chat_scroll.pack(fill="both", expand=True, padx=0, pady=0)
        self._chat_scroll.grid_columnconfigure(0, weight=1)

        # Welcome message
        self._add_agent_bubble(
            "Hey! I'm your premium video editing agent.\n\n"
            "Drop a video file using the 📁 button, or just tell me what you want to do — "
            "trim, color grade, add captions, resize for TikTok/YouTube, and much more.\n\n"
            "Quick tip: use the buttons above to instantly fill in common commands."
        )

        # ---- Input bar ----
        input_bar = ctk.CTkFrame(self, fg_color=BG_CARD, height=72, corner_radius=0)
        input_bar.pack(fill="x", side="bottom")
        input_bar.pack_propagate(False)

        input_inner = ctk.CTkFrame(input_bar, fg_color="transparent")
        input_inner.pack(fill="both", expand=True, padx=16, pady=12)

        # File picker button
        file_btn = ctk.CTkButton(
            input_inner,
            text="📁",
            width=44,
            height=44,
            fg_color=BG_SURFACE,
            hover_color=BG_DEEP,
            text_color=TEXT_PRIMARY,
            font=ctk.CTkFont(size=18),
            corner_radius=10,
            command=self._pick_file,
        )
        file_btn.pack(side="left", padx=(0, 10))

        # Text entry
        self._input = ctk.CTkEntry(
            input_inner,
            placeholder_text="Describe what you want to do with your video...",
            fg_color=BG_SURFACE,
            border_color=TEXT_MUTED,
            text_color=TEXT_PRIMARY,
            placeholder_text_color=TEXT_MUTED,
            font=ctk.CTkFont(size=14),
            height=44,
            corner_radius=10,
        )
        self._input.pack(side="left", fill="x", expand=True, padx=(0, 10))
        self._input.bind("<Return>", lambda e: self._send())

        # Send button
        send_btn = ctk.CTkButton(
            input_inner,
            text="Send",
            width=72,
            height=44,
            fg_color=ACCENT,
            hover_color=ACCENT_DIM,
            text_color="white",
            font=ctk.CTkFont(size=14, weight="bold"),
            corner_radius=10,
            command=self._send,
        )
        send_btn.pack(side="left")

    # ── Chat bubble helpers ───────────────────────────────────────────────────

    def _chat_row(self, align: str = "left") -> ctk.CTkFrame:
        """Return a full-width row frame. Children pack to left or right."""
        row = ctk.CTkFrame(self._chat_scroll, fg_color="transparent")
        row.pack(fill="x", padx=16, pady=3)
        return row

    def _add_user_bubble(self, text: str):
        row = self._chat_row()
        # Spacer pushes bubble right
        ctk.CTkFrame(row, fg_color="transparent").pack(side="left", fill="x", expand=True)
        bubble = ctk.CTkFrame(row, fg_color=ACCENT, corner_radius=14)
        bubble.pack(side="right", padx=(60, 0))
        ctk.CTkLabel(
            bubble,
            text=text,
            wraplength=480,
            justify="left",
            text_color="white",
            font=ctk.CTkFont(size=14),
            padx=14, pady=10,
        ).pack()
        self._scroll_bottom()

    def _add_agent_bubble(self, text: str):
        row = self._chat_row()
        bubble = ctk.CTkFrame(row, fg_color=BG_CARD, corner_radius=14)
        bubble.pack(side="left", padx=(0, 60))
        ctk.CTkLabel(
            bubble,
            text=text,
            wraplength=520,
            justify="left",
            text_color=TEXT_PRIMARY,
            font=ctk.CTkFont(size=14),
            padx=14, pady=10,
        ).pack()
        self._scroll_bottom()

    def _add_file_info_card(self, info: dict):
        """Show a card with video metadata after file selection."""
        name = os.path.basename(info.get("file", "Unknown"))
        dur  = info.get("duration_seconds", "?")
        w    = info.get("width", "?")
        h    = info.get("height", "?")
        mb   = info.get("size_mb", "?")

        row = self._chat_row()
        card = ctk.CTkFrame(row, fg_color=BG_SURFACE, corner_radius=12, border_width=1, border_color=TEXT_MUTED)
        card.pack(side="left", padx=(0, 60))

        ctk.CTkLabel(
            card,
            text=f"📎  {name}",
            font=ctk.CTkFont(size=13, weight="bold"),
            text_color=TEXT_PRIMARY,
            anchor="w",
        ).pack(fill="x", padx=14, pady=(10, 4))

        meta = f"{w}×{h}  ·  {dur}s  ·  {mb} MB"
        ctk.CTkLabel(
            card,
            text=meta,
            font=ctk.CTkFont(size=12),
            text_color=TEXT_SECONDARY,
            anchor="w",
        ).pack(fill="x", padx=14, pady=(0, 10))
        self._scroll_bottom()

    def _add_tool_pill(self, text: str):
        """Small pill badge for a tool call step."""
        row = self._chat_row()
        pill = ctk.CTkFrame(row, fg_color=PILL_BG, corner_radius=20)
        pill.pack(side="left", padx=(24, 0))
        ctk.CTkLabel(
            pill,
            text=text,
            font=ctk.CTkFont(size=11),
            text_color=TEXT_SECONDARY,
            padx=10, pady=4,
        ).pack()
        self._scroll_bottom()

    def _add_output_card(self, filename: str, filepath: str):
        """Clickable output file card with Open in Finder button."""
        row = self._chat_row()
        card = ctk.CTkFrame(row, fg_color=BG_SURFACE, corner_radius=12, border_width=1, border_color=SUCCESS)
        card.pack(side="left", padx=(0, 60))

        ctk.CTkLabel(
            card,
            text=f"✅  {filename}",
            font=ctk.CTkFont(size=13, weight="bold"),
            text_color=SUCCESS,
            anchor="w",
        ).pack(fill="x", padx=14, pady=(10, 6))

        open_btn = ctk.CTkButton(
            card,
            text="📂  Open in Finder",
            width=160,
            height=30,
            fg_color=BG_CARD,
            hover_color=BG_DEEP,
            text_color=TEXT_SECONDARY,
            font=ctk.CTkFont(size=12),
            corner_radius=8,
            command=lambda p=filepath: subprocess.run(["open", "-R", p]),
        )
        open_btn.pack(anchor="w", padx=14, pady=(0, 10))
        self._scroll_bottom()

    # ── Typing indicator ──────────────────────────────────────────────────────

    _DOT_FRAMES = ["●  ○  ○", "○  ●  ○", "○  ○  ●"]

    def _start_typing_indicator(self):
        row = self._chat_row()
        self._typing_frame = ctk.CTkFrame(row, fg_color=BG_CARD, corner_radius=14)
        self._typing_frame.pack(side="left")
        self._typing_label = ctk.CTkLabel(
            self._typing_frame,
            text=self._DOT_FRAMES[0],
            font=ctk.CTkFont(size=13),
            text_color=TEXT_SECONDARY,
            padx=16, pady=10,
        )
        self._typing_label.pack()
        self._dot_step = 0
        self._animate_dots()
        self._scroll_bottom()

    def _animate_dots(self):
        if self._typing_frame is None:
            return
        self._dot_step = (self._dot_step + 1) % 3
        try:
            self._typing_label.configure(text=self._DOT_FRAMES[self._dot_step])
        except Exception:
            return
        self._typing_job = self.after(400, self._animate_dots)

    def _stop_typing_indicator(self):
        if self._typing_job:
            self.after_cancel(self._typing_job)
            self._typing_job = None
        if self._typing_frame:
            try:
                self._typing_frame.destroy()
            except Exception:
                pass
            self._typing_frame = None

    # ── Status dot ────────────────────────────────────────────────────────────

    def _set_status(self, text: str, color: str):
        self._status_dot.configure(text=text, text_color=color)

    # ── Scroll helpers ────────────────────────────────────────────────────────

    def _scroll_bottom(self):
        self.after(50, lambda: self._chat_scroll._parent_canvas.yview_moveto(1.0))

    # ── Actions ───────────────────────────────────────────────────────────────

    def _insert_template(self, template: str):
        """Put a quick-action template into the input box."""
        current = self._input.get()
        if not current.strip():
            self._input.delete(0, "end")
            # Replace [file] with the currently loaded file if we have one
            if self.current_file:
                fname = os.path.basename(self.current_file)
                template = template.replace("[file]", f'"{fname}"')
            self._input.insert(0, template)
        self._input.focus_set()

    def _pick_file(self):
        path = filedialog.askopenfilename(
            title="Select a video file",
            filetypes=[
                ("Video files", "*.mp4 *.mov *.avi *.mkv *.webm *.m4v *.flv"),
                ("All files", "*.*"),
            ]
        )
        if not path:
            return
        self.current_file = path
        # Show file info card
        info = get_video_info(path)
        if "error" not in info:
            self._add_file_info_card(info)
            # Pre-fill input with the filename
            self._input.delete(0, "end")
            self._input.insert(0, f'"{os.path.basename(path)}" — ')
            self._input.focus_set()
            self._input.icursor("end")
        else:
            self._add_agent_bubble(f"Could not read that file: {info['error']}")

    def _send(self):
        text = self._input.get().strip()
        if not text:
            return
        self._input.delete(0, "end")
        self._add_user_bubble(text)

        # Resolve bare filenames to full paths if possible
        user_message = text
        if self.current_file:
            fname = os.path.basename(self.current_file)
            if fname in text:
                user_message = text.replace(fname, self.current_file)

        self.messages.append({"role": "user", "content": user_message})
        self._set_status("● Thinking...", ACCENT)
        self._start_typing_indicator()

        # Run agent in background thread
        threading.Thread(target=self._run_agent_thread, daemon=True).start()

    def _run_agent_thread(self):
        def on_tool(kind: str, msg: str, filepath):
            self.after(0, lambda: self._handle_tool_event(kind, msg, filepath))

        try:
            reply = run_agent(self.messages, on_tool=on_tool)
        except Exception as e:
            reply = f"Error: {e}"

        self.messages.append({"role": "assistant", "content": reply})
        self.after(0, lambda: self._finish_response(reply))

    def _handle_tool_event(self, kind: str, msg: str, filepath):
        if kind == "tool":
            self._stop_typing_indicator()
            self._add_tool_pill(msg)
            self._start_typing_indicator()
        elif kind == "output" and filepath and os.path.isfile(filepath):
            self._stop_typing_indicator()
            self._add_output_card(os.path.basename(filepath), filepath)
            self._start_typing_indicator()
        elif kind == "error":
            self._stop_typing_indicator()
            self._add_tool_pill(msg)
            self._start_typing_indicator()

    def _finish_response(self, reply: str):
        self._stop_typing_indicator()
        self._set_status("● Ready", SUCCESS)
        self._add_agent_bubble(reply)


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    app = VideoAgentApp()
    app.mainloop()
