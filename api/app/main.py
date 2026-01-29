from fastapi import FastAPI, HTTPException
import subprocess
import logging
import uuid
import os

app = FastAPI()

ALLOWED_DBS = {"asparaginasedb", "asparaginasedb_esp", "asparaginasedb_sp"}

@app.get("/api/blast")
async def blast(query, targetDB, eThreshold = "0.001", hits = "250", matrix = "BLOSUM62", outfmt = "0"):
    if targetDB not in ALLOWED_DBS:
        raise HTTPException(status_code=400, detail="Invalid database")

    reqid = uuid.uuid4()
    with open(f"/tmp/{reqid}.fasta","w") as f:
        f.write(query)

    try:
        result = subprocess.run(
            ["blastp",
                "-query", f"/tmp/{reqid}.fasta",
                "-db", f"/blast/{targetDB}",
                "-evalue", eThreshold,
                "-max_target_seqs", hits,
                "-matrix", matrix,
                "-outfmt", outfmt,
                "-out", f"/tmp/{reqid}.out"
            ],
            cwd = '/blast',
            capture_output=True,
            text=True,
            check=True
        )

        with open(f"/tmp/{reqid}.out") as f:
            out = f.read()

        response = {
            "stdout": result.stdout,
            "stderr": result.stderr,
            "output": out,
            "returncode": result.returncode
        }

        return response

    except subprocess.CalledProcessError as e:
        logging.error(f"Command '{e.cmd}' returned non-zero exit status {e.returncode}")
        logging.error(f"stdout: {e.stdout}")
        logging.error(f"stderr: {e.stderr}")

        raise HTTPException(status_code=500, detail="Blast execution failed.")

    except Exception as e:
        logging.error(f"An unexpected error occurred: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred.")

    finally: 
        try:
            os.unlink(f"/tmp/{reqid}.fasta")
            os.unlink(f"/tmp/{reqid}.out")
        except:
            pass

