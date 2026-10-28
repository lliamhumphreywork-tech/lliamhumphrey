export default function MembersLoading() {
  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px" }}>
      <div style={{ height: 24, width: 100, background: "var(--bg-elevated)", borderRadius: 6, marginBottom: 20 }} />
      <div style={{ height: 44, background: "var(--bg-elevated)", borderRadius: "var(--radius-sm)", marginBottom: 24 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
        {[1,2,3,4,5,6].map(i => (
          <div key={i} style={{ background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius)", padding: 20, textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--bg-elevated)", margin: "0 auto 12px" }} />
            <div style={{ height: 14, width: "60%", background: "var(--bg-elevated)", borderRadius: 4, margin: "0 auto 8px" }} />
            <div style={{ height: 11, width: "80%", background: "var(--bg-elevated)", borderRadius: 4, margin: "0 auto" }} />
          </div>
        ))}
      </div>
    </div>
  )
}
