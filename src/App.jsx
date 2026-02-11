// src/App.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";
import "./App.css";

export default function App() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <div className="app">
      <div className="header">
        <div>
          <h1 className="h1">TaskHub</h1>
          <p className="sub">React + Supabase (Auth + Postgres)</p>
        </div>
      </div>

      {!session ? <Auth /> : <Dashboard userId={session.user.id} />}
    </div>
  );
}

function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("login"); // login | signup
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
    if (error) setError(error.message);
  };

  return (
    <div className="card">
      <h2 className="cardTitle">{mode === "login" ? "Login" : "Sign up"}</h2>

      <form onSubmit={submit} className="formGrid">
        <label className="label">
          Email
          <input
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            autoComplete="email"
          />
        </label>

        <label className="label">
          Passwort
          <input
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </label>

        {error && <div className="error">{error}</div>}

        <div className="row">
          <button disabled={loading} className="btn">
            {loading ? "…" : mode === "login" ? "Einloggen" : "Account erstellen"}
          </button>

          <button type="button" onClick={loginWithGithub} className="btn btnSecondary">
            Login mit GitHub
          </button>
        </div>

        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="linkBtn"
        >
          {mode === "login" ? "Noch keinen Account? Sign up" : "Schon Account? Login"}
        </button>
      </form>
    </div>
  );
}

function Dashboard({ userId }) {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [filter, setFilter] = useState("all"); // all | open | done
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

    const channel = supabase
      .channel("tasks-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `user_id=eq.${userId}` },
        () => load()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const addTask = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    const { error } = await supabase.from("tasks").insert({
      user_id: userId,
      title: title.trim(),
      done: false,
    });

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
    <div className="card">
      <div className="header" style={{ marginBottom: 8 }}>
        <h2 className="cardTitle" style={{ margin: 0 }}>
          Deine Tasks
        </h2>
        <button onClick={logout} className="btn">
          Logout
        </button>
      </div>

      <form onSubmit={addTask} className="row">
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Neue Task…"
        />
        <button className="btn">Add</button>
      </form>

      <div className="filters">
        <button
          className={`pill ${filter === "all" ? "pillActive" : ""}`}
          onClick={() => setFilter("all")}
          type="button"
        >
          Alle
        </button>
        <button
          className={`pill ${filter === "open" ? "pillActive" : ""}`}
          onClick={() => setFilter("open")}
          type="button"
        >
          Offen
        </button>
        <button
          className={`pill ${filter === "done" ? "pillActive" : ""}`}
          onClick={() => setFilter("done")}
          type="button"
        >
          Erledigt
        </button>
      </div>

      {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
      {loading ? (
        <p className="muted" style={{ marginTop: 12 }}>Lade…</p>
      ) : (
        <ul className="list">
          {filtered.map((t) => (
            <li key={t.id} className="item">
              <div className="itemRow">
                <label className="checkRow">
                  <input type="checkbox" checked={t.done} onChange={() => toggleDone(t)} />
                  <span className={`taskTitle ${t.done ? "taskDone" : ""}`}>{t.title}</span>
                </label>
                <button onClick={() => remove(t)} className="smallBtn">
                  Delete
                </button>
              </div>
            </li>
          ))}
          {filtered.length === 0 && <li className="muted">Keine Tasks.</li>}
        </ul>
      )}
    </div>
  );
}
