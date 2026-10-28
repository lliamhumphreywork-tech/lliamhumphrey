export default function EventsLoading() {
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div style={{ height: 24, width: 80, background: "var(--bg-elevated)", borderRadius: 6 }} />
        <div style={{ height: 36, width: 120, background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)" }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius)", overflow: "hidden" }}>
            <div style={{ height: 160, background: "var(--bg-elevated)" }} />
            <div style={{ padding: 16 }}>
              <div style={{ height: 16, width: "70%", background: "var(--bg-elevated)", borderRadius: 4, marginBottom: 10 }} />
              <div style={{ height: 12, width: "50%", background: "var(--bg-elevated)", borderRadius: 4, marginBottom: 8 }} />
              <div style={{ height: 12, width: "40%", background: "var(--bg-elevated)", borderRadius: 4 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
