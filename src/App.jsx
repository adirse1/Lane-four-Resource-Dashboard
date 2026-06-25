// Auth gate. In fixtures/proxy modes (local dev) the dashboard renders straight
// away. In oauth mode (production) it handles the Salesforce redirect, then shows
// a sign-in screen until the viewer has a token — so the data hooks inside
// Dashboard only mount once we can actually query.
import { useState, useEffect } from "react";
import { MODE, SF_CLIENT_ID } from "./lib/env.js";
import { handleRedirect, isAuthed, login } from "./lib/sfAuth.js";
import { B, FONT_IMPORT } from "./constants/brand.js";
import Dashboard from "./Dashboard.jsx";

export default function App() {
  // Local dev: no auth gate.
  if (MODE !== "oauth") return <Dashboard />;
  return <OAuthGate />;
}

function Shell({ children }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Open Sans',sans-serif", background: B.offwhite }}>
      <style>{`${FONT_IMPORT} *{box-sizing:border-box;}`}</style>
      <div style={{ textAlign: "center", padding: 32 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <div style={{ width: 4, height: 26, background: B.teal, borderRadius: 2 }} />
          <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Poppins',sans-serif", color: B.black }}>Team performance</div>
        </div>
        {children}
      </div>
    </div>
  );
}

function OAuthGate() {
  const [state, setState] = useState("checking"); // checking | signedout | ready | error
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        if (await handleRedirect()) { setState("ready"); return; }
        setState(isAuthed() ? "ready" : "signedout");
      } catch (e) {
        setError(e.message);
        setState("error");
      }
    })();
  }, []);

  if (state === "ready") return <Dashboard />;

  if (state === "checking") {
    return <Shell><div style={{ fontSize: 13, color: "#888" }}>Connecting to Salesforce…</div></Shell>;
  }

  const notConfigured = !SF_CLIENT_ID;
  return (
    <Shell>
      {state === "error" && (
        <div style={{ fontSize: 12, color: B.redTx, background: B.redBg, borderRadius: 8, padding: "10px 14px", marginBottom: 16, maxWidth: 380 }}>
          Sign-in failed: {error}
        </div>
      )}
      {notConfigured ? (
        <div style={{ fontSize: 12, color: B.amberTx, background: B.amberBg, borderRadius: 8, padding: "12px 16px", maxWidth: 420, lineHeight: 1.6 }}>
          Salesforce client ID is not configured. Set <code>VITE_SF_CLIENT_ID</code> (and
          <code> VITE_SF_LOGIN_URL</code>) at build time. See DEPLOY.md.
        </div>
      ) : (
        <>
          <div style={{ fontSize: 13, color: "#888", marginBottom: 18 }}>Sign in with your Salesforce account to view live data.</div>
          <button onClick={login} style={{ fontSize: 13, fontWeight: 600, padding: "10px 22px", background: B.teal, color: B.white, border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "'Open Sans',sans-serif" }}>
            Sign in with Salesforce
          </button>
        </>
      )}
    </Shell>
  );
}
