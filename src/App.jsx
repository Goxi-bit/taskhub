import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";


export default function App() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <div style={{ maxWidth: 720, margin: "40px auto", padding: 16, fontFamily: "system-ui" }}>
      <h1 style={{ marginBottom: 4 }}>TaskHub</h1>
      <p style={{ marginTop: 0, opacity: 0.7 }}>React + Supabase (Auth + Postgres)</p>
      {!session ? <Auth /> : <Dashboard userId={session.user.id} />}
    </div>
  );
}

function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert("Account erstellt. Falls Email-Confirm aktiv ist: Mail bestätigen, dann einloggen.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setError(err.message ?? "Fehler");
    } finally {
      setLoading(false);
    }
  };

const loginWithGithub = async () => {
  setError("");
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: { redirectTo: window.location.origin },
  });
  if (error) setError(error.message ?? "GitHub Login fehlgeschlagen");
};


  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>{mode === "login" ? "Login" : "Sign up"}</h2>

      <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
        <label>
          Email
          <input style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </label>

        <label>
          Passwort
          <input style={inputStyle} value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
        </label>

        {error && <div style={{ color: "crimson" }}>{error}</div>}

        <button disabled={loading} style={btnStyle}>
          {loading ? "…" : mode === "login" ? "Einloggen" : "Account erstellen"}
        </button>

        <button type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")} style={linkBtnStyle}>
          {mode === "login" ? "Noch keinen Account? Sign up" : "Schon Account? Login"}
        </button>

        <button type="button" onClick={loginWithGithub} style={btnStyle}>
  Login mit GitHub
</button>

      </form>
    </div>
  );
}

function Dashboard({ userId }) {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    if (filter === "open") return tasks.filter((t) => !t.done);
    if (filter === "done") return tasks.filter((t) => t.done);
    return tasks;
  }, [tasks, filter]);

  const load = async () => {
    setError("");
    setLoading(true);
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) setError(error.message);
    setTasks(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // realtime optional
    const channel = supabase
      .channel("tasks-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `user_id=eq.${userId}` }, () => load())
      .subscribe();

    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const addTask = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    const { error } = await supabase.from("tasks").insert({ user_id: userId, title: title.trim(), done: false });
    if (error) setError(error.message);
    setTitle("");
    await load();
  };

  const toggleDone = async (t) => {
    const { error } = await supabase.from("tasks").update({ done: !t.done }).eq("id", t.id);
    if (error) setError(error.message);
    await load();
  };

  const remove = async (t) => {
    if (!confirm("Task wirklich löschen?")) return;
    const { error } = await supabase.from("tasks").delete().eq("id", t.id);
    if (error) setError(error.message);
    await load();
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ marginTop: 0 }}>Deine Tasks</h2>
        <button onClick={logout} style={btnStyle}>Logout</button>
      </div>

      <form onSubmit={addTask} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input style={{ ...inputStyle, flex: 1, minWidth: 220 }} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Neue Task…" />
        <button style={btnStyle}>Add</button>
      </form>

      <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>Alle</FilterButton>
        <FilterButton active={filter === "open"} onClick={() => setFilter("open")}>Offen</FilterButton>
        <FilterButton active={filter === "done"} onClick={() => setFilter("done")}>Erledigt</FilterButton>
      </div>

      {error && <div style={{ marginTop: 12, color: "crimson" }}>{error}</div>}
      {loading ? (
        <p style={{ marginTop: 12 }}>Lade…</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, marginTop: 12, display: "grid", gap: 8 }}>
          {filtered.map((t) => (
            <li key={t.id} style={{ border: "1px solid #eee", borderRadius: 10, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <label style={{ display: "flex", gap: 10, alignItems: "center", flex: 1 }}>
                  <input type="checkbox" checked={t.done} onChange={() => toggleDone(t)} />
                  <span style={{ textDecoration: t.done ? "line-through" : "none" }}>{t.title}</span>
                </label>
                <button onClick={() => remove(t)} style={smallBtnStyle}>Delete</button>
              </div>
            </li>
          ))}
          {filtered.length === 0 && <li style={{ opacity: 0.7 }}>Keine Tasks.</li>}
        </ul>
      )}
    </div>
  );
}

function FilterButton({ active, children, ...props }) {
  return (
    <button
      {...props}
      style={{
        padding: "8px 10px",
        borderRadius: 999,
        border: "1px solid #ddd",
        background: active ? "#111" : "transparent",
        color: active ? "#fff" : "#111",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd", outline: "none" };
const btnStyle = { padding: "10px 12px", borderRadius: 10, border: "1px solid #111", background: "#111", color: "#fff", cursor: "pointer" };
const linkBtnStyle = { padding: 0, border: "none", background: "transparent", color: "#111", textDecoration: "underline", cursor: "pointer", justifySelf: "start" };
const smallBtnStyle = { padding: "6px 10px", borderRadius: 10, border: "1px solid #ddd", background: "transparent", cursor: "pointer" };
