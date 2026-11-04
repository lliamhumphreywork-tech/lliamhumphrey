import SlideRenderer from './SlideRenderer.jsx';

const PILLAR_COLOURS = {
  'Education': 'bg-blue-900/40 text-blue-300',
  'Myth-busting': 'bg-purple-900/40 text-purple-300',
  'Social Proof': 'bg-green-900/40 text-green-300',
  'Founder Story': 'bg-yellow-900/40 text-yellow-300',
  'Problem & Solution': 'bg-red-900/40 text-red-300',
};

export default function CarouselCard({ carousel, onView, onExport, onDelete }) {
  const firstSlide = carousel.slides?.[0];
  const date = new Date(carousel.savedAt).toLocaleDateString('en-ZA', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
  const pillarClass = PILLAR_COLOURS[carousel.pillar] || 'bg-surface-2 text-cream-dim';

  return (
    <div className="bg-surface rounded-lg overflow-hidden border border-line hover:border-accent/40 transition-colors group">
      {/* Slide thumbnail */}
      <div className="relative overflow-hidden bg-[#F5F0E8]" style={{ paddingBottom: '125%' }}>
        <div className="absolute inset-0 flex items-center justify-center">
          {firstSlide ? (
            <div style={{ transform: 'scale(0.278)', transformOrigin: 'top left', width: 1080, height: 1350 }}>
              <SlideRenderer slide={firstSlide} containerWidth={1080} exportMode />
            </div>
          ) : (
            <div className="text-cream-muted text-xs">No preview</div>
          )}
        </div>

        {/* Overlay actions */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
          <button
            onClick={() => onView(carousel)}
            className="px-4 py-2 bg-accent text-cream text-xs font-semibold tracking-wider uppercase rounded hover:bg-accent-hover transition-colors"
          >
            View
          </button>
          <button
            onClick={() => onExport(carousel)}
            className="px-4 py-2 bg-surface text-cream text-xs font-semibold tracking-wider uppercase rounded hover:bg-surface-2 transition-colors"
          >
            Export
          </button>
        </div>
      </div>

      {/* Card body */}
      <div className="p-4 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-cream leading-tight line-clamp-2">
            {carousel.title}
          </h3>
          <button
            onClick={() => onDelete(carousel.id)}
            className="text-cream-muted hover:text-red-400 transition-colors text-lg leading-none flex-shrink-0 mt-0.5"
            title="Delete"
          >
            ×
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {carousel.pillar && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pillarClass}`}>
              {carousel.pillar}
            </span>
          )}
          <span className="text-xs text-cream-muted">{date}</span>
          <span className="text-xs text-cream-muted">{carousel.slides?.length || 0} slides</span>
        </div>
      </div>
    </div>
  );
}
