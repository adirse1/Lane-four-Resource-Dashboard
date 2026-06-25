export default function Tag({ color, bg, children }) {
  return (
    <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 8, background: bg, color, fontWeight: 600, fontFamily: "'Open Sans',sans-serif", whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}
