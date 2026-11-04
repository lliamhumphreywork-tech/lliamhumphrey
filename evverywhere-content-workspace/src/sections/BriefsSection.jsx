export default function BriefsSection({ briefs, setBriefs, onLoadBrief }) {
  function handleDelete(id) {
    setBriefs((prev) => prev.filter((b) => b.id !== id));
  }

  const pillarColours = {
    'Education': 'text-blue-300',
    'Myth-busting': 'text-purple-300',
    'Social Proof': 'text-green-300',
    'Founder Story': 'text-yellow-300',
    'Problem & Solution': 'text-red-300',
  };

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-cream tracking-wide">Briefs</h2>
          <p className="text-xs text-cream-muted mt-0.5">
            Saved brief templates — {briefs.length} saved
          </p>
        </div>

        {briefs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="text-4xl opacity-20">✎</div>
            <p className="text-sm text-cream-muted">No saved briefs yet.</p>
            <p className="text-xs text-cream-muted">Use Full Brief mode and save a brief as a template.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {briefs.map((brief) => (
              <div
                key={brief.id}
                className="bg-surface rounded-lg p-4 border border-line hover:border-accent/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <h3 className="text-sm font-semibold text-cream truncate">
                        {brief.topic || 'Untitled brief'}
                      </h3>
                      {brief.pillar && (
                        <span className={`text-xs font-medium ${pillarColours[brief.pillar] || 'text-cream-muted'}`}>
                          {brief.pillar}
                        </span>
                      )}
                    </div>
                    {brief.hook && (
                      <p className="text-xs text-cream-muted line-clamp-1 mb-2">
                        Hook: "{brief.hook}"
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-cream-muted">
                      {brief.ctaKeyword && (
                        <span className="bg-accent/20 text-accent px-2 py-0.5 rounded font-medium">
                          {brief.ctaKeyword}
                        </span>
                      )}
                      <span>
                        {new Date(brief.savedAt).toLocaleDateString('en-ZA', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => onLoadBrief(brief)}
                      className="px-3 py-1.5 bg-accent text-cream text-xs font-semibold tracking-wider uppercase rounded hover:bg-accent-hover transition-colors"
                    >
                      Load
                    </button>
                    <button
                      onClick={() => handleDelete(brief.id)}
                      className="text-cream-muted hover:text-red-400 transition-colors text-lg leading-none"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
