FROM python:3.11-slim

WORKDIR /app

# Set environment variables for Python
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Install curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Install Semantica without heavy deep-learning dependencies (torch/CUDA)
# followed by core backend requirements and runtime libraries
RUN pip install --no-cache-dir --no-deps semantica && \
    pip install --no-cache-dir --no-deps -r requirements.txt && \
    pip install --no-cache-dir fastapi "uvicorn[standard]" pyoxigraph requests rdflib pydantic httpx pytest

COPY . .

# Expose backend port 8003 as specified in PRD
EXPOSE 8003

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8003/api/health || exit 1

# Start FastAPI application with Uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8003"]
