export default function MessagesLoading() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", height: "100%", minHeight: "calc(100vh - 120px)" }}>
      <div style={{ borderRight: "1px solid var(--border-subtle)", padding: "16px 0" }}>
        <div style={{ padding: "0 16px 12px" }}>
          <div style={{ height: 20, width: 80, background: "var(--bg-elevated)", borderRadius: 4 }} />
        </div>
        {[1,2,3,4].map(i => (
          <div key={i} style={{ display: "flex", gap: 10, padding: "10px 16px" }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--bg-elevated)", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ height: 13, width: "60%", background: "var(--bg-elevated)", borderRadius: 4, marginBottom: 6 }} />
              <div style={{ height: 11, width: "80%", background: "var(--bg-elevated)", borderRadius: 4 }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ height: 16, width: 160, background: "var(--bg-elevated)", borderRadius: 4 }} />
      </div>
    </div>
  )
}
