import { useState } from "react";
import { login, register } from "../api/authApi";

export default function AuthDialog({ initialMode = "login", onClose, onLogin }) {
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      if (mode === "register") {
        await register({ name: name.trim(), email: email.trim(), password });
        setMode("login");
        setPassword("");
        setMessage("Account created. Sign in with your new account.");
      } else {
        const result = await login({ email: email.trim(), password });
        onLogin(result, email.trim());
      }
    } catch (requestError) {
      setError(requestError.message || "Unable to complete your request.");
    } finally {
      setBusy(false);
    }
  }

  function changeMode(nextMode) {
    setMode(nextMode);
    setError("");
    setMessage("");
  }

  return (
    <div className="auth-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onClose();
    }}>
      <section
        className="auth-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
      >
        <button
          className="auth-close"
          type="button"
          aria-label="Close"
          onClick={onClose}
          disabled={busy}
        >
          ×
        </button>

        <p className="eyebrow">WELCOME TO BOOKNEST</p>
        <h2 id="auth-title">
          {mode === "register" ? "Create your account" : "Welcome back"}
        </h2>
        <p className="auth-description">
          {mode === "register"
            ? "Join BookNest and keep your reading close."
            : "Sign in to your BookNest account."}
        </p>

        <form onSubmit={handleSubmit}>
          {mode === "register" && (
            <>
              <label htmlFor="auth-name">Name</label>
              <input
                autoComplete="name"
                id="auth-name"
                maxLength="100"
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
            </>
          )}

          <label htmlFor="auth-email">Email</label>
          <input
            autoComplete="email"
            id="auth-email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />

          <label htmlFor="auth-password">Password</label>
          <input
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            id="auth-password"
            minLength="8"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
          {mode === "register" && (
            <p className="auth-hint">Use at least 8 characters.</p>
          )}

          {error && (
            <p className="notice error-notice" role="alert">{error}</p>
          )}
          {message && (
            <p className="notice success-notice" role="status">{message}</p>
          )}

          <button className="primary-button" type="submit" disabled={busy}>
            {busy
              ? "Please wait..."
              : mode === "register"
                ? "Create account"
                : "Sign in"}
          </button>
        </form>

        <p className="auth-switch">
          {mode === "register" ? "Already have an account?" : "New to BookNest?"}{" "}
          <button
            type="button"
            onClick={() => changeMode(mode === "register" ? "login" : "register")}
            disabled={busy}
          >
            {mode === "register" ? "Sign in" : "Create an account"}
          </button>
        </p>
      </section>
    </div>
  );
}
