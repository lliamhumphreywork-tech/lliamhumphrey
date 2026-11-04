import { forwardRef } from 'react';
import { parseHeadline } from '../utils/parseCarousel.js';
import {
  SLIDE_BG, SLIDE_INK, SLIDE_BROWN, SLIDE_INK_45, SLIDE_LINE,
} from '../constants/brand.js';

// The slide renders at 1080×1350 internally, scaled via CSS transform to fit its container.
// Pass `exportMode={true}` when capturing at full res (no scaling wrapper).

const SlideRenderer = forwardRef(function SlideRenderer({ slide, containerWidth, exportMode }, ref) {
  const NATIVE_W = 1080;
  const NATIVE_H = 1350;
  const scale = exportMode ? 1 : (containerWidth || 400) / NATIVE_W;

  const headlineSegments = parseHeadline(slide.headline || '');
  const typeLabel = `${slide.number} · ${slide.type}`;

  const inner = (
    <div
      ref={exportMode ? ref : undefined}
      style={{
        width: NATIVE_W,
        height: NATIVE_H,
        background: SLIDE_BG,
        padding: '80px 84px 64px',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'DM Serif Display', Georgia, serif",
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 20,
          fontWeight: 500,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: SLIDE_INK_45,
        }}>
          {slide.topBarLabel}
        </span>
        {slide.pill && (
          <span style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            background: SLIDE_BROWN,
            color: '#fff',
            padding: '11px 26px',
            borderRadius: 999,
            whiteSpace: 'nowrap',
          }}>
            {slide.pill}
          </span>
        )}
      </div>

      {/* Rule */}
      <div style={{ height: 1.5, background: SLIDE_INK, marginTop: 32, opacity: 0.85, flexShrink: 0 }} />

      {/* Headline */}
      <div style={{ marginTop: 52, flexShrink: 0 }}>
        <h1 style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: 96,
          fontWeight: 400,
          lineHeight: 0.98,
          letterSpacing: '-0.006em',
          color: SLIDE_INK,
          margin: 0,
        }}>
          {headlineSegments.map((seg, i) =>
            seg.accent
              ? <span key={i} style={{ color: SLIDE_BROWN }}>{seg.text}</span>
              : <span key={i}>{seg.text}</span>
          )}
        </h1>
        {slide.dek && (
          <p style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: 26,
            lineHeight: 1.4,
            color: 'rgba(26,26,26,0.65)',
            margin: '28px 0 0',
            maxWidth: 760,
          }}>
            {slide.dek}
          </p>
        )}
      </div>

      {/* Visual zone */}
      <div style={{ flex: 1, marginTop: 40, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <VisualZone description={slide.visual} slideType={slide.type} />
      </div>

      {/* Footer */}
      <div style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        position: 'relative',
        marginTop: 20,
        paddingTop: 16,
        borderTop: `1px solid ${SLIDE_LINE}`,
      }}>
        <span style={{
          position: 'absolute',
          left: 0,
          bottom: 2,
          fontFamily: "'Inter', sans-serif",
          fontSize: 18,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: SLIDE_INK_45,
          fontWeight: 500,
        }}>
          Evvrywhere
        </span>
        {/* W mark */}
        <svg viewBox="0 0 40 28" fill={SLIDE_INK} style={{ height: 28, width: 'auto' }}>
          <path d="M0 0L6.5 28L13 8L19.5 28L26 8L32.5 28L40 0H33L26.5 20L20 0L13.5 20L7 0H0Z" />
        </svg>
        <span style={{
          position: 'absolute',
          right: 0,
          bottom: 2,
          fontFamily: "'Inter', sans-serif",
          fontSize: 18,
          letterSpacing: '0.14em',
          color: SLIDE_INK_45,
          fontWeight: 500,
        }}>
          {slide.number} / 07
        </span>
      </div>
    </div>
  );

  if (exportMode) return inner;

  return (
    <div
      ref={ref}
      style={{ width: NATIVE_W * scale, height: NATIVE_H * scale, flexShrink: 0 }}
    >
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: NATIVE_W, height: NATIVE_H }}>
        {inner}
      </div>
    </div>
  );
});

export default SlideRenderer;

function VisualZone({ description, slideType }) {
  const isCTA = slideType === 'CTA' || slideType?.toLowerCase().includes('cta');

  if (isCTA) {
    // CTA slide — just show the CTA content extracted from the description
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        paddingBottom: 8,
      }}>
        <p style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 26,
          color: 'rgba(26,26,26,0.6)',
          lineHeight: 1.4,
          maxWidth: 680,
          margin: '0 0 36px',
        }}>
          We build the AI systems that close the gap.
        </p>
        <div style={{
          display: 'inline-flex',
          background: SLIDE_BROWN,
          color: '#fff',
          padding: '18px 36px',
          borderRadius: 999,
          fontFamily: "'Inter', sans-serif",
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          width: 'fit-content',
        }}>
          DM US "SYSTEM"
        </div>
      </div>
    );
  }

  return (
    <div style={{
      flex: 1,
      border: `1.5px dashed rgba(26,26,26,0.2)`,
      borderRadius: 16,
      padding: '28px 32px',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      background: 'rgba(255,255,255,0.35)',
      overflow: 'hidden',
    }}>
      {/* Visual type tag */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexShrink: 0,
      }}>
        <span style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: SLIDE_BROWN,
          background: 'rgba(107,76,42,0.1)',
          padding: '4px 10px',
          borderRadius: 6,
        }}>
          Visual Zone — {slideType}
        </span>
      </div>

      {/* Visual description */}
      <p style={{
        fontFamily: "'Inter', sans-serif",
        fontSize: 20,
        lineHeight: 1.5,
        color: 'rgba(26,26,26,0.65)',
        margin: 0,
        flex: 1,
        overflow: 'hidden',
      }}>
        {description}
      </p>
    </div>
  );
}
