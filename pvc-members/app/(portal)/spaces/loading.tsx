export default function SpacesLoading() {
  return (
    <div>
      <div style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-surface)" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px 24px 0" }}>
          <div style={{ height: 24, width: 140, background: "var(--bg-elevated)", borderRadius: 6, marginBottom: 12 }} />
          <div style={{ height: 2, width: 80, background: "var(--bg-elevated)", borderRadius: 2 }} />
        </div>
      </div>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px 24px" }}>
        {[1,2,3].map(i => (
          <div key={i} style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius)", padding: 20, marginBottom: 12 }}>
            <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--bg-elevated)", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 13, width: 120, background: "var(--bg-elevated)", borderRadius: 4, marginBottom: 6 }} />
                <div style={{ height: 11, width: 80, background: "var(--bg-elevated)", borderRadius: 4 }} />
              </div>
            </div>
            <div style={{ height: 13, background: "var(--bg-elevated)", borderRadius: 4, marginBottom: 8 }} />
            <div style={{ height: 13, width: "75%", background: "var(--bg-elevated)", borderRadius: 4 }} />
          </div>
        ))}
      </div>
    </div>
  )
}
