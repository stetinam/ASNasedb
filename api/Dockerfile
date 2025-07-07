FROM python:3.13  

RUN apt update && apt install -y ncbi-blast+ vim && apt clean && rm -rf /var/lib/apt/lists/*
 
# Create the app directory
RUN mkdir /app
 
# Set the working directory inside the container
WORKDIR /app
 
# Set environment variables 
# Prevents Python from writing pyc files to disk
ENV PYTHONDONTWRITEBYTECODE=1
#Prevents Python from buffering stdout and stderr
ENV PYTHONUNBUFFERED=1 
 
# Upgrade pip
RUN pip install --upgrade pip 
 
# Copy the Django project  and install dependencies
COPY requirements.txt  /app/
 
# run this command to install all dependencies 
RUN pip install --no-cache-dir -r requirements.txt
 
COPY . /app/
 
# Expose the Django port
EXPOSE 8080
#CMD ["ls", "app"]
CMD ["fastapi", "run", "app/main.py", "--port", "8080"]
