# IntelliInvoice AI

AI-powered invoice processing platform. Upload invoice PDFs or images and the system automatically extracts data, validates it, detects fraud, and routes for approval.

---

## Problem

Finance teams manually process thousands of invoices every month. This causes human errors, duplicate payments, invoice fraud, slow approvals, and poor visibility into spend.

## Solution

A full-stack platform that handles the entire invoice lifecycle automatically:

1. Upload PDF or image invoices (single or bulk)
2. OCR extracts raw text (PaddleOCR + PyMuPDF)
3. Qwen LLM structures the data into JSON
4. Validation engine checks fields, dates, amounts, and GSTIN
5. Fraud detection screens for duplicates and anomalies
6. Approval routing sends invoices to the right approver based on amount
7. Dashboard and analytics give real-time visibility

---

## Architecture

```
React Frontend (Vite + TypeScript + Tailwind)
          |
FastAPI Backend (async Python 3.11)
          |
  Invoice Workflow Pipeline
          |
  OCR Agent -> Extraction Agent -> Validation Agent -> Fraud Agent -> Approval Agent
          |
  PostgreSQL   MinIO   Redis   Ollama (Qwen 2.5)
```

---

## Tech Stack

**Backend**
- Python 3.11, FastAPI, SQLAlchemy 2.0 (async), asyncpg
- PostgreSQL (database), MinIO (file storage), Redis (caching)
- PaddleOCR + PyMuPDF (text extraction)
- Qwen 2.5:7b via Ollama (LLM, runs locally, no API key needed)
- JWT authentication, bcrypt password hashing

**Frontend**
- React 18, TypeScript, Vite
- Tailwind CSS, TanStack Query, Zustand
- React Hook Form + Zod validation
- Recharts (charts), react-dropzone (file upload)

---

## Project Structure

```
intelliinvoice-ai/
├── backend/
│   ├── app/
│   │   ├── agents/          5 AI pipeline agents
│   │   ├── api/routes/      auth, invoice, approval, dashboard endpoints
│   │   ├── core/            config, logging, security (JWT + bcrypt)
│   │   ├── database/        async SQLAlchemy session
│   │   ├── models/          User, Invoice, AuditLog
│   │   ├── schemas/         Pydantic v2 request/response schemas
│   │   ├── services/        MinIO storage service
│   │   ├── workflows/       5-step async pipeline orchestrator
│   │   └── main.py          FastAPI app with middleware and lifespan
│   ├── config.json          All hardcoded config values (local dev)
│   ├── config.docker.json   Config for Docker (container hostnames)
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/           Login, Register, Dashboard, Upload, Invoices, Approvals, Analytics
│   │   ├── layouts/         Sidebar layout with role-based navigation
│   │   ├── components/ui/   Reusable components (Spinner, Modal, StatusBadge, etc.)
│   │   ├── services/        Typed Axios API client
│   │   ├── store/           Zustand auth store with localStorage persistence
│   │   ├── types/           TypeScript interfaces matching backend schemas
│   │   ├── utils/           Currency, date, status formatters
│   │   └── hooks/           useDebounce, usePageTitle
│   ├── nginx.conf           SPA routing + /api proxy + security headers
│   ├── Dockerfile           Multi-stage Node build to nginx
│   └── package.json
├── docker-compose.yml
└── README.md
```

---

## Quick Start with Docker

The easiest way to run the full stack.

**Prerequisites:** Docker and Docker Compose installed.

```bash
# 1. Clone the project
git clone <repo-url>
cd intelliinvoice-ai

# 2. Start all services
docker compose up -d --build

# 3. Pull the Qwen model into Ollama (one time, ~4.7 GB)
docker exec -it intelliinvoice-ollama ollama pull qwen2.5:7b

# 4. Open the app
#    Frontend:       http://localhost:3000
#    API docs:       http://localhost:8000/api/docs
#    MinIO console:  http://localhost:9001
#                    Login: minioadmin / minioadmin123
```

Register at http://localhost:3000/register and start uploading invoices.

---

## Quick Start for Local Development

Run backend and frontend separately without Docker.

**Prerequisites:** Python 3.11, Node.js 20, PostgreSQL, MinIO, Ollama

**Backend**

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Make sure PostgreSQL is running with:
#   database: intelliinvoice
#   user:     invoice_user
#   password: invoice_secure_pass_2024

# Make sure MinIO is running on localhost:9000

# Pull and start the LLM model
ollama pull qwen2.5:7b
ollama serve

# Start backend
uvicorn app.main:app --reload --port 8000

