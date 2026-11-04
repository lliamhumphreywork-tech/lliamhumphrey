import { useState, useRef, useCallback, useEffect } from 'react';
import SlideViewer from '../components/SlideViewer.jsx';
import SlideRenderer from '../components/SlideRenderer.jsx';
import { generateCarousel } from '../utils/claudeApi.js';
import { exportAllSlides, exportLinkedinCrop } from '../utils/exportSlides.js';
import { PILLAR_LABELS, CTA_KEYWORDS } from '../constants/brand.js';

const DEFAULT_BRIEF = {
  topic: '',
  pillar: '',
  hook: '',
  slideNotes: '',
  ctaKeyword: 'SYSTEM',
  visualDirection: '',
};

export default function GenerateSection({ library, setLibrary, briefs, setBriefs, initialCarousel, initialBrief }) {
  const [mode, setMode] = useState(initialBrief ? 'full' : 'quick');
  const [brief, setBrief] = useState(initialBrief ? { ...DEFAULT_BRIEF, ...initialBrief } : DEFAULT_BRIEF);
  const [generating, setGenerating] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [carousel, setCarousel] = useState(initialCarousel || null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [activeTab, setActiveTab] = useState('slides');
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const abortRef = useRef(null);
  const outputRef = useRef(null);
  const slideRefs = useRef([]);

  // If parent passes a carousel to view (from Library), load it
  useEffect(() => {
    if (initialCarousel) {
      setCarousel(initialCarousel);
      setActiveSlide(0);
      setActiveTab('slides');
    }
  }, [initialCarousel]);

  const updateBrief = (key, val) => setBrief((b) => ({ ...b, [key]: val }));

  const handleGenerate = useCallback(async () => {
    if (!brief.topic.trim()) return;
    if (generating) {
      abortRef.current?.abort();
      return;
    }

    setGenerating(true);
    setError(null);
    setStreamText('');
    setCarousel(null);
    setActiveSlide(0);
    setActiveTab('copy');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await generateCarousel({
        mode,
        brief,
        onStream: (text) => setStreamText(text),
        signal: controller.signal,
      });

      result.id = Date.now().toString();
      result.savedAt = Date.now();
      result.pillar = brief.pillar || '';

      setCarousel(result);
      setActiveTab('slides');
      setStreamText('');

      // Auto-save to library
      setLibrary((prev) => [result, ...prev].slice(0, 50));
    } catch (err) {
      if (err.message !== 'Cancelled') {
        setError(err.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setGenerating(false);
      abortRef.current = null;
    }
  }, [mode, brief, generating, setLibrary]);

  // Keyboard shortcut: Cmd+Enter to generate, Cmd+S to save, Cmd+E to export
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleGenerate();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 's' && carousel) {
        e.preventDefault();
        handleSave();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'e' && carousel) {
        e.preventDefault();
        handleExportSlides();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleGenerate, carousel]);

  function handleSave() {
    if (!carousel) return;
    const exists = library.some((c) => c.id === carousel.id);
    if (!exists) {
      setLibrary((prev) => [carousel, ...prev].slice(0, 50));
    }
    showToast('Saved to library');
  }

  function handleSaveBrief() {
    const saved = { ...brief, id: Date.now().toString(), savedAt: Date.now() };
    setBriefs((prev) => [saved, ...prev].slice(0, 20));
    showToast('Brief saved');
  }

  async function handleExportSlides() {
    if (!carousel) return;
    const els = slideRefs.current.filter(Boolean);
    if (!els.length) { alert('No slides to export — make sure slides are visible.'); return; }
    await exportAllSlides(els, carousel.title || 'carousel');
  }

  async function handleExportLinkedIn() {
    const li = carousel?.linkedinOnePager;
    const slideNum = li?.slideNumber ? parseInt(li.slideNumber) - 1 : 3;
    const el = slideRefs.current[slideNum];
    if (!el) { alert('LinkedIn slide not found.'); return; }
    await exportLinkedinCrop(el);
  }

  function handleCopyCaption() {
    if (!carousel?.caption) return;
    navigator.clipboard.writeText(carousel.caption);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const [toast, setToast] = useState('');
  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  }

  // Container width for slide scaling
  const [panelWidth, setPanelWidth] = useState(460);
  const panelRef = useRef(null);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setPanelWidth(e.contentRect.width - 64));
    if (panelRef.current) ro.observe(panelRef.current);
    return () => ro.disconnect();
  }, []);

  const slideW = Math.min(panelWidth, 460);

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* ─── LEFT PANEL ─── */}
      <div className="w-[360px] flex-shrink-0 flex flex-col border-r border-line bg-surface overflow-y-auto">
        <div className="p-5 flex flex-col gap-5">
          {/* Mode toggle */}
          <div className="flex gap-1 bg-surface-2 rounded-lg p-1">
            {['quick', 'full'].map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={[
                  'flex-1 py-2 text-xs font-semibold tracking-wider uppercase rounded-md transition-colors',
                  mode === m
                    ? 'bg-accent text-cream'
                    : 'text-cream-muted hover:text-cream',
                ].join(' ')}
              >
                {m === 'quick' ? 'Quick Mode' : 'Full Brief'}
              </button>
            ))}
          </div>

          {/* Quick mode */}
          {mode === 'quick' && (
            <div className="flex flex-col gap-3">
              <label className="text-xs font-medium tracking-wider uppercase text-cream-muted">
                Topic or one-line brief
              </label>
              <textarea
                value={brief.topic}
                onChange={(e) => updateBrief('topic', e.target.value)}
                placeholder="e.g. Why your Meta ads aren't converting"
                rows={4}
                className="w-full bg-surface-2 border border-line rounded-lg px-3 py-2.5 text-sm text-cream placeholder-cream-muted resize-none focus:outline-none focus:border-accent/60 transition-colors"
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    e.preventDefault();
                    handleGenerate();
                  }
                }}
              />
            </div>
          )}

          {/* Full brief mode */}
          {mode === 'full' && (
            <div className="flex flex-col gap-4">
              <Field label="Topic *">
                <input
                  value={brief.topic}
                  onChange={(e) => updateBrief('topic', e.target.value)}
                  placeholder="e.g. Speed-to-lead for SA SMEs"
                  className="input"
                />
              </Field>

              <Field label="Pillar">
                <select
                  value={brief.pillar}
                  onChange={(e) => updateBrief('pillar', e.target.value)}
                  className="input"
                >
                  <option value="">— Choose a pillar —</option>
                  {PILLAR_LABELS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </Field>

              <Field label="Hook — Slide 01 headline">
                <input
                  value={brief.hook}
                  onChange={(e) => updateBrief('hook', e.target.value)}
                  placeholder="Your [reply time] is losing you leads"
                  className="input"
                />
              </Field>

              <Field label="Slide notes (optional)">
                <textarea
                  value={brief.slideNotes}
                  onChange={(e) => updateBrief('slideNotes', e.target.value)}
                  placeholder="Any specific direction per slide…"
                  rows={3}
                  className="input resize-none"
                />
              </Field>

              <Field label="CTA keyword">
                <select
                  value={brief.ctaKeyword}
                  onChange={(e) => updateBrief('ctaKeyword', e.target.value)}
                  className="input"
                >
                  {CTA_KEYWORDS.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </Field>

              <Field label="Visual direction (optional)">
                <textarea
                  value={brief.visualDirection}
                  onChange={(e) => updateBrief('visualDirection', e.target.value)}
                  placeholder="Specific visual notes…"
                  rows={2}
                  className="input resize-none"
                />
              </Field>

              <button
                onClick={handleSaveBrief}
                disabled={!brief.topic.trim()}
                className="text-xs text-cream-muted hover:text-cream disabled:opacity-30 transition-colors text-left"
              >
                + Save as brief template
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-900/30 border border-red-700/40 rounded-lg p-3 text-xs text-red-300">
              {error}
              <button onClick={handleGenerate} className="ml-2 underline hover:no-underline">
                Retry
              </button>
            </div>
          )}

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={!brief.topic.trim()}
            className={[
              'w-full py-3 rounded-lg text-sm font-semibold tracking-widest uppercase transition-all',
              generating
                ? 'bg-accent/60 text-cream cursor-pointer'
                : 'bg-accent text-cream hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed',
            ].join(' ')}
          >
            {generating ? 'Stop generating' : 'Generate  ⌘↵'}
          </button>

          {/* Shortcuts hint */}
          <p className="text-xs text-cream-muted text-center -mt-1">
            ⌘E export · ⌘S save · ← → navigate slides
          </p>
        </div>
      </div>

      {/* ─── RIGHT PANEL ─── */}
      <div ref={panelRef} className="flex-1 flex flex-col overflow-hidden bg-bg">
        {/* Tabs */}
        <div className="flex-shrink-0 flex items-center gap-1 px-5 pt-4 pb-0 border-b border-line">
          {['slides', 'copy', 'caption'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={[
                'px-4 py-2 text-xs font-semibold tracking-wider uppercase border-b-2 transition-colors -mb-px',
                activeTab === tab
                  ? 'border-accent text-cream'
                  : 'border-transparent text-cream-muted hover:text-cream',
              ].join(' ')}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-auto" ref={outputRef}>
          {/* SLIDES TAB */}
          {activeTab === 'slides' && (
            <div className="p-6 flex flex-col items-center">
              {generating && !carousel && (
                <LoadingSkeleton />
              )}
              {carousel && (
                <SlideViewer
                  slides={carousel.slides}
                  activeSlide={activeSlide}
                  setActiveSlide={setActiveSlide}
                  containerWidth={slideW}
                />
              )}
              {!generating && !carousel && (
                <EmptyState />
              )}

              {/* Hidden full-res slides for export */}
              {carousel && (
                <div style={{ position: 'absolute', left: -9999, top: -9999, pointerEvents: 'none' }}>
                  {carousel.slides.map((slide, i) => (
                    <SlideRenderer
                      key={i}
                      ref={(el) => (slideRefs.current[i] = el)}
                      slide={slide}
                      exportMode
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* COPY TAB */}
          {activeTab === 'copy' && (
            <div className="p-6 max-w-2xl">
              {generating && (
                <div className="flex flex-col gap-2">
                  <div className="text-xs text-cream-muted tracking-wider uppercase animate-pulse-soft">
                    Cooking your carousel…
                  </div>
                  <pre className="text-xs text-cream-dim font-mono leading-relaxed whitespace-pre-wrap">
                    {streamText}
                    <span className="inline-block w-1.5 h-3.5 bg-accent animate-pulse ml-0.5 align-middle" />
                  </pre>
                </div>
              )}
              {!generating && carousel && (
                <div className="flex flex-col gap-6">
                  <div>
                    <h3 className="text-xs font-semibold tracking-widest uppercase text-accent mb-1">
                      {carousel.title}
                    </h3>
                    <p className="text-xs text-cream-muted">{carousel.meta}</p>
                  </div>

                  {carousel.slides.map((slide, i) => (
                    <div key={i} className="border-l-2 border-accent/30 pl-4">
                      <div className="text-xs font-semibold tracking-wider uppercase text-cream-muted mb-1">
                        {slide.number} · {slide.type}
                      </div>
                      <p className="text-sm font-medium text-cream mb-2 leading-snug">
                        {slide.headline}
                      </p>
                      <p className="text-xs text-cream-dim leading-relaxed mb-2">
                        <span className="text-cream-muted mr-1">Visual:</span>
                        {slide.visual}
                      </p>
                      {slide.dek && (
                        <p className="text-xs text-cream-muted italic">{slide.dek}</p>
                      )}
                    </div>
                  ))}

                  {carousel.linkedinOnePager && (
                    <div className="bg-surface rounded-lg p-4 border border-accent/20">
                      <div className="text-xs font-semibold tracking-wider uppercase text-accent mb-2">
                        LinkedIn One-Pager — Slide {carousel.linkedinOnePager.slideNumber}
                      </div>
                      <p className="text-xs text-cream-dim mb-1">
                        {carousel.linkedinOnePager.reason}
                      </p>
                      <p className="text-xs text-cream-muted">
                        Landscape: {carousel.linkedinOnePager.landscapeCrop}
                      </p>
                    </div>
                  )}
                </div>
              )}
              {!generating && !carousel && <EmptyState />}
            </div>
          )}

          {/* CAPTION TAB */}
          {activeTab === 'caption' && (
            <div className="p-6 max-w-xl">
              {carousel?.caption ? (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold tracking-widest uppercase text-cream-muted">
                      Instagram Caption
                    </span>
                    <button
                      onClick={handleCopyCaption}
                      className="text-xs px-3 py-1.5 bg-accent/20 text-accent rounded hover:bg-accent/30 transition-colors font-medium"
                    >
                      {copied ? 'Copied ✓' : 'Copy'}
                    </button>
                  </div>
                  <div className="bg-surface rounded-lg p-4 border border-line">
                    <pre className="text-sm text-cream leading-relaxed whitespace-pre-wrap font-sans">
                      {carousel.caption}
                    </pre>
                  </div>
                </div>
              ) : (
                <EmptyState />
              )}
            </div>
          )}
        </div>

        {/* ─── Action bar ─── */}
        {carousel && (
          <div className="flex-shrink-0 border-t border-line bg-surface px-5 py-3 flex items-center gap-3 flex-wrap">
            <ActionBtn onClick={handleExportSlides} icon="⬇">
              Export Slides
            </ActionBtn>
            <ActionBtn onClick={handleExportLinkedIn} icon="⬇">
              Export LinkedIn
            </ActionBtn>
            <ActionBtn onClick={handleSave} icon="♡">
              Save to Library
            </ActionBtn>
            <ActionBtn
              onClick={() => {
                setCarousel(null);
                setStreamText('');
                setError(null);
                setActiveTab('copy');
                handleGenerate();
              }}
              icon="↺"
              secondary
            >
              Regenerate
            </ActionBtn>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-surface-2 border border-line px-4 py-2 rounded-lg text-xs text-cream tracking-wide shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium tracking-wider uppercase text-cream-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

function ActionBtn({ children, onClick, icon, secondary }) {
  return (
    <button
      onClick={onClick}
      className={[
        'flex items-center gap-1.5 px-3 py-2 rounded text-xs font-semibold tracking-wider uppercase transition-colors',
        secondary
          ? 'bg-surface-2 text-cream-dim hover:text-cream hover:bg-surface-2/80'
          : 'bg-accent/20 text-accent hover:bg-accent/30',
      ].join(' ')}
    >
      <span>{icon}</span>
      {children}
    </button>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <div className="text-xs tracking-widest uppercase text-cream-muted animate-pulse-soft">
        Cooking your carousel…
      </div>
      <div
        className="rounded-lg bg-surface animate-pulse"
        style={{ width: 320, height: 400 }}
      />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <div className="text-5xl opacity-10 font-serif">W</div>
      <p className="text-xs text-cream-muted">Your carousel will appear here.</p>
      <p className="text-xs text-cream-muted">Enter a topic and hit Generate.</p>
    </div>
  );
}
