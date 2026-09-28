import { useEffect, useState } from "react";

const field = "w-full rounded-lg border border-gold/60 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-saffron";
const btn = "rounded-full px-5 py-2 font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold";
const slots = ["12:00", "13:30", "18:30", "19:00", "20:30", "21:30"];
const blank = { name: "", price: "", veg: true, img: "", desc: "" };

export default function Admin() {
  const [pw, setPw] = useState(sessionStorage.getItem("adminpw") || ""), [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState("menu"), [items, setItems] = useState([]), [nw, setNw] = useState(blank), [msg, setMsg] = useState("");

  const call = (method, path, body) => fetch(`/api${path}`, { method, headers: { "Content-Type": "application/json", "X-Admin-Password": pw }, body: body && JSON.stringify(body) })
    .then(async r => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(typeof d.detail === "string" ? d.detail : "Check the fields: name, a whole-number price above 0, and a description."); return d; });
  const load = () => fetch("/api/menu").then(r => r.json()).then(setItems);
  const login = e => { e?.preventDefault(); call("POST", "/admin/login").then(() => { sessionStorage.setItem("adminpw", pw); setAuthed(true); setMsg(""); load(); }).catch(e => setMsg(e.message)); };
  useEffect(() => { if (pw) login(); }, []);

  const body = d => ({ name: d.name, price: +d.price, veg: d.veg, img: d.img || "", desc: d.desc });
  const edit = (id, k, v) => setItems(items.map(m => m.id === id ? { ...m, [k]: v } : m));
  const act = (p, ok) => p.then(() => { setMsg(ok); load(); }).catch(e => setMsg(e.message));
  const save = m => act(call("PUT", `/admin/menu/${m.id}`, body(m)), `Saved ${m.name}.`);
  const remove = m => window.confirm(`Remove ${m.name} from the menu?`) && act(call("DELETE", `/admin/menu/${m.id}`), `Removed ${m.name}.`);
  const add = e => { e.preventDefault(); act(call("POST", "/admin/menu", body(nw)), `Added ${nw.name}.`).then(() => setNw(blank)); };

  if (!authed) return <main className="min-h-screen grid place-items-center bg-cream px-5">
    <form onSubmit={login} className="w-full max-w-sm rounded-2xl border-2 border-gold bg-white p-8">
      <h1 className="font-serif text-3xl text-maroon">Menu admin</h1>
      <label className="block mt-5">Password<input type="password" className={field} value={pw} onChange={e => setPw(e.target.value)} /></label>
      {msg && <p role="alert" className="mt-3 text-sm text-red-700">{msg}</p>}
      <button className={`${btn} mt-5 w-full bg-maroon text-cream`}>Sign in</button></form></main>;

  return <main className="min-h-screen bg-cream text-ink">
    <header className="bg-maroon text-cream"><div className="max-w-5xl mx-auto flex items-center justify-between px-5 py-4">
      <h1 className="font-serif text-2xl text-saffron">Menu admin</h1>
      <span className="flex gap-4 text-sm">
        {["menu", "bookings"].map(k => <button key={k} onClick={() => { setTab(k); setMsg(""); }} className={`capitalize ${tab === k ? "text-saffron font-bold" : "underline"}`}>{k}</button>)}<a href="#" className="underline">View site</a>
        <button onClick={() => { sessionStorage.removeItem("adminpw"); setAuthed(false); setPw(""); }} className="underline">Sign out</button></span></div></header>
    {tab === "bookings" ? <Bookings call={call} /> : <div className="max-w-5xl mx-auto px-5 py-8">
      {msg && <p role="status" className="mb-5 rounded-xl bg-saffron/20 p-3">{msg}</p>}
      <form onSubmit={add} className="rounded-2xl border-2 border-gold bg-white p-5 grid gap-3 md:grid-cols-6">
        <h2 className="font-serif text-xl text-maroon md:col-span-6">Add a dish</h2>
        <input className={`${field} md:col-span-2`} placeholder="Name" value={nw.name} onChange={e => setNw({ ...nw, name: e.target.value })} />
        <input className={field} type="number" min="1" placeholder="Price (₹)" value={nw.price} onChange={e => setNw({ ...nw, price: e.target.value })} />
        <select className={field} value={nw.veg ? "v" : "n"} onChange={e => setNw({ ...nw, veg: e.target.value === "v" })}><option value="v">Vegetarian</option><option value="n">Non-vegetarian</option></select>
        <input className={`${field} md:col-span-2`} placeholder="Image URL" value={nw.img} onChange={e => setNw({ ...nw, img: e.target.value })} />
        <textarea className={`${field} md:col-span-5`} rows="2" placeholder="Description" value={nw.desc} onChange={e => setNw({ ...nw, desc: e.target.value })} />
        <button className={`${btn} bg-maroon text-cream`}>Add dish</button></form>

      <h2 className="font-serif text-xl text-maroon mt-10 mb-3">Current menu ({items.length})</h2>
      <div className="grid gap-3">{items.map(m => <div key={m.id} className="rounded-2xl bg-white border border-gold/50 p-4 grid gap-3 md:grid-cols-6">
        <input aria-label="Name" className={`${field} md:col-span-2`} value={m.name} onChange={e => edit(m.id, "name", e.target.value)} />
        <input aria-label="Price" className={field} type="number" min="1" value={m.price} onChange={e => edit(m.id, "price", e.target.value)} />
        <select aria-label="Type" className={field} value={m.veg ? "v" : "n"} onChange={e => edit(m.id, "veg", e.target.value === "v")}><option value="v">Vegetarian</option><option value="n">Non-vegetarian</option></select>
        <input aria-label="Image URL" className={`${field} md:col-span-2`} value={m.img} onChange={e => edit(m.id, "img", e.target.value)} />
        <textarea aria-label="Description" className={`${field} md:col-span-4`} rows="2" value={m.desc} onChange={e => edit(m.id, "desc", e.target.value)} />
        <div className="md:col-span-2 flex gap-2 items-start">
          <button onClick={() => save(m)} className={`${btn} bg-maroon text-cream`}>Save</button>
          <button onClick={() => remove(m)} className={`${btn} border border-maroon text-maroon`}>Remove</button></div>
      </div>)}</div>
    </div>}</main>;
}

