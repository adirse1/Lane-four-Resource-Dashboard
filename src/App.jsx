// Lane Four Team Performance Dashboard - app shell.
// Phase 1 placeholder. The tab routing + shared context lands in Phase 6,
// once the lib/, components/, hooks/, and tabs/ layers are extracted.

export default function App() {
  return (
    <div
      style={{
        maxWidth: 980,
        margin: "0 auto",
        padding: "40px 16px",
        fontFamily: "'Open Sans', sans-serif",
        color: "#000000",
      }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@500;700&family=Open+Sans:wght@400;600&display=swap');`}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 4, height: 24, background: "#2CCCD3", borderRadius: 2 }} />
        <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Poppins', sans-serif" }}>
          Team performance
        </div>
      </div>
      <p style={{ color: "#888", marginTop: 16 }}>
        Scaffold running. Refactor in progress.
      </p>
    </div>
  );
}
