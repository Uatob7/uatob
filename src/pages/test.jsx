import { useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { firebase_app } from "@/firebase/config";
import { Send, CheckCircle2, XCircle, Bell, Loader2 } from "lucide-react";

const functions = getFunctions(firebase_app, "us-east1");
const sendPush  = httpsCallable(functions, "sendPushNotification");

// ── Dar's current FCM token (update when it rotates) ──────────────────
const DAR_TOKEN = "dGShtWnybde9vbU5l4aNNy:APA91bGunM-1NjRa4mnHoAqWGD4dTVdmJE4V2zJF_RDg6WRucFDldbwmSbVSe_57JvY5XuMtZHh4qaqsdlqOu7x652aK8189jJl5n81N7KvlNLaUVrS0bGw";

const QUICK_DRIVERS = [
  { token: DAR_TOKEN, name: "Dar Corvoisier" },
];

const QUICK_MESSAGES = [
  { title: "New Ride Request",  body: "Pickup at 123 Main St, Orlando" },
  { title: "Bonus Alert 🎉",    body: "Complete 3 more rides to earn a $10 bonus!" },
  { title: "System Notice",     body: "App update available. Please refresh." },
  { title: "Test Notification", body: "Push is working correctly ✓" },
];

export default function PushTestPage() {
  const [token,  setToken]  = useState(QUICK_DRIVERS[0].token);
  const [title,  setTitle]  = useState("Test Notification");
  const [body,   setBody]   = useState("Push is working correctly ✓");
  const [status, setStatus] = useState(null);
  const [errMsg, setErrMsg] = useState("");
  const [log,    setLog]    = useState([]);

  const handleSend = async () => {
    if (!token || !title || status === "loading") return;
    setStatus("loading");
    setErrMsg("");
    try {
      await sendPush({ token, title, body });
      setStatus("success");
      setLog(prev => [{
        time: new Date().toLocaleTimeString(),
        token,
        driverName: QUICK_DRIVERS.find(d => d.token === token)?.name ?? "Custom token",
        title,
        body,
        ok: true,
      }, ...prev].slice(0, 20));
      setTimeout(() => setStatus(null), 3000);
    } catch (err) {
      setStatus("error");
      setErrMsg(err.message || "Unknown error");
      setLog(prev => [{
        time: new Date().toLocaleTimeString(),
        token,
        driverName: QUICK_DRIVERS.find(d => d.token === token)?.name ?? "Custom token",
        title,
        body,
        ok: false,
        err: err.message,
      }, ...prev].slice(0, 20));
      setTimeout(() => setStatus(null), 4000);
    }
  };

  const selectedDriver = QUICK_DRIVERS.find(d => d.token === token);

  return (
    <div style={s.page}>
      <style>{css}</style>

      {/* Header */}
      <div style={s.header}>
        <div style={s.headerInner}>
          <div style={s.iconWrap}><Bell size={20} color="#22C55E" /></div>
          <div>
            <div style={s.headerTitle}>Push Notification Tester</div>
            <div style={s.headerSub}>UaTob Driver Console</div>
          </div>
        </div>
      </div>

      <div style={s.body}>

        {/* Driver / token select */}
        <div style={s.card}>
          <div style={s.label}>Select Driver</div>
          <div style={s.quickRow}>
            {QUICK_DRIVERS.map(d => (
              <button
                key={d.token}
                onClick={() => setToken(d.token)}
                style={{ ...s.chip, ...(token === d.token ? s.chipActive : {}) }}
              >
                {d.name}
              </button>
            ))}
          </div>
          <div style={s.inputLabel}>FCM Token</div>
          <textarea
            style={{ ...s.input, ...s.tokenArea }}
            value={token}
            onChange={e => setToken(e.target.value.trim())}
            spellCheck={false}
            placeholder="Paste FCM token…"
          />
          {selectedDriver && (
            <div style={{ marginTop: 6, fontSize: 12, fontWeight: 600, color: "#16A34A" }}>
              ✓ {selectedDriver.name}
            </div>
          )}
        </div>

        {/* Quick messages */}
        <div style={s.card}>
          <div style={s.label}>Quick Messages</div>
          <div style={s.quickRow}>
            {QUICK_MESSAGES.map(m => (
              <button
                key={m.title}
                onClick={() => { setTitle(m.title); setBody(m.body); }}
                style={{ ...s.chip, ...(title === m.title ? s.chipActive : {}) }}
              >
                {m.title}
              </button>
            ))}
          </div>
        </div>

        {/* Compose */}
        <div style={s.card}>
          <div style={s.inputLabel}>Title</div>
          <input
            style={s.input}
            placeholder="Notification title"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <div style={{ ...s.inputLabel, marginTop: 14 }}>Body</div>
          <textarea
            style={{ ...s.input, ...s.textarea }}
            placeholder="Notification body (optional)"
            value={body}
            onChange={e => setBody(e.target.value)}
          />
        </div>

        {/* Send */}
        <button
          onClick={handleSend}
          disabled={!token || !title || status === "loading"}
          style={{
            ...s.sendBtn,
            ...(status === "success" ? s.sendBtnSuccess : {}),
            ...(status === "error"   ? s.sendBtnError   : {}),
            opacity: (!token || !title) ? 0.45 : 1,
          }}
          className="send-btn"
        >
          {status === "loading" && <Loader2 size={18} className="spin" />}
          {status === "success" && <CheckCircle2 size={18} />}
          {status === "error"   && <XCircle size={18} />}
          {!status              && <Send size={18} />}
          <span>
            {status === "loading" ? "Sending…"
             : status === "success" ? "Sent!"
             : status === "error"   ? "Failed"
             : "Send Push"}
          </span>
        </button>

        {status === "error" && errMsg && (
          <div style={s.errBanner}><strong>Error:</strong> {errMsg}</div>
        )}

        {/* Log */}
        {log.length > 0 && (
          <div style={s.card}>
            <div style={s.label}>Log</div>
            <div style={s.logList}>
              {log.map((entry, i) => (
                <div key={i} style={{
                  ...s.logRow,
                  borderColor: entry.ok ? "rgba(34,197,94,.2)" : "rgba(220,38,38,.2)",
                  background:  entry.ok ? "rgba(34,197,94,.03)" : "rgba(220,38,38,.03)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {entry.ok ? <CheckCircle2 size={13} color="#22C55E" /> : <XCircle size={13} color="#EF4444" />}
                    <span style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>{entry.title}</span>
                    <span style={{ marginLeft: "auto", fontSize: 11, color: "#9CA3AF", flexShrink: 0 }}>{entry.time}</span>
                  </div>
                  {entry.body && <div style={{ fontSize: 12, color: "#6B7280", marginTop: 3 }}>{entry.body}</div>}
                  {entry.err  && <div style={{ fontSize: 12, color: "#EF4444", marginTop: 3, fontWeight: 600 }}>{entry.err}</div>}
                  <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4, fontFamily: "monospace" }}>
                    → {entry.driverName} · {entry.token.slice(0, 20)}…
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────
const s = {
  page:        { minHeight: "100vh", background: "#F9FAFB", fontFamily: '"Barlow", system-ui, sans-serif' },
  header:      { background: "#fff", borderBottom: "1.5px solid #E5E7EB", padding: "18px 20px", position: "sticky", top: 0, zIndex: 10 },
  headerInner: { maxWidth: 560, margin: "0 auto", display: "flex", alignItems: "center", gap: 12 },
  iconWrap:    { width: 40, height: 40, borderRadius: 12, background: "rgba(34,197,94,.1)", border: "1.5px solid rgba(34,197,94,.25)", display: "flex", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: 800, color: "#111827", fontFamily: '"Barlow Condensed", sans-serif', letterSpacing: "-0.2px" },
  headerSub:   { fontSize: 12, color: "#6B7280", fontWeight: 500 },
  body:        { maxWidth: 560, margin: "0 auto", padding: "24px 20px 60px", display: "flex", flexDirection: "column", gap: 16 },
  card:        { background: "#fff", borderRadius: 16, border: "1.5px solid #E5E7EB", padding: "18px 18px 16px" },
  label:       { fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 },
  inputLabel:  { fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 },
  quickRow:    { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip:        { padding: "6px 14px", borderRadius: 100, border: "1.5px solid #E5E7EB", background: "#F9FAFB", fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer", fontFamily: '"Barlow", sans-serif', transition: "all .15s" },
  chipActive:  { background: "rgba(34,197,94,.1)", borderColor: "rgba(34,197,94,.4)", color: "#15803D" },
  input:       { width: "100%", padding: "12px 14px", borderRadius: 12, border: "1.5px solid #E5E7EB", fontSize: 14, fontFamily: '"Barlow", sans-serif', fontWeight: 500, color: "#111827", background: "#F9FAFB", outline: "none", boxSizing: "border-box", transition: "border-color .15s" },
  tokenArea:   { resize: "none", minHeight: 56, fontSize: 11, fontFamily: "monospace", wordBreak: "break-all" },
  textarea:    { resize: "vertical", minHeight: 80 },
  sendBtn:     { width: "100%", padding: "16px", borderRadius: 14, border: "none", background: "linear-gradient(135deg,#22C55E,#16A34A 55%,#15803D)", color: "#fff", fontSize: 16, fontWeight: 800, fontFamily: '"Barlow", sans-serif', cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: "0 4px 18px rgba(22,163,74,.35)", transition: "all .2s" },
  sendBtnSuccess: { background: "linear-gradient(135deg,#16A34A,#15803D)", boxShadow: "0 4px 18px rgba(22,163,74,.5)" },
  sendBtnError:   { background: "linear-gradient(135deg,#DC2626,#991B1B)", boxShadow: "0 4px 18px rgba(220,38,38,.4)" },
  errBanner:   { background: "rgba(220,38,38,.07)", border: "1.5px solid rgba(220,38,38,.2)", borderRadius: 12, padding: "12px 16px", fontSize: 13, color: "#DC2626", fontWeight: 600 },
  logList:     { display: "flex", flexDirection: "column", gap: 10 },
  logRow:      { padding: "10px 12px", borderRadius: 10, border: "1.5px solid" },
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@500;600;700;800&family=Barlow+Condensed:wght@700;800;900&display=swap');
  * { box-sizing: border-box; }
  input:focus, textarea:focus { border-color: #22C55E !important; background: #fff !important; box-shadow: 0 0 0 3px rgba(34,197,94,.12); }
  .send-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 22px rgba(22,163,74,.45) !important; }
  .send-btn:active:not(:disabled) { transform: translateY(0); }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  .spin { animation: spin .8s linear infinite; }
`;