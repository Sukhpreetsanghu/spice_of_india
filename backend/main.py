import os, secrets, sqlite3, httpx
import chromadb
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

load_dotenv()
OLLAMA = os.getenv("OLLAMA_URL", "http://localhost:11434")
MODEL = os.getenv("LLM_MODEL", "llama3.2:latest")
EMBED = os.getenv("EMBED_MODEL", MODEL)
DB, SEATS_PER_SLOT = "spice.db", int(os.getenv("SEATS_PER_SLOT", 40))
HOURS = "Open daily 12:00-15:00 and 18:30-23:00."
U = "https://images.unsplash.com/"
SEED = [  # first-run menu; after that the menu lives in the SQLite `menu` table
 dict(id="1", name="Butter Chicken", price=449, veg=False, img=U+"photo-1603894584373-5ac82b2ae398?w=600", desc="Tandoori chicken in a silky tomato-butter gravy with kasuri methi."),
 dict(id="2", name="Paneer Tikka", price=349, veg=True, img=U+"photo-1567188040759-fb8a883dc6d8?w=600", desc="Char-grilled cottage cheese marinated in yogurt, ajwain and mustard oil."),
 dict(id="3", name="Sarson da Saag", price=329, veg=True, img=U+"photo-1585937421612-70a008356fbe?w=600", desc="Slow-cooked mustard greens with white butter and makki di roti."),
 dict(id="4", name="Hyderabadi Biryani", price=429, veg=False, img=U+"photo-1563379091339-03b21ab4a4f8?w=600", desc="Dum-sealed basmati layered with spiced lamb, saffron and fried onions."),
 dict(id="5", name="Dal Makhani", price=299, veg=True, img=U+"photo-1546833998-877b37c2e5c6?w=600", desc="Black lentils simmered overnight with cream and smoked butter."),
 dict(id="6", name="Amritsari Kulcha", price=189, veg=True, img=U+"photo-1601050690597-df0568f70950?w=600", desc="Tandoor-baked bread stuffed with spiced potato, served with chole."),
 dict(id="7", name="Rogan Josh", price=469, veg=False, img=U+"photo-1545247181-516773cae754?w=600", desc="Kashmiri lamb braised with fennel, ginger and mild red chilli."),
 dict(id="8", name="Gulab Jamun", price=149, veg=True, img=U+"photo-1666190092159-3171cf0fbb12?w=600", desc="Warm milk-solid dumplings in cardamom-rose syrup."),
]
LANGS = {"pa": "Punjabi (Gurmukhi)", "hi": "Hindi (Devanagari)", "en": "English"}
collection = None  # ChromaDB collection, filled at startup

async def llm(messages, temperature=0.5):
    async with httpx.AsyncClient(timeout=120) as c:
        r = await c.post(f"{OLLAMA}/api/chat", json={"model": MODEL, "messages": messages, "stream": False, "options": {"temperature": temperature}})
        r.raise_for_status()
        return r.json()["message"]["content"].strip()

async def embed(text):
    async with httpx.AsyncClient(timeout=120) as c:
        r = await c.post(f"{OLLAMA}/api/embeddings", json={"model": EMBED, "prompt": text})
        r.raise_for_status()
        return r.json()["embedding"]

def db():
    c = sqlite3.connect(DB); c.row_factory = sqlite3.Row; return c

def all_menu():
    with db() as c:
        return [dict(r, veg=bool(r["veg"])) for r in c.execute('SELECT id,name,price,veg,img,description AS "desc" FROM menu ORDER BY id')]

def doc(m): return f'{m["name"]}. {m["desc"]} {"Vegetarian" if m["veg"] else "Non-vegetarian"}.'

async def sync(i):
    """Re-embed one dish into ChromaDB after an admin change."""
    m = next((x for x in all_menu() if x["id"] == i), None)
    if not m or collection is None: return
    try: collection.upsert(ids=[str(i)], documents=[doc(m)], embeddings=[await embed(doc(m))], metadatas=[{"name": m["name"], "veg": m["veg"]}])
    except Exception as e: print("Vector sync skipped:", e)

async def build_index():
    global collection
    client = chromadb.PersistentClient(path=os.getenv("CHROMA_PATH", "chroma_db"))
    collection = client.get_or_create_collection("menu", metadata={"hnsw:space": "cosine"})
    menu = all_menu()
    collection.upsert(ids=[str(m["id"]) for m in menu], documents=[doc(m) for m in menu], embeddings=[await embed(doc(m)) for m in menu],
                      metadatas=[{"name": m["name"], "veg": m["veg"]} for m in menu])
    live = {str(m["id"]) for m in menu}
    stale = [i for i in collection.get()["ids"] if i not in live]
    if stale: collection.delete(ids=stale)

async def search(query, k=3):
    n = min(k, collection.count())
    if n == 0: return []
    res = collection.query(query_embeddings=[await embed(query)], n_results=n)
    menu = all_menu()
    return [m for i in res["ids"][0] for m in menu if str(m["id"]) == i]

