FROM python:3.11-slim-buster

# Update the package list and install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /src

# Copy requirements.txt and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Set up environment vars
ENV PYTHONUNBUFFERED=True
ENV DATA_HOME=/data
# ENV APP_HOME=/src/app

# Copy the application code
COPY ./app ./app

# Expose the port that Uvicorn will listen on
EXPOSE 8080

# Run the FastAPI application using Uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
