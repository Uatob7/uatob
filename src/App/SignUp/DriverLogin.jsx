import { useState } from "react";
import { Mail, Lock, Eye, EyeOff, AlertCircle, ArrowRight, CheckCircle } from "lucide-react";
import signIn from "@/firebase/auth/signin";
import resetPassword from "@/firebase/auth/passwordReset";

const C = {
  bg: "#FAFAF7", surface: "#FFFFFF", surfaceRaised: "#F9FAF7",
  border: "#E8E6DD", accent: "#16A34A",
  text: "#0F0F10", textMid: "#5A5A52", textDim: "#9A988E",
  red: "#DC2626", green: "#16A34A",
};

export default function DriverLogin({ email: initialEmail, onSuccess, onBackToSignup }) {
  const [email, setEmail] = useState(initialEmail || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Email address is required");
      return;
    }
    if (!password) {
      setError("Password is required");
      return;
    }

    try {
      setLoading(true);
      const { result, error: signInError } = await signIn(
        email.trim().toLowerCase(),
        password
      );

      if (signInError) {
        setError(
          signInError.code === "auth/user-not-found"
            ? "No account found with this email"
            : signInError.code === "auth/wrong-password"
            ? "Incorrect password"
            : signInError.message || "Login failed. Please try again."
        );
        return;
      }

      if (onSuccess) onSuccess(result.user);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setResetLoading(true);
    setError("");
    setResetMessage("");

    if (!resetEmail.trim()) {
      setError("Please enter your email address");
      setResetLoading(false);
      return;
    }

    const result = await resetPassword(resetEmail.trim().toLowerCase());
    
    if (result.success) {
      setResetMessage(result.message);
      setResetEmail("");
      setTimeout(() => {
        setShowForgotPassword(false);
        setResetMessage("");
      }, 3000);
    } else {
      setError(result.error.message);
    }
    
    setResetLoading(false);
  };

  return (
    <div style={{ padding: "20px 0" }}>
      <div
        style={{
          background: "linear-gradient(135deg, rgba(22,163,74,.05), rgba(22,163,74,.02))",
          border: "1.5px solid rgba(22,163,74,.2)",
          borderRadius: 16,
          padding: "20px 22px",
          marginBottom: 22,
          display: "flex",
          gap: 14,
          alignItems: "center",
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            background: "rgba(22,163,74,.15)",
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Lock size={18} color={C.accent} strokeWidth={2.2} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 3 }}>
            Account already exists
          </div>
          <div style={{ fontSize: 12, color: C.textMid, fontWeight: 500 }}>
            This email is already registered. Log in to continue your application.
          </div>
        </div>
      </div>

      <form onSubmit={handleLogin}>
        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: C.textMid,
              marginBottom: 7,
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              fontFamily: "'Barlow Condensed', sans-serif",
              display: "block",
            }}
          >
            Email Address
          </label>
          <div style={{ position: "relative" }}>
            <Mail
              size={15}
              color={C.textDim}
              style={{
                position: "absolute",
                left: 14,
                top: "50%",
                transform: "translateY(-50%)",
                pointerEvents: "none",
              }}
            />
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              style={{
                width: "100%",
                background: C.surface,
                border: `1.5px solid ${error ? C.red : C.border}`,
                borderRadius: 13,
                padding: "13px 14px 13px 42px",
                color: C.text,
                fontFamily: "'Barlow', sans-serif",
                fontSize: 14,
                fontWeight: 500,
                outline: "none",
                transition: "border-color .2s",
              }}
            />
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: C.textMid,
              marginBottom: 7,
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              fontFamily: "'Barlow Condensed', sans-serif",
              display: "block",
            }}
          >
            Password
          </label>
          <div style={{ position: "relative" }}>
            <Lock
              size={15}
              color={C.textDim}
              style={{
                position: "absolute",
                left: 14,
                top: "50%",
                transform: "translateY(-50%)",
                pointerEvents: "none",
              }}
            />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              style={{
                width: "100%",
                background: C.surface,
                border: `1.5px solid ${error ? C.red : C.border}`,
                borderRadius: 13,
                padding: "13px 44px 13px 42px",
                color: C.text,
                fontFamily: "'Barlow', sans-serif",
                fontSize: 14,
                fontWeight: 500,
                outline: "none",
                transition: "border-color .2s",
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              disabled={loading}
              style={{
                position: "absolute",
                right: 13,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: C.textDim,
                display: "flex",
                padding: 2,
              }}
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        {error && (
          <div
            style={{
              fontSize: 12,
              color: C.red,
              marginBottom: 16,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 12px",
              background: "rgba(220,38,38,.05)",
              borderRadius: 10,
              border: `1px solid rgba(220,38,38,.2)`,
            }}
          >
            <AlertCircle size={13} />
            {error}
          </div>
        )}

        <div style={{ textAlign: "right", marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => setShowForgotPassword(true)}
            disabled={loading}
            style={{
              background: "none",
              border: "none",
              color: C.accent,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              opacity: loading ? 0.6 : 1,
              textDecoration: "underline",
            }}
          >
            Forgot password?
          </button>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={onBackToSignup}
            disabled={loading}
            className="ghost-btn"
            style={{
              flex: 1,
              padding: "13px 16px",
              opacity: loading ? 0.5 : 1,
            }}
          >
            Back to Signup
          </button>
          <button
            type="submit"
            disabled={loading}
            className="green-btn"
            style={{
              flex: 1,
              padding: "13px 16px",
              opacity: loading ? 0.6 : 1,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Logging in…" : "Log In"}
            {!loading && <ArrowRight size={16} />}
          </button>
        </div>
      </form>

      {showForgotPassword && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
          onClick={() => setShowForgotPassword(false)}
        >
          <div
            style={{
              background: C.surface,
              borderRadius: 16,
              padding: "32px 24px",
              maxWidth: 400,
              width: "100%",
              boxShadow: "0 20px 60px rgba(0,0,0,.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {resetMessage ? (
              <>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "center",
                    marginBottom: 16,
                  }}
                >
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      background: "rgba(22,163,74,.1)",
                      borderRadius: 32,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <CheckCircle size={32} color={C.green} />
                  </div>
                </div>
                <h3
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: C.text,
                    marginBottom: 8,
                    textAlign: "center",
                  }}
                >
                  Check Your Email
                </h3>
                <p
                  style={{
                    fontSize: 13,
                    color: C.textMid,
                    textAlign: "center",
                    lineHeight: 1.6,
                  }}
                >
                  We've sent a password reset link to <strong>{resetEmail}</strong>. The link will expire in 1 hour.
                </p>
              </>
            ) : (
              <>
                <h3
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: C.text,
                    marginBottom: 8,
                  }}
                >
                  Reset Your Password
                </h3>
                <p
                  style={{
                    fontSize: 13,
                    color: C.textMid,
                    marginBottom: 20,
                    lineHeight: 1.6,
                  }}
                >
                  Enter your email address and we'll send you a link to reset your password.
                </p>

                {error && (
                  <div
                    style={{
                      fontSize: 12,
                      color: C.red,
                      marginBottom: 16,
                      fontWeight: 600,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "10px 12px",
                      background: "rgba(220,38,38,.05)",
                      borderRadius: 10,
                      border: `1px solid rgba(220,38,38,.2)`,
                    }}
                  >
                    <AlertCircle size={13} />
                    {error}
                  </div>
                )}

                <form onSubmit={handleForgotPassword}>
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ position: "relative" }}>
                      <Mail
                        size={15}
                        color={C.textDim}
                        style={{
                          position: "absolute",
                          left: 14,
                          top: "50%",
                          transform: "translateY(-50%)",
                          pointerEvents: "none",
                        }}
                      />
                      <input
                        type="email"
                        placeholder="your@email.com"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        disabled={resetLoading}
                        style={{
                          width: "100%",
                          background: C.surface,
                          border: `1.5px solid ${C.border}`,
                          borderRadius: 13,
                          padding: "13px 14px 13px 42px",
                          color: C.text,
                          fontFamily: "'Barlow', sans-serif",
                          fontSize: 14,
                          fontWeight: 500,
                          outline: "none",
                          transition: "border-color .2s",
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(false)}
                      disabled={resetLoading}
                      style={{
                        flex: 1,
                        padding: "12px 16px",
                        border: `1.5px solid ${C.border}`,
                        background: C.surface,
                        color: C.text,
                        borderRadius: 13,
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: "pointer",
                        opacity: resetLoading ? 0.6 : 1,
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={resetLoading}
                      style={{
                        flex: 1,
                        padding: "12px 16px",
                        border: "none",
                        background: C.accent,
                        color: "#fff",
                        borderRadius: 13,
                        fontSize: 14,
                        fontWeight: 700,
                        cursor: "pointer",
                        opacity: resetLoading ? 0.7 : 1,
                      }}
                    >
                      {resetLoading ? "Sending…" : "Send Reset Link"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
