export default function TopNav({ section, setSection }) {
  const tabs = [
    { id: 'generate', label: 'Generate' },
    { id: 'library', label: 'Library' },
    { id: 'briefs', label: 'Briefs' },
  ];

  return (
    <nav className="flex-shrink-0 h-12 bg-surface border-b border-line flex items-center px-5 gap-6">
      {/* Brand */}
      <div className="flex items-center gap-2 mr-4">
        <WMark className="h-4 w-auto text-accent" />
        <span className="text-xs font-semibold tracking-widest uppercase text-cream-dim">
          Content Workspace
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSection(tab.id)}
            className={[
              'px-4 py-1.5 text-xs font-medium tracking-wider uppercase rounded transition-colors',
              section === tab.id
                ? 'bg-accent text-cream'
                : 'text-cream-muted hover:text-cream hover:bg-surface-2',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

function WMark({ className }) {
  return (
    <svg className={className} viewBox="0 0 40 28" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M0 0L6.5 28L13 8L19.5 28L26 8L32.5 28L40 0H33L26.5 20L20 0L13.5 20L7 0H0Z" />
    </svg>
  );
}
