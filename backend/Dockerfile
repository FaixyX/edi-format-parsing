FROM python:3.12-slim

# Set work directory
WORKDIR /app

# Create virtual environment
RUN python3 -m venv venv
ENV VIRTUAL_ENV=/app/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Install Python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ app/

# Copy Alembic for migrations
COPY alembic/ alembic/
COPY alembic.ini .

# Expose the port used inside the Fly machine
EXPOSE 8080

# Run FastAPI with uvicorn on port 8080
CMD ["/app/venv/bin/python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