function Bookings({ call }) {
  const [rows, setRows] = useState([]), [closed, setClosed] = useState([]), [msg, setMsg] = useState("");
  const [f, setF] = useState({ day: "", allDays: false, time: "19:00", allTimes: false });
  const load = () => Promise.all([call("GET", "/admin/reservations"), call("GET", "/admin/closures")]).then(([r, c]) => { setRows(r); setClosed(c); }).catch(e => setMsg(e.message));
  useEffect(() => { load(); }, []);
  const act = (p, ok) => p.then(() => { setMsg(ok); load(); }).catch(e => setMsg(e.message));
  const today = new Date().toISOString().slice(0, 10);
  const cancel = r => window.confirm(`Cancel ${r.name}'s booking on ${r.day} at ${r.time}?`) && act(call("DELETE", `/admin/reservations/${r.id}`), "Booking cancelled.");
  const close = e => {
    e.preventDefault(); const day = f.allDays ? "*" : f.day; if (!day) return setMsg("Pick a date, or tick all dates.");
    act(call("POST", "/admin/closures", { day, time: f.allTimes ? "*" : f.time }), "Online bookings closed for that slot.");
  };
  const label = c => `${c.day === "*" ? "Every date" : c.day} · ${c.time === "*" ? "all times" : c.time}`;
  const upcoming = rows.filter(r => r.day >= today), past = rows.length - upcoming.length;
  return <div className="max-w-5xl mx-auto px-5 py-8">
    {msg && <p role="status" className="mb-5 rounded-xl bg-saffron/20 p-3">{msg}</p>}
    <form onSubmit={close} className="rounded-2xl border-2 border-gold bg-white p-5 grid gap-3 md:grid-cols-5 items-end">
      <h2 className="font-serif text-xl text-maroon md:col-span-5">Stop taking bookings</h2>
      <p className="md:col-span-5 text-sm">Use this when the tables are full or the restaurant is closed. Guests see a "not taking bookings" message for a closed slot. Slots also close on their own when every seat is taken.</p>
      <label>Date<input type="date" disabled={f.allDays} className={field} value={f.day} min={today} onChange={e => setF({ ...f, day: e.target.value })} /></label>
      <label className="flex items-center gap-2 pb-2"><input type="checkbox" checked={f.allDays} onChange={e => setF({ ...f, allDays: e.target.checked })} />All dates</label>
      <label>Time<select disabled={f.allTimes} className={field} value={f.time} onChange={e => setF({ ...f, time: e.target.value })}>{slots.map(s => <option key={s}>{s}</option>)}</select></label>
      <label className="flex items-center gap-2 pb-2"><input type="checkbox" checked={f.allTimes} onChange={e => setF({ ...f, allTimes: e.target.checked })} />All times</label>
      <button className={`${btn} bg-maroon text-cream`}>Close bookings</button></form>
    <h3 className="font-serif text-lg text-maroon mt-6 mb-2">Closed now</h3>
    {closed.length === 0 ? <p className="text-sm">Nothing is closed. Guests can book any slot that still has seats.</p> :
      <div className="flex flex-wrap gap-2">{closed.map(c => <span key={c.id} className="rounded-full bg-white border border-gold px-4 py-1 text-sm">{label(c)}
        <button aria-label={`Reopen ${label(c)}`} onClick={() => act(call("DELETE", `/admin/closures/${c.id}`), "Bookings reopened.")} className="ml-3 text-maroon underline">Reopen</button></span>)}</div>}
    <h2 className="font-serif text-xl text-maroon mt-10 mb-3">Upcoming reservations ({upcoming.length})</h2>
    {upcoming.length === 0 ? <p className="text-sm">No upcoming reservations yet.</p> :
      <div className="overflow-x-auto rounded-2xl bg-white border border-gold/50"><table className="w-full text-left text-sm">
        <thead className="bg-maroon text-cream"><tr>{["Date", "Time", "Name", "Phone", "Guests", "Notes", ""].map(h => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
        <tbody>{upcoming.map(r => <tr key={r.id} className="border-t border-gold/30">
          <td className="px-4 py-3">{r.day}</td><td className="px-4 py-3">{r.time}</td><td className="px-4 py-3">{r.name}</td>
          <td className="px-4 py-3"><a href={`tel:${r.phone}`} className="underline">{r.phone}</a></td><td className="px-4 py-3">{r.guests}</td><td className="px-4 py-3">{r.notes}</td>
          <td className="px-4 py-3"><button onClick={() => cancel(r)} className="text-maroon underline">Cancel</button></td></tr>)}</tbody></table></div>}
    {past > 0 && <p className="mt-3 text-sm">{past} earlier booking{past > 1 ? "s" : ""} not shown.</p>}
  </div>;
}
