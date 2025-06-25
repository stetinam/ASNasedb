from fastapi import FastAPI

# Create an instance of FastAPI
app = FastAPI()

# Define a route for the GET request
@app.get("/api/blast")
async def blast(query, targetDB = 'xx', eThreshold = 10, matrix = 'Auto - BLOSUM62', hits = 250):

    response = {
        "message": "Request successfully processed.",
	"bla": eThreshold * hits
    }
    return response

