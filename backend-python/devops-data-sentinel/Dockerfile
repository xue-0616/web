# Use the official lightweight Python image for version 3.10.12
FROM python:3.10.12-alpine

# Set the working directory
WORKDIR /app

# Copy the requirements file into the image
COPY requirements.txt .

# Install build dependencies, then install Python packages, and finally remove build dependencies
RUN apk add --no-cache gcc musl-dev libffi-dev \
    && pip install --no-cache-dir -r requirements.txt \
    && apk del gcc musl-dev libffi-dev

# Copy the rest of the application code
COPY . .

# Command to run the application
CMD ["python", "main.py"]
