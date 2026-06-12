import { useState, useEffect, useRef, useMemo } from "react";

/* ----------------------------- Design tokens ----------------------------- */
/* Iron grey base, IWF competition-plate colors code the muscle groups.     */
const T = {
  bg: "#16181C",
  panel: "#1F2228",
  panelHi: "#262A31",
  line: "#31363F",
  text: "#ECEDEF",
  dim: "#9AA0AA",
  faint: "#6A707B",
  accent: "#E8B43A", // 15kg plate yellow
  green: "#3FA66A",
  red: "#D9534F",
};
const GROUP_COLORS = {
  Chest: "#D9534F",     // red 25kg
  Back: "#3B6FD4",      // blue 20kg
  Legs: "#E8B43A",      // yellow 15kg
  Shoulders: "#3FA66A", // green 10kg
  Biceps: "#C9CDD4",    // white 5kg
  Triceps: "#8E6FD8",
  Core: "#D98E3A",
  Cardio: "#4FB8C9",
};

const DEFAULT_EXERCISES = [
  ["Flat Barbell Bench Press", "Chest"], ["Incline Dumbbell Press", "Chest"], ["Cable Fly", "Chest"], ["Push Up", "Chest"],
  ["Deadlift", "Back"], ["Barbell Row", "Back"], ["Lat Pulldown", "Back"], ["Pull Up", "Back"], ["Seated Cable Row", "Back"],
  ["Barbell Squat", "Legs"], ["Leg Press", "Legs"], ["Romanian Deadlift", "Legs"], ["Leg Extension", "Legs"], ["Lying Leg Curl", "Legs"], ["Standing Calf Raise", "Legs"],
  ["Overhead Press", "Shoulders"], ["Dumbbell Shoulder Press", "Shoulders"], ["Lateral Raise", "Shoulders"], ["Face Pull", "Shoulders"],
  ["Barbell Curl", "Biceps"], ["Dumbbell Curl", "Biceps"], ["Hammer Curl", "Biceps"],
  ["Cable Pushdown", "Triceps"], ["Skull Crusher", "Triceps"], ["Overhead Triceps Extension", "Triceps"],
  ["Plank", "Core"], ["Hanging Leg Raise", "Core"], ["Cable Crunch", "Core"],
  ["Treadmill Run", "Cardio"], ["Stationary Bike", "Cardio"], ["Rowing Machine", "Cardio"],
].map(([name, group], i) => ({ id: "d" + i, name, group }));

/* ------------------------------- Utilities ------------------------------- */
const dkey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmtDate = (d) => d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const isToday = (d) => dkey(d) === dkey(new Date());
const e1rm = (w, r) => (r <= 1 ? w : w * (1 + r / 30)); // Epley
const round1 = (n) => Math.round(n * 10) / 10;

/* ------------------------------- Sharing ------------------------------- */
const buildShareText = (date, entries, exById, unit) => {
  const lines = [`Workout — ${fmtDate(date)}`, ""];
  let vol = 0;
  for (const en of entries) {
    const ex = exById[en.exId];
    if (!ex || !en.sets.length) continue;
    vol += en.sets.reduce((a, s) => a + s.w * s.r, 0);
    lines.push(`${ex.name}: ${en.sets.map((s) => `${s.w}${unit}×${s.r}`).join(", ")}`);
  }
  lines.push("", `Total volume: ${round1(vol).toLocaleString()} ${unit}`);
  return lines.join("\n");
};

const shareWorkoutText = async (date, entries, exById, unit) => {
  const text = buildShareText(date, entries, exById, unit);
  if (navigator.share) {
    try { await navigator.share({ text }); return "Shared"; }
    catch (e) { if (e.name === "AbortError") return null; }
  }
  try { await navigator.clipboard.writeText(text); return "Copied to clipboard"; }
  catch (e) { return "Could not share on this browser"; }
};

const wrapText = (ctx, text, maxW) => {
  const words = text.split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? cur + " " + w : w;
    if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; }
    else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
};

