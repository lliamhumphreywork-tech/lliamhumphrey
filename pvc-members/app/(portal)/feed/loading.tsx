const S: React.CSSProperties = { animation: "skeleton-pulse 1.4s ease-in-out infinite" }

export default function FeedLoading() {
  return (
    <div>
      <div style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-surface)" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px 24px 0" }}>
          <div style={{ height: 24, width: 60, background: "var(--bg-elevated)", borderRadius: 6, marginBottom: 12, ...S }} />
          <div style={{ height: 2, width: 60, background: "var(--bg-elevated)", borderRadius: 2 }} />
        </div>
      </div>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px 24px" }}>
        <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius)", padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--bg-elevated)", flexShrink: 0, ...S }} />
            <div style={{ flex: 1, height: 36, background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)", ...S }} />
          </div>
        </div>
        {[1,2,3].map(i => (
          <div key={i} style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius)", padding: 20, marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--bg-elevated)", flexShrink: 0, ...S }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 13, width: 120, background: "var(--bg-elevated)", borderRadius: 4, marginBottom: 6, ...S }} />
                <div style={{ height: 11, width: 80, background: "var(--bg-elevated)", borderRadius: 4, ...S }} />
              </div>
            </div>
            <div style={{ height: 13, background: "var(--bg-elevated)", borderRadius: 4, marginBottom: 8, ...S }} />
            <div style={{ height: 13, width: "80%", background: "var(--bg-elevated)", borderRadius: 4, marginBottom: 8, ...S }} />
            <div style={{ height: 13, width: "60%", background: "var(--bg-elevated)", borderRadius: 4, ...S }} />
          </div>
        ))}
      </div>
    </div>
  )
}
