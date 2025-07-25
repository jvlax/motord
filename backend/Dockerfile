FROM python:3.11-slim

WORKDIR /usr/src/app

# Copy requirements and install dependencies first for better caching
COPY requirements.txt .
RUN pip install -r requirements.txt

# Copy the rest of the application code
COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"] 