const shareWorkoutImage = async (date, entries, exById, unit) => {
  const rows = entries.filter((en) => exById[en.exId] && en.sets.length);
  if (!rows.length) return "Nothing to share yet";
  const scale = 2, W = 680, padX = 36, setFont = "400 16px system-ui, sans-serif";

  // measure pass to compute height (sets lines can wrap)
  const m = document.createElement("canvas").getContext("2d");
  m.font = setFont;
  let vol = 0;
  const prepared = rows.map((en) => {
    const ex = exById[en.exId];
    vol += en.sets.reduce((a, s) => a + s.w * s.r, 0);
    const setsStr = en.sets.map((s) => `${s.w}×${s.r}`).join("   ");
    return { ex, lines: wrapText(m, setsStr, W - padX * 2 - 26) };
  });
  const H = 132 + prepared.reduce((a, p) => a + 34 + p.lines.length * 24 + 16, 0) + 84;

  const c = document.createElement("canvas");
  c.width = W * scale; c.height = H * scale;
  const ctx = c.getContext("2d");
  ctx.scale(scale, scale);

  ctx.fillStyle = T.bg; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = T.accent; ctx.font = "800 13px system-ui, sans-serif";
  ctx.fillText("I R O N L O G", padX, 46);
  ctx.fillStyle = T.text; ctx.font = "800 26px system-ui, sans-serif";
  ctx.fillText(fmtDate(date), padX, 84);

  let y = 138;
  for (const p of prepared) {
    ctx.fillStyle = GROUP_COLORS[p.ex.group] || T.dim;
    ctx.beginPath(); ctx.arc(padX + 7, y - 6, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = T.text; ctx.font = "700 18px system-ui, sans-serif";
    ctx.fillText(p.ex.name, padX + 26, y);
    ctx.fillStyle = T.dim; ctx.font = setFont;
    p.lines.forEach((ln, i) => ctx.fillText(ln, padX + 26, y + 26 + i * 24));
    y += 34 + p.lines.length * 24 + 16;
  }

  ctx.strokeStyle = T.line; ctx.beginPath();
  ctx.moveTo(padX, y); ctx.lineTo(W - padX, y); ctx.stroke();
  ctx.fillStyle = T.dim; ctx.font = "400 14px system-ui, sans-serif";
  ctx.fillText("TOTAL VOLUME", padX, y + 32);
  ctx.fillStyle = T.accent; ctx.font = "800 22px system-ui, sans-serif";
  ctx.fillText(`${round1(vol).toLocaleString()} ${unit}`, padX, y + 60);

  const blob = await new Promise((res) => c.toBlob(res, "image/png"));
  if (!blob) return "Could not create image";
  const file = new File([blob], `workout-${dkey(date)}.png`, { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return "Shared"; }
    catch (e) { if (e.name === "AbortError") return null; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `workout-${dkey(date)}.png`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "Image downloaded";
};

const EMPTY = { workouts: {}, customExercises: [], body: [], unit: "kg", lastSet: {} };
const STORAGE_KEY = "ironlog:data";

const loadData = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...EMPTY, ...JSON.parse(raw) };
  } catch (e) {
    console.error("Could not load saved data", e);
  }
  return EMPTY;
};

