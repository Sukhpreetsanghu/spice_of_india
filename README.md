# Spice of India

## Run locally
1. Install Ollama, then: `ollama pull llama3.2`  (Ollama serves on :11434)
2. Backend:
   cd backend && python -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt && cp .env.example .env
   uvicorn main:app --reload --port 8000
3. Frontend (new terminal): cd frontend && npm install && npm run dev  -> http://localhost:5173

Vector search: ChromaDB runs inside the backend and saves to backend/chroma_db (no account or server needed). Dishes are embedded with Ollama at startup. If you change EMBED_MODEL, delete the chroma_db folder so it rebuilds with the new vector size.

## Deploy
- Frontend -> Vercel: import /frontend, build `npm run build`, output `dist`. Copy vercel.json.example into /frontend as vercel.json and set your backend URL.
- Backend -> AWS: containerise (uvicorn) on App Runner or EC2, set CORS to your Vercel domain, and point OLLAMA_URL at a GPU/CPU host running Ollama (Lambda cannot run it). Use a mounted volume/EFS or move reservations to RDS, since SQLite files are lost on ephemeral disks.

## Admin page
Open http://localhost:5173/#/admin and sign in with ADMIN_PASSWORD from backend/.env (change the default before deploying, and serve over HTTPS). There you can edit names, prices, descriptions, images and veg/non-veg, add dishes, and remove dishes. The menu is stored in the SQLite `menu` table (seeded from the built-in list on first run), and each change is re-embedded into ChromaDB so recommendations and the chatbot stay current.

### Bookings tab
Shows upcoming reservations (cancel any of them) and lets you close a date/time, all times on a date, or every date. Closed slots reject new bookings; slots also close automatically when SEATS_PER_SLOT is reached.
