from fastapi import FastAPI, HTTPException, Request, Response
from pydantic import BaseModel
import subprocess
import logging
import tempfile
import time
from pathlib import Path

app = FastAPI()
safe_access_logger = logging.getLogger("uvicorn.error")

ALLOWED_DBS = {"asparaginasedb", "asparaginasedb_esp", "asparaginasedb_sp"}
MAX_QUERY_LENGTH = 1_000_000


@app.middleware("http")
async def log_request_without_query_string(request: Request, call_next):
    """Retain operational request logs without recording sequences or URLs."""
    started = time.monotonic()
    response = await call_next(request)
    duration_ms = (time.monotonic() - started) * 1000
    safe_access_logger.info(
        '%s %s %s %.0fms',
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


class BlastRequest(BaseModel):
    query: str
    targetDB: str
    eThreshold: str = "0.001"
    hits: str = "250"
    matrix: str = "BLOSUM62"
    outfmt: str = "0"


@app.post("/api/blast")
async def blast(request: BlastRequest, response: Response):
    if request.targetDB not in ALLOWED_DBS:
        raise HTTPException(status_code=400, detail="Invalid database")
    if not request.query or len(request.query) > MAX_QUERY_LENGTH:
        raise HTTPException(status_code=400, detail="Invalid query sequence")

    response.headers["Cache-Control"] = "no-store"

    with tempfile.TemporaryDirectory(prefix="blast-") as temp_dir:
        query_path = Path(temp_dir) / "query.fasta"
        output_path = Path(temp_dir) / "result.out"
        query_path.write_text(request.query)

        try:
            result = subprocess.run(
                ["blastp",
                    "-query", str(query_path),
                    "-db", f"/blast/{request.targetDB}",
                    "-evalue", request.eThreshold,
                    "-max_target_seqs", request.hits,
                    "-matrix", request.matrix,
                    "-outfmt", request.outfmt,
                    "-out", str(output_path)
                ],
                cwd='/blast',
                capture_output=True,
                text=True,
                check=True
            )

            out = output_path.read_text()

            return {
                "stdout": result.stdout,
                "stderr": result.stderr,
                "output": out,
                "returncode": result.returncode
            }

        except subprocess.CalledProcessError as e:
            safe_access_logger.error(
                "BLAST process failed with exit status %s", e.returncode
            )

            raise HTTPException(status_code=500, detail="Blast execution failed.")

        except Exception:
            safe_access_logger.error("Unexpected BLAST processing failure")
            raise HTTPException(status_code=500, detail="An unexpected error occurred.")