# API docs: http://localhost:8000/api/docs
```

**Frontend**

```bash
cd frontend
npm install
npm run dev

# App: http://localhost:5173
# Proxy: /api requests automatically forwarded to localhost:8000
```

---

## Configuration

All settings live in `backend/config.json`. No environment variables are needed for development.

| Section | What it controls |
|---------|-----------------|
| `database` | PostgreSQL host, port, name, user, password, pool size |
| `minio` | Endpoint, credentials, bucket names, presigned URL expiry |
| `jwt` | Secret key, algorithm, access token expiry (60 min), refresh expiry (7 days) |
| `llm` | Ollama URL, model name, temperature, timeout |
| `fraud_detection` | Duplicate window (90 days), Z-score threshold (3.0 std dev), suspicious amount |
| `approval_workflow` | Auto-approve below 1,000 INR, Finance User up to 10,000, Manager up to 50,000 |
| `file_upload` | Max file size (50 MB), allowed types, max bulk files (20) |
| `logging` | Log level, file path, rotation settings |

For production, change `jwt.secret_key`, database password, and MinIO credentials.

`config.docker.json` is identical but uses container hostnames (`postgres`, `minio`, `ollama`) instead of `localhost`. It is mounted into the backend container automatically by docker-compose.

---

## API Reference

All routes are prefixed with `/api/v1`. Interactive Swagger docs are at `/api/docs`.

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /auth/register | Create account, returns JWT tokens |
| POST | /auth/login | Authenticate, returns JWT tokens |
| GET | /auth/me | Current user profile |

### Invoices
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /invoice/upload | Upload one invoice, starts AI pipeline in background |
| POST | /invoice/upload/bulk | Upload up to 20 invoices at once |
| GET | /invoice/list | Paginated list, filter by status and vendor |
| GET | /invoice/{id} | Full invoice detail with all extracted data |
| GET | /invoice/{id}/download-url | Presigned MinIO URL (expires 1 hour) |
| PUT | /invoice/{id} | Edit extracted fields before approval |
| DELETE | /invoice/{id} | Delete invoice (admin and finance head only) |

### Approval
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /approval/approve/{id} | Approve invoice |
| POST | /approval/reject/{id} | Reject invoice with mandatory reason |
| GET | /approval/pending | Queue of invoices waiting for current user's role |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /dashboard/stats | KPIs, status breakdown, trends, top vendors |
| GET | /dashboard/analytics | Monthly trends, vendor breakdown, status distribution |

---

## Roles and Permissions

| Role | Upload | View | Approve Up To | Delete |
|------|--------|------|---------------|--------|
| Admin | Yes | All invoices | Any amount | Yes |
| Finance User | Yes | Own invoices only | 10,000 INR | No |
| Manager | Yes | All invoices | 50,000 INR | No |
| Finance Head | Yes | All invoices | Any amount | Yes |
| Auditor | No | All invoices | None | No |

---

## Invoice Processing Pipeline

```
Uploaded
   |
Processing  <-- OCR (PaddleOCR / PyMuPDF)
   |
Extracted   <-- LLM Extraction (Qwen 2.5)
   |
Validation  <-- Rule engine (fields, dates, GSTIN, amounts)
   |
   +-- Validation Failed --> (manual review / reject)
   |
Fraud Check <-- Duplicate detection + amount anomaly
   |
   +-- Fraud Detected --> (manual review / reject)
   |
Approval Routing
   |
   +-- Amount < 1,000 INR  --> Auto Approved
   +-- Amount < 10,000 INR --> Finance User queue
   +-- Amount < 50,000 INR --> Manager queue
   +-- Amount > 50,000 INR --> Finance Head queue
   |
Approved / Rejected
```

---

## Security

- JWT access tokens (60 minutes) with refresh tokens (7 days)
- Passwords hashed with bcrypt, minimum 8 characters, requires uppercase and digit
- Role-based access control enforced on every API endpoint
- Complete audit log for every login, upload, approval, and rejection with user ID and IP
- Presigned URLs for file downloads so MinIO credentials never reach the browser
- File type and size validation before any processing begins
- CORS restricted to configured origins
- Nginx security headers: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection

---

## Services in Docker Compose

| Service | Port | Purpose |
|---------|------|---------|
| postgres | 5432 | Primary database |
| redis | 6379 | Cache |
| minio | 9000 / 9001 | Object storage / web console |
| ollama | 11434 | Local LLM server |
| backend | 8000 | FastAPI application |
| frontend | 3000 | React app served by nginx |

All services restart automatically unless stopped. The backend waits for postgres and redis to be healthy before starting.
