import { useRef, useEffect } from 'react';
import SlideRenderer from './SlideRenderer.jsx';

export default function SlideViewer({ slides, activeSlide, setActiveSlide, containerWidth }) {
  const total = slides.length;

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'ArrowRight') setActiveSlide((i) => Math.min(i + 1, total - 1));
      if (e.key === 'ArrowLeft') setActiveSlide((i) => Math.max(i - 1, 0));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [total, setActiveSlide]);

  const slide = slides[activeSlide];
  if (!slide) return null;

  const typeLabels = {
    Hook: '01 · Hook',
    'Stat': '02 · Stat · save-worthy',
    'Reality': '03 · Reality · share-worthy',
    'Math': '04 · The Math · linkedin one-pager',
    'Fix': '05 · The Fix',
    'Proof': '06 · Proof · inquiry driver',
    'CTA': '07 · CTA · comment driver',
  };
  const label = typeLabels[slide.type] || `${slide.number} · ${slide.type}`;

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Type label */}
      <div className="text-xs font-medium tracking-widest uppercase text-cream-muted">
        {label}
      </div>

      {/* Slide */}
      <div className="relative">
        <SlideRenderer
          slide={slide}
          containerWidth={containerWidth}
        />
      </div>

      {/* Nav row */}
      <div className="flex items-center gap-4 mt-1">
        <button
          onClick={() => setActiveSlide((i) => Math.max(i - 1, 0))}
          disabled={activeSlide === 0}
          className="w-8 h-8 rounded-full bg-surface-2 text-cream-dim flex items-center justify-center disabled:opacity-30 hover:bg-surface-2/80 transition-colors text-lg"
        >
          ‹
        </button>

        {/* Dots */}
        <div className="flex gap-2 items-center">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveSlide(i)}
              className={[
                'rounded-full transition-all',
                i === activeSlide
                  ? 'w-2.5 h-2.5 bg-accent'
                  : 'w-1.5 h-1.5 bg-cream-muted hover:bg-cream-dim',
              ].join(' ')}
            />
          ))}
        </div>

        <button
          onClick={() => setActiveSlide((i) => Math.min(i + 1, total - 1))}
          disabled={activeSlide === total - 1}
          className="w-8 h-8 rounded-full bg-surface-2 text-cream-dim flex items-center justify-center disabled:opacity-30 hover:bg-surface-2/80 transition-colors text-lg"
        >
          ›
        </button>
      </div>

      {/* Counter */}
      <div className="text-xs text-cream-muted tracking-wider">
        {activeSlide + 1} / {total}
      </div>
    </div>
  );
}