export default function App() {
  const [data, setData] = useState(loadData);
  const [date, setDate] = useState(new Date());
  const [screen, setScreen] = useState({ name: "home" }); // home | pick | log | body
  const [timer, setTimer] = useState(null); // {remaining, total}
  const timerRef = useRef(null);
  const saveTimeout = useRef(null);

  const persist = (next) => {
    setData(next);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.error("Save failed", e);
      }
    }, 300);
  };

  /* -------------------------------- Timer -------------------------------- */
  useEffect(() => {
    if (!timer) { if (timerRef.current) clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (!t) return null;
        if (t.remaining <= 1) {
          clearInterval(timerRef.current);
          if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
          return { ...t, remaining: 0, done: true };
        }
        return { ...t, remaining: t.remaining - 1 };
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [timer && timer.total, timer && timer.startedAt]);

  const startTimer = (secs) => setTimer({ remaining: secs, total: secs, startedAt: Date.now() });

  /* ------------------------------ Derived data ----------------------------- */
  const allExercises = useMemo(() => [...DEFAULT_EXERCISES, ...data.customExercises], [data.customExercises]);
  const exById = useMemo(() => Object.fromEntries(allExercises.map((e) => [e.id, e])), [allExercises]);
  const key = dkey(date);
  const todayEntries = data.workouts[key] || [];

  // best estimated 1RM per exercise across all history (for PR detection)
  const bestByExercise = useMemo(() => {
    const best = {};
    for (const [, entries] of Object.entries(data.workouts)) {
      for (const en of entries) for (const s of en.sets) {
        const v = e1rm(s.w, s.r);
        if (!best[en.exId] || v > best[en.exId]) best[en.exId] = v;
      }
    }
    return best;
  }, [data.workouts]);

  /* ------------------------------- Mutations ------------------------------- */
  const addExerciseToDay = (exId) => {
    const entries = data.workouts[key] || [];
    if (!entries.find((e) => e.exId === exId)) {
      persist({ ...data, workouts: { ...data.workouts, [key]: [...entries, { exId, sets: [] }] } });
    }
    setScreen({ name: "log", exId });
  };

  const addSet = (exId, w, r) => {
    const entries = (data.workouts[key] || []).map((en) =>
      en.exId === exId ? { ...en, sets: [...en.sets, { w, r, ts: Date.now() }] } : en
    );
    persist({ ...data, workouts: { ...data.workouts, [key]: entries }, lastSet: { ...data.lastSet, [exId]: { w, r } } });
  };

  const updateSet = (exId, idx, w, r) => {
    const entries = (data.workouts[key] || []).map((en) =>
      en.exId === exId ? { ...en, sets: en.sets.map((s, i) => (i === idx ? { ...s, w, r } : s)) } : en
    );
    persist({ ...data, workouts: { ...data.workouts, [key]: entries } });
  };

  const deleteSet = (exId, idx) => {
    const entries = (data.workouts[key] || []).map((en) =>
      en.exId === exId ? { ...en, sets: en.sets.filter((_, i) => i !== idx) } : en
    );
    persist({ ...data, workouts: { ...data.workouts, [key]: entries } });
  };

  const removeExerciseFromDay = (exId) => {
    const entries = (data.workouts[key] || []).filter((en) => en.exId !== exId);
    const w = { ...data.workouts };
    if (entries.length) w[key] = entries; else delete w[key];
    persist({ ...data, workouts: w });
    setScreen({ name: "home" });
  };

  const copyPreviousWorkout = () => {
    const keys = Object.keys(data.workouts).filter((k) => k < key && data.workouts[k].length).sort();
    if (!keys.length) return;
    const prev = data.workouts[keys[keys.length - 1]];
    const copied = prev.map((en) => ({ exId: en.exId, sets: en.sets.map((s) => ({ ...s, ts: Date.now() })) }));
    persist({ ...data, workouts: { ...data.workouts, [key]: copied } });
  };

  const copyWorkoutToDay = (targetKey) => {
    const entries = data.workouts[key] || [];
    if (!entries.length) return;
    const copied = entries.map((en) => ({ exId: en.exId, sets: en.sets.map((s) => ({ ...s, ts: Date.now() })) }));
    persist({ ...data, workouts: { ...data.workouts, [targetKey]: copied } });
  };

  const addCustomExercise = (name, group) => {
    const ex = { id: "c" + Date.now(), name: name.trim(), group };
    persist({ ...data, customExercises: [...data.customExercises, ex] });
    return ex.id;
  };

  const addBodyEntry = (weight) => {
    persist({ ...data, body: [...data.body, { d: dkey(new Date()), w: weight }] });
  };

  /* --------------------------------- Render -------------------------------- */
  return (
    <div style={styles.app}>
      <style>{css}</style>

      {screen.name === "home" && (
        <HomeScreen
          date={date} setDate={setDate} entries={todayEntries} exById={exById}
          unit={data.unit} bestByExercise={bestByExercise}
          onOpen={(exId) => setScreen({ name: "log", exId })}
          onAdd={() => setScreen({ name: "pick" })}
          onBody={() => setScreen({ name: "body" })}
          onCopy={copyPreviousWorkout}
          onCopyTo={copyWorkoutToDay}
          onToggleUnit={() => persist({ ...data, unit: data.unit === "kg" ? "lbs" : "kg" })}
          workouts={data.workouts}
        />
      )}

      {screen.name === "pick" && (
        <PickScreen
          exercises={allExercises}
          onBack={() => setScreen({ name: "home" })}
          onPick={addExerciseToDay}
          onCreate={(name, group) => addExerciseToDay(addCustomExercise(name, group))}
        />
      )}

      {screen.name === "log" && exById[screen.exId] && (
        <LogScreen
          ex={exById[screen.exId]} dateKey={key} dateLabel={fmtDate(date)}
          entry={todayEntries.find((e) => e.exId === screen.exId) || { exId: screen.exId, sets: [] }}
          workouts={data.workouts} unit={data.unit}
          last={data.lastSet[screen.exId]}
          bestE1rm={bestByExercise[screen.exId] || 0}
          onBack={() => setScreen({ name: "home" })}
          onAddSet={addSet} onUpdateSet={updateSet} onDeleteSet={deleteSet}
          onRemove={() => removeExerciseFromDay(screen.exId)}
          onStartTimer={startTimer}
        />
      )}

      {screen.name === "body" && (
        <BodyScreen body={data.body} unit={data.unit} onBack={() => setScreen({ name: "home" })} onAdd={addBodyEntry} />
      )}

      {timer && (
        <div className="timerbar" style={{ background: timer.done ? T.green : T.panelHi }}>
          <div className="timerfill" style={{ width: `${(timer.remaining / timer.total) * 100}%` }} />
          <span style={{ position: "relative", fontVariantNumeric: "tabular-nums", fontWeight: 700, fontSize: 18 }}>
            {timer.done ? "Rest over — next set" : `${Math.floor(timer.remaining / 60)}:${String(timer.remaining % 60).padStart(2, "0")}`}
          </span>
          <button className="ghostbtn" style={{ position: "relative" }} onClick={() => setTimer(null)}>✕</button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Home screen ------------------------------ */
function HomeScreen({ date, setDate, entries, exById, unit, bestByExercise, onOpen, onAdd, onBody, onCopy, onCopyTo, onToggleUnit, workouts }) {
  const [shareOpen, setShareOpen] = useState(false);
  const [shareMsg, setShareMsg] = useState(null);
  const [copyToOpen, setCopyToOpen] = useState(false);
  const [copyToTarget, setCopyToTarget] = useState("");
  const [copyMsg, setCopyMsg] = useState(null);
  const shift = (n) => { const d = new Date(date); d.setDate(d.getDate() + n); setDate(d); };
  const trainedDays = useMemo(() => new Set(Object.keys(workouts).filter((k) => workouts[k].length)), [workouts]);

  const openCopyTo = () => {
    const d = new Date(date); d.setDate(d.getDate() + 1);
    setCopyToTarget(dkey(d));
    setCopyToOpen(true);
    setShareOpen(false);
  };

  const confirmCopyTo = () => {
    if (!copyToTarget) return;
    onCopyTo(copyToTarget);
    setCopyToOpen(false);
    const label = new Date(copyToTarget + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
    setCopyMsg(`Copied to ${label}`);
    setTimeout(() => setCopyMsg(null), 2500);
  };

  const copyToHasWorkout = copyToTarget && (workouts[copyToTarget] || []).length > 0;

  const doShare = async (kind) => {
    const msg = kind === "text"
      ? await shareWorkoutText(date, entries, exById, unit)
      : await shareWorkoutImage(date, entries, exById, unit);
    setShareOpen(false);
    if (msg) { setShareMsg(msg); setTimeout(() => setShareMsg(null), 2500); }
  };

  const hasSets = entries.some((en) => en.sets.length);

  // 14-day strip centered on selected date
  const strip = [];
  for (let i = -6; i <= 7; i++) { const d = new Date(date); d.setDate(d.getDate() + i); strip.push(d); }

  const totalVolume = entries.reduce((acc, en) => acc + en.sets.reduce((a, s) => a + s.w * s.r, 0), 0);

  return (
    <div style={styles.screen}>
      <header style={styles.header}>
        <div>
          <div style={styles.brand}>IRONLOG</div>
          <button className="datebtn" onClick={() => setDate(new Date())} title="Jump to today">
            {fmtDate(date)} {isToday(date) ? "" : "· tap for today"}
          </button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {entries.length > 0 && <button className="ghostbtn" onClick={openCopyTo}>Copy to</button>}
          {hasSets && <button className="ghostbtn" onClick={() => setShareOpen((o) => !o)}>Share</button>}
          <button className="ghostbtn" onClick={onToggleUnit}>{unit}</button>
          <button className="ghostbtn" onClick={onBody}>Body</button>
        </div>
      </header>

      {shareOpen && (
        <div className="panel" style={{ display: "flex", gap: 8 }}>
          <button className="chip" style={{ flex: 1, justifyContent: "center", padding: "11px 12px" }} onClick={() => doShare("text")}>
            Share as text
          </button>
          <button className="chip" style={{ flex: 1, justifyContent: "center", padding: "11px 12px" }} onClick={() => doShare("image")}>
            Share as image
          </button>
        </div>
      )}

      {copyToOpen && (
        <div className="panel" style={{ display: "grid", gap: 10 }}>
          <div style={{ fontSize: 13, color: T.dim, letterSpacing: 1, textTransform: "uppercase", fontWeight: 700 }}>Copy workout to</div>
          <input
            type="date"
            className="input"
            value={copyToTarget}
            min={dkey(new Date(date.getFullYear(), date.getMonth(), date.getDate() - 365))}
            onChange={(e) => setCopyToTarget(e.target.value)}
          />
          {copyToHasWorkout && (
            <div style={{ fontSize: 13, color: T.accent }}>⚠ That day already has a workout — it will be replaced.</div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="primary" style={{ flex: 1 }} disabled={!copyToTarget || copyToTarget === dkey(date)} onClick={confirmCopyTo}>
              {copyToHasWorkout ? "Replace" : "Copy"}
            </button>
            <button className="chip" style={{ padding: "12px 18px" }} onClick={() => setCopyToOpen(false)}>Cancel</button>
          </div>
        </div>
      )}

      {shareMsg && <div className="toast">{shareMsg}</div>}
      {copyMsg && <div className="toast">{copyMsg}</div>}

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button className="navbtn" onClick={() => shift(-1)}>‹</button>
        <div className="strip">
          {strip.map((d) => {
            const k = dkey(d);
            const sel = k === dkey(date);
            return (
              <button key={k} className="day" onClick={() => setDate(new Date(d))}
                style={{ background: sel ? T.accent : "transparent", color: sel ? "#1A1408" : isToday(d) ? T.accent : T.dim }}>
                <span style={{ fontSize: 10, letterSpacing: 1 }}>{d.toLocaleDateString(undefined, { weekday: "narrow" })}</span>
                <span style={{ fontWeight: 700 }}>{d.getDate()}</span>
                <span className="dot" style={{ background: trainedDays.has(k) ? (sel ? "#1A1408" : T.accent) : "transparent" }} />
              </button>
            );
          })}
        </div>
        <button className="navbtn" onClick={() => shift(1)}>›</button>
      </div>

      {entries.length === 0 ? (
        <div className="empty">
          <div style={{ fontSize: 15, color: T.dim, marginBottom: 14 }}>Nothing logged for this day.</div>
          <button className="primary" onClick={onAdd}>+ Add exercise</button>
          <button className="ghostbtn" style={{ marginTop: 10 }} onClick={onCopy}>Copy previous workout</button>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "4px 2px" }}>
            <span style={{ color: T.faint, fontSize: 12, letterSpacing: 1, textTransform: "uppercase" }}>
              {entries.length} exercise{entries.length > 1 ? "s" : ""}
            </span>
            <span style={{ color: T.dim, fontSize: 13 }}>Volume {round1(totalVolume).toLocaleString()} {unit}</span>
          </div>

          {entries.map((en) => {
            const ex = exById[en.exId]; if (!ex) return null;
            const best = en.sets.reduce((m, s) => Math.max(m, e1rm(s.w, s.r)), 0);
            const isPR = best > 0 && Math.abs(best - (bestByExercise[en.exId] || 0)) < 0.001;
            return (
              <button key={en.exId} className="card" onClick={() => onOpen(en.exId)}>
                <span className="plate" style={{ background: GROUP_COLORS[ex.group] || T.dim }} />
                <div style={{ flex: 1, textAlign: "left" }}>
                  <div style={{ fontWeight: 600 }}>{ex.name} {isPR && <span className="pr">PR</span>}</div>
                  <div style={{ color: T.dim, fontSize: 13, marginTop: 3 }}>
                    {en.sets.length === 0 ? "No sets yet" : en.sets.map((s) => `${s.w}×${s.r}`).join("  ·  ")}
                  </div>
                </div>
                <span style={{ color: T.faint }}>›</span>
              </button>
            );
          })}
          <button className="primary" style={{ marginTop: 8 }} onClick={onAdd}>+ Add exercise</button>
        </>
      )}
    </div>
  );
}

/* --------------------------- Exercise picker --------------------------- */
function PickScreen({ exercises, onBack, onPick, onCreate }) {
  const [q, setQ] = useState("");
  const [openGroup, setOpenGroup] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newGroup, setNewGroup] = useState("Chest");

  const groups = Object.keys(GROUP_COLORS);
  const filtered = q ? exercises.filter((e) => e.name.toLowerCase().includes(q.toLowerCase())) : null;

  return (
    <div style={styles.screen}>
      <header style={styles.header}>
        <button className="ghostbtn" onClick={onBack}>‹ Back</button>
        <div style={{ fontWeight: 700, letterSpacing: 2, fontSize: 13 }}>SELECT EXERCISE</div>
        <button className="ghostbtn" onClick={() => setCreating((c) => !c)}>{creating ? "✕" : "+ New"}</button>
      </header>

      {creating && (
        <div className="panel" style={{ display: "grid", gap: 10 }}>
          <input className="input" placeholder="Exercise name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {groups.map((g) => (
              <button key={g} className="chip" onClick={() => setNewGroup(g)}
                style={{ borderColor: newGroup === g ? GROUP_COLORS[g] : T.line, color: newGroup === g ? T.text : T.dim }}>
                <span className="plate sm" style={{ background: GROUP_COLORS[g] }} />{g}
              </button>
            ))}
          </div>
          <button className="primary" disabled={!newName.trim()} onClick={() => newName.trim() && onCreate(newName, newGroup)}>
            Create and add to workout
          </button>
        </div>
      )}

      <input className="input" placeholder="Search exercises…" value={q} onChange={(e) => setQ(e.target.value)} />

      {filtered ? (
        filtered.length ? filtered.map((e) => (
          <button key={e.id} className="card" onClick={() => onPick(e.id)}>
            <span className="plate" style={{ background: GROUP_COLORS[e.group] }} />
            <div style={{ flex: 1, textAlign: "left", fontWeight: 600 }}>{e.name}</div>
            <span style={{ color: T.faint, fontSize: 12 }}>{e.group}</span>
          </button>
        )) : <div className="empty" style={{ color: T.dim }}>No match — create it with “+ New”.</div>
      ) : (
        groups.map((g) => {
          const list = exercises.filter((e) => e.group === g);
          const open = openGroup === g;
          return (
            <div key={g}>
              <button className="card" onClick={() => setOpenGroup(open ? null : g)}>
                <span className="plate" style={{ background: GROUP_COLORS[g] }} />
                <div style={{ flex: 1, textAlign: "left", fontWeight: 700 }}>{g}</div>
                <span style={{ color: T.faint }}>{list.length} {open ? "▾" : "▸"}</span>
              </button>
              {open && list.map((e) => (
                <button key={e.id} className="card sub" onClick={() => onPick(e.id)}>
                  <div style={{ flex: 1, textAlign: "left" }}>{e.name}</div><span style={{ color: T.faint }}>+</span>
                </button>
              ))}
            </div>
          );
        })
      )}
    </div>
  );
}

/* ------------------------------ Log screen ------------------------------ */
function LogScreen({ ex, dateKey, dateLabel, entry, workouts, unit, last, bestE1rm, onBack, onAddSet, onUpdateSet, onDeleteSet, onRemove, onStartTimer }) {
  const [tab, setTab] = useState("track");
  const [w, setW] = useState(last ? last.w : 20);
  const [r, setR] = useState(last ? last.r : 8);
  const [editing, setEditing] = useState(null); // set index

  const history = useMemo(() => {
    const rows = [];
    for (const [k, entries] of Object.entries(workouts)) {
      const en = entries.find((e) => e.exId === ex.id);
      if (en && en.sets.length) rows.push({ k, sets: en.sets, best: en.sets.reduce((m, s) => Math.max(m, e1rm(s.w, s.r)), 0) });
    }
    return rows.sort((a, b) => (a.k < b.k ? 1 : -1));
  }, [workouts, ex.id]);

  const step = (setter, val, delta, min) => setter(Math.max(min, round1(val + delta)));

  return (
    <div style={styles.screen}>
      <header style={styles.header}>
        <button className="ghostbtn" onClick={onBack}>‹ Back</button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 700 }}>{ex.name}</div>
          <div style={{ color: T.faint, fontSize: 11 }}>{dateLabel}</div>
        </div>
        <button className="ghostbtn" onClick={onRemove} title="Remove from this workout">🗑</button>
      </header>

      <div className="tabs">
        {["track", "history", "graph"].map((t) => (
          <button key={t} className="tab" onClick={() => setTab(t)}
            style={{ borderBottomColor: tab === t ? GROUP_COLORS[ex.group] : "transparent", color: tab === t ? T.text : T.dim }}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {tab === "track" && (
        <>
          <div className="panel" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Stepper label={`WEIGHT (${unit})`} value={w}
              onMinus={() => step(setW, w, -2.5, 0)} onPlus={() => step(setW, w, 2.5, 0)}
              onChange={(v) => setW(Math.max(0, v))} />
            <Stepper label="REPS" value={r}
              onMinus={() => step(setR, r, -1, 1)} onPlus={() => step(setR, r, 1, 1)}
              onChange={(v) => setR(Math.max(1, Math.round(v)))} />
          </div>

          {editing === null ? (
            <button className="primary big" onClick={() => { onAddSet(ex.id, w, r); }}>SAVE SET</button>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <button className="primary big" style={{ flex: 1 }} onClick={() => { onUpdateSet(ex.id, editing, w, r); setEditing(null); }}>UPDATE SET {editing + 1}</button>
              <button className="ghostbtn" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 2 }}>
            <span style={{ color: T.faint, fontSize: 12, alignSelf: "center" }}>Rest:</span>
            {[60, 90, 120, 180].map((s) => (
              <button key={s} className="chip" onClick={() => onStartTimer(s)}>{s >= 120 ? `${s / 60}m` : `${s}s`}</button>
            ))}
          </div>

          <div style={{ marginTop: 10 }}>
            {entry.sets.length === 0 && <div className="empty" style={{ color: T.dim }}>No sets logged yet today.</div>}
            {entry.sets.map((s, i) => {
              const v = e1rm(s.w, s.r);
              const isPR = bestE1rm > 0 && Math.abs(v - bestE1rm) < 0.001;
              return (
                <div key={i} className="setrow" style={{ background: editing === i ? T.panelHi : T.panel }}>
                  <span style={{ color: T.faint, width: 26 }}>{i + 1}</span>
                  <span className="bignum">{s.w}</span><span style={{ color: T.dim }}>{unit}</span>
                  <span style={{ color: T.faint, margin: "0 4px" }}>×</span>
                  <span className="bignum">{s.r}</span>
                  {isPR && <span className="pr">PR</span>}
                  <span style={{ flex: 1 }} />
                  <button className="ghostbtn" onClick={() => { setEditing(i); setW(s.w); setR(s.r); }}>Edit</button>
                  <button className="ghostbtn" onClick={() => onDeleteSet(ex.id, i)} style={{ color: T.red }}>✕</button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === "history" && (
        <div>
          {history.length === 0 && <div className="empty" style={{ color: T.dim }}>No history for this exercise yet.</div>}
          {history.map((h) => (
            <div key={h.k} className="panel" style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontWeight: 600 }}>{new Date(h.k + "T12:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</span>
                <span style={{ color: T.dim, fontSize: 13 }}>est 1RM {round1(h.best)} {unit}</span>
              </div>
              <div style={{ color: T.dim, fontSize: 14 }}>{h.sets.map((s) => `${s.w}×${s.r}`).join("  ·  ")}</div>
            </div>
          ))}
        </div>
      )}

      {tab === "graph" && <Graph history={[...history].reverse()} unit={unit} color={GROUP_COLORS[ex.group]} />}
    </div>
  );
}

function Stepper({ label, value, onMinus, onPlus, onChange }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ color: T.faint, fontSize: 11, letterSpacing: 2, marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
        <button className="stepbtn" onClick={onMinus}>−</button>
        <input className="numinput" inputMode="decimal" value={value}
          onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(v); else if (e.target.value === "") onChange(0); }} />
        <button className="stepbtn" onClick={onPlus}>+</button>
      </div>
    </div>
  );
}

/* ------------------------------ Progress graph ------------------------------ */
function Graph({ history, unit, color }) {
  if (history.length < 2) return <div className="empty" style={{ color: T.dim }}>Log this exercise on at least two days to see a trend.</div>;
  const W = 640, H = 240, pad = 36;
  const vals = history.map((h) => h.best);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const x = (i) => pad + (i * (W - pad * 2)) / (history.length - 1);
  const y = (v) => H - pad - ((v - min) / span) * (H - pad * 2);
  const path = vals.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ");
  return (
    <div className="panel">
      <div style={{ color: T.dim, fontSize: 12, marginBottom: 6 }}>Estimated 1RM over time ({unit})</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
        {[min, (min + max) / 2, max].map((v, i) => (
          <g key={i}>
            <line x1={pad} x2={W - pad} y1={y(v)} y2={y(v)} stroke={T.line} strokeDasharray="3 5" />
            <text x={6} y={y(v) + 4} fill={T.faint} fontSize="11">{round1(v)}</text>
          </g>
        ))}
        <path d={path} fill="none" stroke={color} strokeWidth="2.5" />
        {vals.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="4" fill={color} />)}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", color: T.faint, fontSize: 11 }}>
        <span>{history[0].k}</span><span>{history[history.length - 1].k}</span>
      </div>
    </div>
  );
}

/* ------------------------------ Body tracker ------------------------------ */
function BodyScreen({ body, unit, onBack, onAdd }) {
  const [w, setW] = useState(body.length ? body[body.length - 1].w : 70);
  const rows = [...body].sort((a, b) => (a.d < b.d ? 1 : -1));
  const trend = [...body].sort((a, b) => (a.d > b.d ? 1 : -1)).map((b2) => ({ k: b2.d, best: b2.w }));
  return (
    <div style={styles.screen}>
      <header style={styles.header}>
        <button className="ghostbtn" onClick={onBack}>‹ Back</button>
        <div style={{ fontWeight: 700, letterSpacing: 2, fontSize: 13 }}>BODY TRACKER</div>
        <span style={{ width: 60 }} />
      </header>
      <div className="panel" style={{ display: "grid", gap: 12 }}>
        <Stepper label={`BODY WEIGHT (${unit})`} value={w}
          onMinus={() => setW(round1(Math.max(0, w - 0.1)))} onPlus={() => setW(round1(w + 0.1))}
          onChange={(v) => setW(Math.max(0, v))} />
        <button className="primary" onClick={() => onAdd(w)}>Log today's weight</button>
      </div>
      {trend.length >= 2 && <Graph history={trend} unit={unit} color={T.accent} />}
      {rows.map((b2, i) => (
        <div key={i} className="setrow">
          <span style={{ flex: 1 }}>{new Date(b2.d + "T12:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</span>
          <span className="bignum">{b2.w}</span><span style={{ color: T.dim }}>{unit}</span>
        </div>
      ))}
      {rows.length === 0 && <div className="empty" style={{ color: T.dim }}>No entries yet — log your first weigh-in above.</div>}
    </div>
  );
}

/* --------------------------------- Styles --------------------------------- */
const styles = {
  app: { minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'Avenir Next', 'Segoe UI', system-ui, sans-serif", paddingBottom: 80 },
  screen: { maxWidth: 560, margin: "0 auto", padding: "16px 14px", display: "grid", gap: 10, alignContent: "start" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 2 },
  brand: { fontSize: 12, letterSpacing: 4, color: T.accent, fontWeight: 800 },
};

const css = `
  * { box-sizing: border-box; }
  body { margin: 0; }
  button { font-family: inherit; cursor: pointer; border: none; }
  .datebtn { background: none; color: ${T.text}; font-size: 17px; font-weight: 700; padding: 2px 0; text-align: left; }
  .ghostbtn { background: none; color: ${T.dim}; padding: 8px 10px; border-radius: 8px; font-size: 14px; }
  .ghostbtn:hover { background: ${T.panelHi}; color: ${T.text}; }
  .navbtn { background: ${T.panel}; color: ${T.dim}; width: 34px; height: 56px; border-radius: 10px; font-size: 20px; flex-shrink: 0; }
  .strip { display: flex; gap: 2px; overflow-x: auto; scrollbar-width: none; flex: 1; }
  .strip::-webkit-scrollbar { display: none; }
  .day { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 7px 0 5px; border-radius: 10px; min-width: 38px; font-size: 14px; }
  .dot { width: 5px; height: 5px; border-radius: 50%; }
  .card { display: flex; align-items: center; gap: 12px; width: 100%; background: ${T.panel}; border: 1px solid ${T.line}; border-radius: 12px; padding: 13px 14px; color: ${T.text}; font-size: 15px; }
  .card:hover { background: ${T.panelHi}; }
  .card.sub { background: transparent; border: none; border-left: 2px solid ${T.line}; border-radius: 0; margin-left: 18px; padding: 10px 14px; width: calc(100% - 18px); color: ${T.dim}; }
  .card.sub:hover { color: ${T.text}; }
  .plate { width: 12px; height: 12px; border-radius: 50%; box-shadow: inset 0 0 0 3px ${T.bg}; flex-shrink: 0; }
  .plate.sm { width: 9px; height: 9px; box-shadow: inset 0 0 0 2px ${T.bg}; }
  .panel { background: ${T.panel}; border: 1px solid ${T.line}; border-radius: 12px; padding: 14px; }
  .primary { background: ${T.accent}; color: #1A1408; font-weight: 800; letter-spacing: 1px; padding: 13px; border-radius: 12px; font-size: 15px; width: 100%; }
  .primary:disabled { opacity: .4; cursor: default; }
  .primary.big { font-size: 16px; padding: 15px; }
  .primary:hover:not(:disabled) { filter: brightness(1.08); }
  .chip { background: ${T.panel}; border: 1px solid ${T.line}; color: ${T.dim}; padding: 6px 12px; border-radius: 999px; font-size: 13px; display: inline-flex; align-items: center; gap: 6px; }
  .chip:hover { color: ${T.text}; }
  .input { background: ${T.panel}; border: 1px solid ${T.line}; color: ${T.text}; padding: 12px 14px; border-radius: 12px; font-size: 15px; width: 100%; font-family: inherit; }
  .input:focus { outline: 2px solid ${T.accent}; outline-offset: -1px; }
  .tabs { display: flex; border-bottom: 1px solid ${T.line}; }
  .tab { background: none; flex: 1; padding: 11px 0; font-size: 12px; letter-spacing: 2px; font-weight: 700; border-bottom: 2px solid transparent; }
  .setrow { display: flex; align-items: center; gap: 6px; background: ${T.panel}; border: 1px solid ${T.line}; border-radius: 10px; padding: 9px 12px; margin-bottom: 6px; font-size: 15px; }
  .bignum { font-size: 19px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .stepbtn { background: ${T.panelHi}; color: ${T.text}; width: 42px; height: 42px; border-radius: 10px; font-size: 20px; flex-shrink: 0; }
  .stepbtn:hover { background: ${T.line}; }
  .numinput { background: ${T.bg}; border: 1px solid ${T.line}; color: ${T.text}; width: 84px; text-align: center; font-size: 24px; font-weight: 800; padding: 8px 4px; border-radius: 10px; font-variant-numeric: tabular-nums; font-family: inherit; }
  .numinput:focus { outline: 2px solid ${T.accent}; outline-offset: -1px; }
  .pr { background: ${T.accent}; color: #1A1408; font-size: 10px; font-weight: 900; letter-spacing: 1px; padding: 2px 6px; border-radius: 5px; margin-left: 8px; vertical-align: middle; }
  .empty { text-align: center; padding: 36px 12px; }
  .toast { position: fixed; left: 50%; transform: translateX(-50%); bottom: 84px; background: ${T.panelHi}; border: 1px solid ${T.line}; color: ${T.text}; padding: 10px 18px; border-radius: 999px; font-size: 14px; z-index: 10; box-shadow: 0 6px 24px rgba(0,0,0,.45); }
  .timerbar { position: fixed; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; gap: 14px; padding: 14px; padding-bottom: calc(14px + env(safe-area-inset-bottom)); overflow: hidden; border-top: 1px solid ${T.line}; }
  .timerfill { position: absolute; left: 0; top: 0; bottom: 0; background: rgba(232,180,58,.18); transition: width 1s linear; }
  @media (prefers-reduced-motion: reduce) { .timerfill { transition: none; } }
`;
