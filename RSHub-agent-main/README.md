## RSHub Agent Backend API

Lightweight FastAPI backend for RSHub web application.

### Quick Start

**Install dependencies:**
```bash
uv sync
```

**Configure environment:**
```bash
cp env_example.txt .env
# Edit .env with your configuration
```

**Run server:**
```bash
uv run start.py
```

Server runs on `http://localhost:8000`
- API docs: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### API Endpoints

**Tasks** (`/api/tasks`):
- `POST /submit` - Submit computational task
- `GET /check?token={token}&project={project}&task={task}` - Check task status
- `GET /download?project={project}&task={task}` - Get download URL

**Credits** (`/api/credits`):
- `GET /` - Query credit balance (requires Authorization header)

**Agent** (`/api/agent`) - Phase 2:
- `POST /chat` - Agent conversation (not implemented)
- `POST /chat/upload` - Chat with file upload (not implemented)

### Project Structure

```
app/
├── main.py          # FastAPI app
├── config.py        # Configuration
├── routers/         # API routes
├── services/        # Business logic
├── models/          # Pydantic schemas
└── prompts/         # Jinja2 templates & data
```

### Development

**Check linting:**
```bash
uv run pytest
```

**Environment variables:**
See `.env.example` for all available options.
