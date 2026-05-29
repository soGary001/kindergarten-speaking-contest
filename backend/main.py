from fastapi import FastAPI

app = FastAPI(title="Kindergarten Speaking Contest")


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok"}
