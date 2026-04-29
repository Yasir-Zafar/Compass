"""
main.py
────────────────────────────────────────────────────────────────────────────
FastAPI backend for Multimodal ASD Detection.

Endpoints:
  GET  /health          → liveness check
  GET  /model-info      → model metadata (CV scores, SHAP importance)
  POST /predict         → SSE stream of per-modality + fusion results

Run locally:
  uvicorn main:app --reload --port 8000

Expected project layout:
  backend/
  ├── main.py
  ├── predictor.py
  ├── feature_extractors.py      ← copied from Kaggle output
  └── models/
      ├── model_physio.pkl
      ├── model_motion.pkl
      ├── model_voice.pkl
      ├── model_image.pkl
      ├── model_meta.pkl
      ├── meta_scaler.pkl
      ├── label_encoder.pkl
      └── feature_config.json
"""

import json
import asyncio
from pathlib import Path

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from predictor import registry, predict_stream

# ── App setup ─────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Multimodal ASD Detection API",
    description="Late-fusion ensemble across physiological, motion, voice, and image modalities.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten this in production
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Startup: pre-load models ──────────────────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    registry.load()


# ── Endpoints ─────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "models_loaded": registry.loaded}


@app.get("/model-info")
async def model_info():
    """Return training metadata for display in the frontend."""
    registry.load()
    return {
        "label_order":    registry.label_order,
        "modality_names": registry.modality_names,
        "cv_scores":      registry.cv_scores,
        "shap_importance": registry.shap_importance,
    }


@app.post("/predict")
async def predict(
    physio: UploadFile = File(..., description="CSV file with HR, GSR, TEMP columns"),
    motion: UploadFile = File(..., description="JSON file with 3D joint data"),
    voice:  UploadFile = File(..., description="WAV audio recording"),
    image:  UploadFile = File(..., description="JPG/PNG facial photograph"),
):
    """
    Stream prediction results via Server-Sent Events.

    Each SSE message is a JSON object.  Event types:
      - processing  → modality analysis has started
      - modality    → per-modality result ready
      - error       → a modality failed (fusion still proceeds)
      - fusion      → final combined result (last message)

    The stream ends after the fusion event.
    """
    # Read all files upfront (UploadFile is not pickle-safe)
    try:
        physio_bytes = await physio.read()
        motion_bytes = await motion.read()
        voice_bytes  = await voice.read()
        image_bytes  = await image.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"File read error: {e}")

    # Validate sizes (rough sanity check)
    MAX_MB = 50
    for name, data in [("physio", physio_bytes), ("motion", motion_bytes),
                       ("voice",  voice_bytes),  ("image",  image_bytes)]:
        if len(data) > MAX_MB * 1024 * 1024:
            raise HTTPException(
                status_code=413,
                detail=f"{name} file exceeds {MAX_MB} MB limit"
            )
        if len(data) == 0:
            raise HTTPException(
                status_code=400,
                detail=f"{name} file is empty"
            )

    async def event_generator():
        try:
            async for result in predict_stream(
                physio_bytes, motion_bytes, voice_bytes, image_bytes
            ):
                # SSE format: "data: <json>\n\n"
                yield f"data: {json.dumps(result)}\n\n"
                await asyncio.sleep(0)  # flush to client
        except Exception as e:
            error_event = {"event": "error", "modality": "server", "message": str(e)}
            yield f"data: {json.dumps(error_event)}\n\n"
        finally:
            # Signal end of stream
            yield "data: {\"event\": \"done\"}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # important for nginx proxies
        },
    )


# ── Dev entrypoint ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
