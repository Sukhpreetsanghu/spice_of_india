import { useEffect, useRef, useState } from "react";
import Admin from "./Admin";

const api = (path, body) => fetch(`/api${path}`, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined).then(r => r.json());
const IMG = "https://images.unsplash.com/";
const GALLERY = ["photo-1517248135467-4c7edcad34c4", "photo-1585937421612-70a008356fbe", "photo-1596797038530-2c107229654b", "photo-1631515243349-e0cb75fb8d3a", "photo-1567188040759-fb8a883dc6d8"].map(p => `${IMG}${p}?w=1000`);
const btn = "rounded-full px-6 py-3 font-bold transition hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold";

function Reveal({ children, className = "" }) {
  const ref = useRef();
  useEffect(() => { const o = new IntersectionObserver(([e]) => e.isIntersecting && (ref.current.classList.add("in"), o.disconnect()), { threshold: .15 }); o.observe(ref.current); return () => o.disconnect(); }, []);
  return <div ref={ref} className={`reveal ${className}`}>{children}</div>;
}

function Nav() {
  return <header className="fixed top-0 inset-x-0 z-30 bg-maroon/90 backdrop-blur text-cream">
    <nav className="max-w-6xl mx-auto flex items-center justify-between px-5 py-3">
      <a href="#top" className="font-serif text-xl font-bold text-saffron">Spice of India</a>
      <div className="hidden md:flex gap-6 text-sm">{["menu", "gallery", "about", "reserve", "contact"].map(s => <a key={s} href={`#${s}`} className="capitalize hover:text-saffron">{s}</a>)}</div>
    </nav></header>;
}

function Hero() {
  return <section id="top" className="relative min-h-screen grid place-items-center text-center text-cream bg-cover bg-center" style={{ backgroundImage: `linear-gradient(rgba(74,10,18,.72),rgba(43,26,20,.85)),url(${IMG}photo-1517248135467-4c7edcad34c4?w=1800)` }}>
    <div className="px-5 max-w-3xl">
      <h1 className="font-serif text-5xl md:text-7xl font-bold leading-tight">Slow-cooked. Hand-ground. Made to be shared.</h1>
      <p className="mt-5 text-lg text-cream/85">Punjabi tandoor classics and Hyderabadi dum, cooked the way our grandmothers did.</p>
      <a href="#reserve" className={`${btn} pulse-cta inline-block mt-8 bg-saffron text-ink`}>Reserve Now</a>
    </div></section>;
}

function Menu({ lang, setLang }) {
  const [items, setItems] = useState([]), [tr, setTr] = useState({}), [busy, setBusy] = useState(false);
  const [q, setQ] = useState(""), [rec, setRec] = useState(null), [flipped, setFlipped] = useState(null);
  useEffect(() => { api("/menu").then(setItems); }, []);
  useEffect(() => { setBusy(true); api("/translate", { lang }).then(setTr).catch(() => setTr({})).finally(() => setBusy(false)); }, [lang]);
  const ask = async e => { e.preventDefault(); if (q.trim().length > 1) setRec(await api("/recommend", { query: q })); };
  const recIds = rec?.dishes?.map(d => d.id) || [];
  return <section id="menu" className="max-w-6xl mx-auto px-5 pt-28 pb-24">
    <Reveal>
      <h2 className="font-serif text-4xl text-maroon">Our menu</h2>
      <div className="mt-4 flex flex-wrap gap-3 items-center">
        <select value={lang} onChange={e => setLang(e.target.value)} aria-label="Language" className="rounded-full border border-gold bg-white px-4 py-2">
          <option value="en">English</option><option value="hi">हिन्दी</option><option value="pa">ਪੰਜਾਬੀ</option></select>
        {busy && <span className="text-sm">Translating…</span>}
        <form onSubmit={ask} className="flex flex-1 min-w-64 gap-2">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="What do you feel like? Mild, vegetarian, festive…" className="flex-1 rounded-full border border-gold px-4 py-2 bg-white" />
          <button className={`${btn} bg-maroon text-cream !py-2`}>Recommend</button></form>
      </div>
      {rec && <p className="mt-4 rounded-2xl bg-saffron/20 p-4">{rec.message}</p>}
    </Reveal>
    <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {items.map(m => <div key={m.id} onClick={() => setFlipped(flipped === m.id ? null : m.id)} className={`flip h-80 cursor-pointer ${flipped === m.id ? "on" : ""}`}>
        <div className="flip-in relative h-full">
          <div className={`face absolute inset-0 rounded-2xl overflow-hidden bg-white shadow ${recIds.includes(m.id) ? "ring-4 ring-saffron" : ""}`}>
            <img src={m.img} alt={m.name} loading="lazy" className="h-48 w-full object-cover" />
            <div className="p-4"><div className="flex justify-between gap-2"><h3 className="font-serif text-lg font-bold">{m.name}</h3><span className="text-maroon font-bold">₹{m.price}</span></div>
              <p className="text-sm mt-1">{m.veg ? "Vegetarian" : "Non-vegetarian"}</p></div></div>
          <div className="face back absolute inset-0 rounded-2xl bg-maroon text-cream p-6 flex flex-col justify-center">
            <h3 className="font-serif text-xl text-saffron">{m.name}</h3><p className="mt-3 text-sm leading-relaxed">{tr[m.id] || m.desc}</p></div>
        </div></div>)}
    </div></section>;
}

