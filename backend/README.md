# Setup on Windows Python 3.13


## Prerequisites
- Python 3.13 installed
- PostgreSQL installed and running (or use SQLite by default if configured)

## Installation & Running

1. **Navigate to the backend directory**
   ```cmd
   cd backend
   ```

2. **Create a virtual environment and activate it**
   ```cmd
   python -m venv .venv
   .venv\Scripts\activate
   ```

3. **Install dependencies**
   ```cmd
   pip install -r requirements.txt
   ```

4. **Set up Environment Variables**
   ```cmd
   copy .env.example .env
   ```
   Edit `.env` and configure your `DATABASE_URL` and `SECRET_KEY`.

5. **Initialize Database**
   ```cmd
   python -c "import asyncio; from db.database import init_db; asyncio.run(init_db())"
   ```

6. **Seed Initial Data**
   ```cmd
   python seed.py
   ```

7. **Start the API Server**
   ```cmd
   python main.py
   ```
   The API will be available at `http://localhost:8000`. You can view the Swagger docs at `http://localhost:8000/docs`.