@asynccontextmanager
async def lifespan(app):
    with db() as c:
        c.execute("CREATE TABLE IF NOT EXISTS menu(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, price INT, veg INT, img TEXT, description TEXT)")
        if c.execute("SELECT COUNT(*) FROM menu").fetchone()[0] == 0:
            c.executemany("INSERT INTO menu(name,price,veg,img,description) VALUES(?,?,?,?,?)", [(m["name"], m["price"], int(m["veg"]), m["img"], m["desc"]) for m in SEED])
        c.execute("CREATE TABLE IF NOT EXISTS reservations(id INTEGER PRIMARY KEY, name TEXT, phone TEXT, day TEXT, time TEXT, guests INT, notes TEXT)")
        c.execute("CREATE TABLE IF NOT EXISTS closures(id INTEGER PRIMARY KEY, day TEXT, time TEXT)")  # '*' = every date / every time
        c.execute("CREATE TABLE IF NOT EXISTS feedback(id INTEGER PRIMARY KEY, name TEXT, rating INT, text TEXT)")
    try: await build_index()
    except Exception as e: print("Vector index skipped (is Ollama running?):", e)
    yield

app = FastAPI(title="Spice of India", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("CORS", "*").split(","), allow_methods=["*"], allow_headers=["*"])

class Chat(BaseModel): messages: list[dict]
class Rec(BaseModel): query: str = Field(min_length=2, max_length=300)
class Reserve(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    phone: str = Field(pattern=r"^\+?[0-9]{10,13}$")
    day: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    time: str = Field(pattern=r"^\d{2}:\d{2}$")
    guests: int = Field(ge=1, le=12)
    notes: str = ""
class Feedback(BaseModel): name: str = "Guest"; rating: int = Field(ge=1, le=5); text: str = Field(min_length=3, max_length=800)
class Translate(BaseModel): lang: str

@app.get("/api/menu")
def menu(): return all_menu()

@app.post("/api/translate")
async def translate(t: Translate):
    if t.lang not in LANGS: raise HTTPException(400, "lang must be en, hi or pa")
    if t.lang == "en": return {m["id"]: m["desc"] for m in all_menu()}
    return {m["id"]: await llm([{"role": "user", "content": f'Translate into {LANGS[t.lang]}. Reply with the translation only.\n\n{m["desc"]}'}], 0.2) for m in all_menu()}

@app.post("/api/recommend")
async def recommend(r: Rec):
    hits = await search(r.query)
    ctx = "\n".join(f'- {m["name"]} (Rs {m["price"]}): {m["desc"]}' for m in hits)
    why = await llm([{"role": "system", "content": "You are a warm host at Spice of India. In 2 sentences, explain why these dishes suit the guest."}, {"role": "user", "content": f"Guest wants: {r.query}\nDishes:\n{ctx}"}])
    return {"dishes": hits, "message": why}

@app.post("/api/chat")
async def chat(c: Chat):
    last = next((m["content"] for m in reversed(c.messages) if m["role"] == "user"), "")
    hits = await search(last, 4) if collection else all_menu()[:4]
    ctx = "\n".join(f'- {m["name"]} Rs {m["price"]} {"(veg)" if m["veg"] else ""}: {m["desc"]}' for m in hits)
    system = f"You are the concierge of Spice of India, an Indian restaurant. {HOURS} Reservations are made with the Reserve form on this page. Answer briefly, reply in the guest's language, suggest only dishes from the list, never invent prices or offers.\nRelevant dishes:\n{ctx}"
    return {"reply": await llm([{"role": "system", "content": system}, *c.messages[-10:]])}

def is_closed(day, time):
    with db() as c:
        return c.execute("SELECT 1 FROM closures WHERE day IN (?, '*') AND time IN (?, '*')", (day, time)).fetchone() is not None

def booked(day, time):
    with db() as c:
        return c.execute("SELECT COALESCE(SUM(guests),0) FROM reservations WHERE day=? AND time=?", (day, time)).fetchone()[0]

@app.get("/api/availability")
def availability(day: str, time: str):
    closed = is_closed(day, time)
    return {"closed": closed, "seats_left": 0 if closed else SEATS_PER_SLOT - booked(day, time)}

@app.post("/api/reserve")
async def reserve(r: Reserve):
    if is_closed(r.day, r.time):
        return {"ok": False, "message": "Sorry, we are not taking bookings for that time. Please try another slot or call us."}
    left = SEATS_PER_SLOT - booked(r.day, r.time)
    if r.guests > left:
        return {"ok": False, "message": f"Sorry, only {left} seats are left at {r.time} on {r.day}. Could you try another time?"}
    with db() as c:
        c.execute("INSERT INTO reservations(name,phone,day,time,guests,notes) VALUES(?,?,?,?,?,?)", (r.name, r.phone, r.day, r.time, r.guests, r.notes))
    try: msg = await llm([{"role": "user", "content": f"Write a 2-sentence warm booking confirmation for {r.name}, table for {r.guests} on {r.day} at {r.time}, at Spice of India."}])
    except Exception: msg = f"Thank you {r.name}! Table for {r.guests} confirmed on {r.day} at {r.time}."
    return {"ok": True, "message": msg}

@app.post("/api/feedback")
def add_feedback(f: Feedback):
    with db() as c: c.execute("INSERT INTO feedback(name,rating,text) VALUES(?,?,?)", (f.name, f.rating, f.text))
    return {"ok": True}

@app.get("/api/feedback/summary")
async def summary():
    with db() as c: rows = c.execute("SELECT rating,text FROM feedback ORDER BY id DESC LIMIT 30").fetchall()
    if not rows: return {"summary": "No reviews yet.", "average": None}
    joined = "\n".join(f'{r["rating"]}/5: {r["text"]}' for r in rows)
    s = await llm([{"role": "user", "content": f"Summarise these restaurant reviews in 3 sentences: praise, complaints, one suggestion.\n{joined}"}], 0.3)
    return {"summary": s, "average": round(sum(r["rating"] for r in rows) / len(rows), 1)}


# ---------- Admin (menu management) ----------
def admin(x_admin_password: str = Header(default="")):
    pw = os.getenv("ADMIN_PASSWORD")
    if not pw: raise HTTPException(503, "Set ADMIN_PASSWORD in backend/.env to enable the admin page.")
    if not secrets.compare_digest(x_admin_password.encode(), pw.encode()): raise HTTPException(401, "Wrong password.")

class Dish(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    price: int = Field(ge=1, le=100000)
    veg: bool = True
    img: str = Field(default="", max_length=500)
    desc: str = Field(min_length=3, max_length=400)

@app.post("/api/admin/login", dependencies=[Depends(admin)])
def admin_login(): return {"ok": True}

@app.post("/api/admin/menu", dependencies=[Depends(admin)])
async def add_dish(d: Dish):
    with db() as c:
        new_id = c.execute("INSERT INTO menu(name,price,veg,img,description) VALUES(?,?,?,?,?)", (d.name, d.price, int(d.veg), d.img, d.desc)).lastrowid
    await sync(new_id); return {"id": new_id}

@app.put("/api/admin/menu/{dish_id}", dependencies=[Depends(admin)])
async def update_dish(dish_id: int, d: Dish):
    with db() as c:
        n = c.execute("UPDATE menu SET name=?,price=?,veg=?,img=?,description=? WHERE id=?", (d.name, d.price, int(d.veg), d.img, d.desc, dish_id)).rowcount
    if not n: raise HTTPException(404, "Dish not found.")
    await sync(dish_id); return {"ok": True}

@app.delete("/api/admin/menu/{dish_id}", dependencies=[Depends(admin)])
def delete_dish(dish_id: int):
    with db() as c:
        n = c.execute("DELETE FROM menu WHERE id=?", (dish_id,)).rowcount
    if not n: raise HTTPException(404, "Dish not found.")
    if collection is not None:
        try: collection.delete(ids=[str(dish_id)])
        except Exception as e: print("Vector delete skipped:", e)
    return {"ok": True}

@app.get("/api/admin/reservations", dependencies=[Depends(admin)])
def list_reservations():
    with db() as c: return [dict(r) for r in c.execute("SELECT * FROM reservations ORDER BY day, time, id")]

@app.delete("/api/admin/reservations/{rid}", dependencies=[Depends(admin)])
def cancel_reservation(rid: int):
    with db() as c: n = c.execute("DELETE FROM reservations WHERE id=?", (rid,)).rowcount
    if not n: raise HTTPException(404, "Booking not found.")
    return {"ok": True}

class Closure(BaseModel):
    day: str = Field(pattern=r"^(\*|\d{4}-\d{2}-\d{2})$")
    time: str = Field(pattern=r"^(\*|\d{2}:\d{2})$")

@app.get("/api/admin/closures", dependencies=[Depends(admin)])
def list_closures():
    with db() as c: return [dict(r) for r in c.execute("SELECT * FROM closures ORDER BY day, time")]

@app.post("/api/admin/closures", dependencies=[Depends(admin)])
def add_closure(x: Closure):
    with db() as c:
        if not c.execute("SELECT 1 FROM closures WHERE day=? AND time=?", (x.day, x.time)).fetchone():
            c.execute("INSERT INTO closures(day,time) VALUES(?,?)", (x.day, x.time))
    return {"ok": True}

@app.delete("/api/admin/closures/{cid}", dependencies=[Depends(admin)])
def remove_closure(cid: int):
    with db() as c: c.execute("DELETE FROM closures WHERE id=?", (cid,))
    return {"ok": True}