function Gallery() {
  const [i, setI] = useState(0);
  useEffect(() => { const t = setInterval(() => setI(x => (x + 1) % GALLERY.length), 5000); return () => clearInterval(t); }, []);
  const go = d => setI((i + d + GALLERY.length) % GALLERY.length);
  return <section id="gallery" className="bg-maroon py-24 text-cream"><Reveal className="max-w-4xl mx-auto px-5">
    <h2 className="font-serif text-4xl text-saffron mb-8">Gallery</h2>
    <div className="relative rounded-2xl overflow-hidden aspect-[16/10]">
      {GALLERY.map((s, n) => <img key={s} src={s} alt={`Spice of India photo ${n + 1}`} className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${n === i ? "opacity-100" : "opacity-0"}`} />)}
      <button aria-label="Previous" onClick={() => go(-1)} className="absolute left-3 top-1/2 h-10 w-10 rounded-full bg-cream/80 text-ink">‹</button>
      <button aria-label="Next" onClick={() => go(1)} className="absolute right-3 top-1/2 h-10 w-10 rounded-full bg-cream/80 text-ink">›</button>
      <div className="absolute bottom-3 inset-x-0 flex justify-center gap-2">{GALLERY.map((_, n) => <button key={n} aria-label={`Photo ${n + 1}`} onClick={() => setI(n)} className={`h-2.5 w-2.5 rounded-full ${n === i ? "bg-saffron" : "bg-cream/60"}`} />)}</div>
    </div></Reveal></section>;
}

function About() {
  return <section id="about" className="max-w-6xl mx-auto px-5 py-24"><Reveal className="relative">
    <img src={`${IMG}photo-1596797038530-2c107229654b?w=1400`} alt="Our kitchen" className="rounded-2xl h-96 w-full object-cover" />
    <div className="md:absolute md:right-8 md:-bottom-10 md:w-[26rem] mt-4 md:mt-0 rounded-2xl bg-cream border-2 border-gold p-8 shadow-xl">
      <h2 className="font-serif text-3xl text-maroon">Since 1994</h2>
      <p className="mt-3 leading-relaxed">Spice of India began as a six-table dhaba. Today the same family grinds every masala in-house, fires the tandoor at noon and serves nothing that was cooked yesterday.</p></div></Reveal></section>;
}

const field = "w-full rounded-lg border border-gold/60 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-saffron";
function Reserve({ notify }) {
  const [f, setF] = useState({ name: "", phone: "", day: "", time: "19:00", guests: 2, notes: "" }), [err, setErr] = useState({}), [done, setDone] = useState("");
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const check = () => {
    const e = {}; if (f.name.trim().length < 2) e.name = "Enter your name.";
    if (!/^\+?[0-9]{10,13}$/.test(f.phone)) e.phone = "Enter 10–13 digits, e.g. 9876543210.";
    if (!f.day || new Date(f.day) < new Date(new Date().toDateString())) e.day = "Pick today or a later date.";
    if (f.guests < 1 || f.guests > 12) e.guests = "We seat 1–12 guests online."; return e;
  };
  const submit = async ev => {
    ev.preventDefault(); const e = check(); setErr(e); if (Object.keys(e).length) return;
    try { const r = await api("/reserve", { ...f, guests: +f.guests }); setDone(r.message || "Please check the details and try again."); notify(r.message); }
    catch { setDone("We couldn't reach the server. Please try again."); }
  };
  const E = ({ k }) => err[k] ? <p className="text-sm text-red-700 mt-1">{err[k]}</p> : null;
  return <section id="reserve" className="bg-saffron/15 py-24"><Reveal className="max-w-xl mx-auto px-5">
    <h2 className="font-serif text-4xl text-maroon">Reserve a table</h2>
    <form onSubmit={submit} noValidate className="mt-6 grid gap-4">
      <label>Name<input className={field} value={f.name} onChange={set("name")} /><E k="name" /></label>
      <label>Phone<input className={field} inputMode="tel" value={f.phone} onChange={set("phone")} /><E k="phone" /></label>
      <div className="grid grid-cols-3 gap-3">
        <label className="col-span-2">Date<input type="date" className={field} value={f.day} onChange={set("day")} /><E k="day" /></label>
        <label>Time<select className={field} value={f.time} onChange={set("time")}>{["12:00", "13:30", "18:30", "19:00", "20:30", "21:30"].map(t => <option key={t}>{t}</option>)}</select></label></div>
      <label>Guests<input type="number" min="1" max="12" className={field} value={f.guests} onChange={set("guests")} /><E k="guests" /></label>
      <label>Anything we should know?<textarea className={field} rows="2" value={f.notes} onChange={set("notes")} /></label>
      <button className={`${btn} bg-maroon text-cream`}>Book table</button>
    </form>
    {done && <p role="status" className="mt-5 rounded-2xl bg-white p-4 border border-gold">{done}</p>}</Reveal></section>;
}

function Contact() {
  const [rating, setRating] = useState(5), [text, setText] = useState(""), [sum, setSum] = useState(null), [msg, setMsg] = useState("");
  const send = async e => { e.preventDefault(); if (text.trim().length < 3) return setMsg("Write at least a few words."); await api("/feedback", { rating, text }); setText(""); setMsg("Thank you for your review."); setSum(await api("/feedback/summary")); };
  return <section id="contact" className="max-w-6xl mx-auto px-5 py-24 grid md:grid-cols-2 gap-10"><Reveal>
    <h2 className="font-serif text-4xl text-maroon">Visit and review</h2>
    <p className="mt-3">Connaught Place, New Delhi · +91 98765 43210 · hello@spiceofindia.example</p>
    <form onSubmit={send} className="mt-6 grid gap-3">
      <label>Rating<select className={field} value={rating} onChange={e => setRating(+e.target.value)}>{[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} of 5</option>)}</select></label>
      <label>Your review<textarea className={field} rows="3" value={text} onChange={e => setText(e.target.value)} /></label>
      <button className={`${btn} bg-maroon text-cream`}>Send review</button></form>
    {msg && <p className="mt-3 text-sm">{msg}</p>}
    {sum && <p className="mt-3 rounded-2xl bg-white p-4 border border-gold text-sm"><b>Guests say ({sum.average}/5):</b> {sum.summary}</p>}</Reveal>
    <Reveal><iframe title="Map" className="w-full h-96 rounded-2xl border-0" loading="lazy" src="https://maps.google.com/maps?q=Connaught+Place+New+Delhi&output=embed" /></Reveal></section>;
}

const SR_LANG = { en: "en-IN", hi: "hi-IN", pa: "pa-IN" };
function Chat({ msgs, setMsgs, lang }) {
  const [open, setOpen] = useState(false), [text, setText] = useState(""), [busy, setBusy] = useState(false), end = useRef();
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth" }), [msgs, open]);
  const send = async t => {
    if (!t.trim()) return; const next = [...msgs, { role: "user", content: t }]; setMsgs(next); setText(""); setBusy(true);
    try { const r = await api("/chat", { messages: next.slice(-10) }); setMsgs([...next, { role: "assistant", content: r.reply }]); }
    catch { setMsgs([...next, { role: "assistant", content: "I can't reach the kitchen right now. Please try again shortly." }]); }
    setBusy(false);
  };
  const listen = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) return alert("Voice input needs Chrome or Edge.");
    const r = new SR(); r.lang = SR_LANG[lang]; r.onresult = e => send(e.results[0][0].transcript); r.start();
  };
  return <>
    <button onClick={() => setOpen(!open)} aria-label="Chat" className="fixed bottom-5 right-5 z-40 h-14 w-14 rounded-full bg-saffron text-ink text-2xl shadow-lg">{open ? "×" : "💬"}</button>
    {open && <div className="fixed bottom-24 right-5 z-40 w-[min(22rem,calc(100vw-2.5rem))] h-[28rem] flex flex-col rounded-2xl bg-cream border-2 border-gold shadow-2xl">
      <div className="bg-maroon text-cream rounded-t-xl px-4 py-3 font-serif">Ask Spice of India</div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 text-sm">
        {msgs.map((m, i) => <div key={i} className={`max-w-[85%] rounded-2xl px-3 py-2 ${m.role === "user" ? "ml-auto bg-saffron/40" : "bg-white"}`}>{m.content}</div>)}
        {busy && <div className="text-ink/60">Typing…</div>}<div ref={end} /></div>
      <form onSubmit={e => { e.preventDefault(); send(text); }} className="flex gap-2 p-3 border-t border-gold/40">
        <input value={text} onChange={e => setText(e.target.value)} placeholder="Menu, timings, bookings…" className="flex-1 rounded-full border border-gold px-3 py-2 bg-white min-w-0" />
        <button type="button" onClick={listen} aria-label="Speak" className="h-10 w-10 rounded-full bg-maroon text-cream">🎤</button></form>
    </div>}</>;
}

function Site() {
  const [lang, setLang] = useState("en");
  const [msgs, setMsgs] = useState([{ role: "assistant", content: "Namaste! Ask me about the menu, timings or tables. You can also tap the mic." }]);
  const notify = m => m && setMsgs(x => [...x, { role: "assistant", content: m }]);
  return <><Nav /><Hero /><Menu lang={lang} setLang={setLang} /><Gallery /><About /><Reserve notify={notify} /><Contact />
    <footer className="bg-ink text-cream/70 text-center py-8 text-sm">© Spice of India</footer><Chat msgs={msgs} setMsgs={setMsgs} lang={lang} /></>;
}

export default function App() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => { const h = () => setHash(location.hash); addEventListener("hashchange", h); return () => removeEventListener("hashchange", h); }, []);
  return hash === "#/admin" ? <Admin /> : <Site />;
}
