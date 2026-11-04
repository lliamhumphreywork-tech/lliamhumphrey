import CarouselCard from '../components/CarouselCard.jsx';

export default function LibrarySection({ library, setLibrary, onViewCarousel }) {
  function handleDelete(id) {
    if (confirm('Delete this carousel?')) {
      setLibrary((prev) => prev.filter((c) => c.id !== id));
    }
  }

  function handleExport(carousel) {
    // Trigger export from library — delegate back to parent
    onViewCarousel(carousel, true);
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-cream tracking-wide">Library</h2>
            <p className="text-xs text-cream-muted mt-0.5">
              {library.length} saved carousel{library.length !== 1 ? 's' : ''}
            </p>
          </div>
          {library.length > 0 && (
            <button
              onClick={() => { if (confirm('Clear entire library?')) setLibrary([]); }}
              className="text-xs text-cream-muted hover:text-red-400 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>

        {library.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="text-4xl opacity-20">◫</div>
            <p className="text-sm text-cream-muted">No saved carousels yet.</p>
            <p className="text-xs text-cream-muted">Generate a carousel and click Save to Library.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            {library.map((carousel) => (
              <CarouselCard
                key={carousel.id}
                carousel={carousel}
                onView={(c) => onViewCarousel(c)}
                onExport={handleExport}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
