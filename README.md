# BillUp – Control Panel

Healthcare agency billing control panel with EDI (837 & 277) processing, monitoring, and Google Sheets integration.

---

## How to Run the Application

Follow these steps in order.

### 1. Create a PostgreSQL database

- Install PostgreSQL if needed (e.g. [Postgres.app](https://postgresapp.com/) on macOS, or official installer).
- Create a database and user, for example:

  ```bash
  # Using psql (adjust for your setup)
  createdb billup
  # Or in psql:
  CREATE USER your_user WITH PASSWORD 'your_password';
  CREATE DATABASE billup OWNER your_user;
  ```

- Note the connection details: host, port (usually `5432`), database name, user, password.  
  You will use them in `DATABASE_URL` in the backend `.env` file.

### 2. Start Redis

The backend requires Redis (for background tasks and caching).

**macOS (Homebrew):**

```bash
brew services start redis
```

**Linux (systemd):**

```bash
sudo systemctl start redis
```

**Verify Redis is running:**

```bash
redis-cli ping
# Should respond: PONG
```

### 3. Backend setup

1. **Go to the backend folder:**

   ```bash
   cd backend
   ```

2. **Create the `.env` file from the example:**

   ```bash
   cp .env.example .env
   ```

3. **Edit `.env`** and set at least:
   - `DATABASE_URL=postgresql://user:password@localhost:5432/billup` (use your DB name, user, password).
   - `SECRET_KEY` – generate one, e.g. `python -c "import secrets; print(secrets.token_urlsafe(32))"`.
   - Leave or set `REDIS_HOST=localhost`, `REDIS_PORT=6379` if Redis is local.

4. **Create a Python virtual environment:**

   ```bash
   python3 -m venv venv
   ```

5. **Activate the virtual environment:**

   **macOS/Linux:**

   ```bash
   source venv/bin/activate
   ```

   **Windows (Command Prompt):**

   ```cmd
   venv\Scripts\activate.bat
   ```

   **Windows (PowerShell):**

   ```powershell
   venv\Scripts\Activate.ps1
   ```

6. **Install backend dependencies:**

   ```bash
   pip install -r requirements.txt
   ```

### 4. Initialize the database

The backend **automatically** creates tables and a default admin user the **first time** you start it (see “Run the backend” below), as long as `DATABASE_URL` in `.env` is correct.

- No need to run a separate “init” script for a fresh install.
- Default admin (if none exists) is set from `ADMIN_USERNAME` and `ADMIN_PASSWORD` in `.env` (defaults: `admin` / `admin` – change in production).

If you use **Alembic** for migrations on an existing DB, run:

```bash
# From backend folder, with venv activated
alembic upgrade head
```

### 5. Frontend setup (second terminal)

1. **Open a new terminal** and go to the frontend folder:

   ```bash
   cd frontend
   ```

2. **Install frontend dependencies:**

   ```bash
   npm install
   ```

3. **Optional – point frontend to local backend:**  
   Create `frontend/.env.local` with:

   ```
   NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
   ```

4. **Start the frontend dev server:**

   ```bash
   npm run dev
   ```

   The app will usually be at **http://localhost:3000**.

### 6. Run the backend (first terminal)

1. In the terminal where you set up the backend, **go to the backend folder** and **activate the virtual environment** if it’s not active:

   ```bash
   cd backend
   source venv/bin/activate   # or Windows equivalent
   ```

2. **Start the backend:**

   ```bash
   python3 -m uvicorn app.main:app --reload
   ```

   The API will be at **http://localhost:8000**.  
   On first run, the app will:
   - Create database tables (if they don’t exist).
   - Create a default admin user (if none exists).
   - Initialize encryption keys and verify Redis.

3. **Open the frontend** in your browser (e.g. http://localhost:3000) and log in with the admin credentials you set in `.env` (or the defaults).

---

## Summary checklist

| Step | Where | Action |
|------|--------|--------|
| 1 | System | Create PostgreSQL database; note connection details |
| 2 | System | Start Redis (`brew services start redis` or equivalent) |
| 3 | `backend/` | `cp .env.example .env` and edit `DATABASE_URL`, `SECRET_KEY`, Redis |
| 4 | `backend/` | `python3 -m venv venv` then activate (`source venv/bin/activate`) |
| 5 | `backend/` | `pip install -r requirements.txt` |
| 6 | `frontend/` (new terminal) | `npm install` then `npm run dev` |
| 7 | `backend/` | `python3 -m uvicorn app.main:app --reload` |
| 8 | Browser | Open http://localhost:3000 and log in |

Database tables and default admin are created automatically when the backend starts for the first time with a valid `DATABASE_URL`.

---

## HIPAA Compliance & Security

BillUp is designed with HIPAA and healthcare data security in mind.

### Application-wide security

- **Encryption at rest:** PHI and sensitive data (EDI contents, task parameters, patient data, agency credentials, Google tokens) are encrypted in the database using **AES-256-GCM** and field-level encryption before storage.
- **Authentication:** API routes (except login and a few public endpoints) require a valid **JWT Bearer token**; the 277 and 837 upload endpoints are protected.
- **Security headers:** The backend sends HSTS, X-Content-Type-Options, X-Frame-Options, CSP, and related headers to harden the browser and API.
- **Logging:** Logs avoid ePHI; only error types or non-PHI context are logged to reduce risk of exposing patient data.
- **Encryption key management:** Encryption keys are managed via a dedicated key layer (e.g. tenant keys / KMS) and are initialized at startup for HIPAA-aligned data protection.

### 277 format – security and HIPAA alignment

The **277 (claim status response)** flow is built to be secure and compliant:

- **Same strong encryption as 837:** 277 EDI files and parsed patient/claim data are encrypted with the **same PHI encryption service** as 837 (AES-256-GCM, field-level) before being stored. No PHI from 277 is stored in plaintext.
- **277-specific validation:** 277 uploads use a **dedicated 277 validator** (e.g. ISA, IEA, ST*277) so only valid 277 transactions are accepted, reducing malformed or wrong-format data in the system.
- **Authenticated access only:** The 277 upload API is **not** in the public endpoints list; it requires a valid logged-in user (JWT). Only authenticated users can submit or access 277 data.
- **Controlled batch size:** 277 uploads are limited by a configurable maximum files per request (e.g. via `MAX_277_FILES_PER_REQUEST`), which helps avoid timeouts and supports safe, auditable processing.
- **No PHI in responses:** Success and error responses from the 277 API are designed to avoid including raw EDI or patient identifiers in logs or client messages.

Together, these measures help keep 277 data **secure, encrypted, and handled in a HIPAA-conscious manner** across storage, access, and processing.

---

## Project structure (high level)

- **`backend/`** – FastAPI app, EDI processing (837 & 277), encryption, Redis, workers.
- **`frontend/`** – Next.js control panel (837 Files and 277 Files: Dashboard + Upload EOB).
- **`extraction/`** – Standalone 277 extraction logic (reference); backend uses its own copy under `app/utils/`.

For a detailed list of changes (277 API, 837 rename, frontend, security), see **`CHANGELOG_277_837_AND_UPDATES.md`**.
