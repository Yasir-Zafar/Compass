"""
predictor.py
────────────────────────────────────────────────────────────────────────────
Loads all trained models once at startup and exposes a single
async-friendly predict() that returns results modality-by-modality
(as an async generator) so FastAPI can stream them via SSE.

Expected models/ layout:
    models/
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
import tempfile
import os
from pathlib import Path
from typing import AsyncGenerator

import numpy as np
import joblib
import shap

from feature_extractors import (
    extract_physio_features,
    extract_motion_features,
    extract_voice_features,
    extract_image_features,
)

# ── Paths ─────────────────────────────────────────────────────────────────────
MODELS_DIR = Path(__file__).parent / "models"


# ── Model registry (loaded once at startup) ───────────────────────────────────
class ModelRegistry:
    def __init__(self):
        self.loaded = False

    def load(self):
        if self.loaded:
            return
        print("Loading models...", flush=True)

        self.pipe_physio  = joblib.load(MODELS_DIR / "model_physio.pkl")
        self.pipe_motion  = joblib.load(MODELS_DIR / "model_motion.pkl")
        self.pipe_voice   = joblib.load(MODELS_DIR / "model_voice.pkl")
        self.pipe_image   = joblib.load(MODELS_DIR / "model_image.pkl")
        self.meta_scaler  = joblib.load(MODELS_DIR / "meta_scaler.pkl")
        self.meta_clf     = joblib.load(MODELS_DIR / "model_meta.pkl")
        self.label_enc    = joblib.load(MODELS_DIR / "label_encoder.pkl")

        with open(MODELS_DIR / "feature_config.json") as f:
            self.config = json.load(f)

        self.label_order     = self.config["label_order"]
        self.modality_names  = self.config["modality_names"]
        self.shap_importance = self.config["modality_importance_shap"]
        self.cv_scores       = self.config["cv_scores"]

        # Pre-build SHAP explainer for the meta-learner
        # Use a small background dataset (zeros — fine for LinearExplainer)
        n_meta_features = len(self.config["feature_names"]["meta"])
        background      = np.zeros((1, n_meta_features))
        background_scaled = self.meta_scaler.transform(background)
        self.explainer  = shap.LinearExplainer(
            self.meta_clf,
            background_scaled,
            feature_names=self.config["feature_names"]["meta"],
        )

        self.loaded = True
        print("Models loaded ✓", flush=True)


registry = ModelRegistry()


# ── Helper ────────────────────────────────────────────────────────────────────
def _proba_to_dict(proba: np.ndarray, label_order: list) -> dict:
    """Convert a probability array to a {label: probability} dict."""
    return {label: float(p) for label, p in zip(label_order, proba[0])}


def _save_upload(file_bytes: bytes, suffix: str) -> str:
    """Write upload bytes to a temp file and return its path."""
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp.write(file_bytes)
    tmp.close()
    return tmp.name


# ── Core streaming predictor ──────────────────────────────────────────────────
async def predict_stream(
    physio_bytes: bytes,
    motion_bytes: bytes,
    voice_bytes:  bytes,
    image_bytes:  bytes,
) -> AsyncGenerator[dict, None]:
    """
    Async generator that yields one result dict per modality, then a
    final fusion result.  Each dict is JSON-serialisable and has the shape:

    Per-modality event:
    {
        "event":       "modality",
        "modality":    "physio" | "motion" | "voice" | "image",
        "label":       "mild_asd",          # argmax prediction
        "probabilities": {"typical": 0.1, ...},
        "top_feature": "hr_rmssd",          # highest-weight feature for this modality
        "cv_f1":       0.137,               # from training
    }

    Fusion event:
    {
        "event":          "fusion",
        "label":          "mild_asd",
        "probabilities":  {"typical": 0.1, ...},
        "modality_shap":  {"physio": 0.152, "motion": 0.174, ...},
        "confidence":     0.73,             # max probability
    }

    Error event:
    {
        "event":   "error",
        "modality": "physio",
        "message": "...",
    }
    """
    registry.load()

    # Save uploads to temp files
    tmp_physio = _save_upload(physio_bytes, ".csv")
    tmp_motion = _save_upload(motion_bytes, ".json")
    tmp_voice  = _save_upload(voice_bytes,  ".wav")
    tmp_image  = _save_upload(image_bytes,  ".jpg")

    modality_probas = []   # collect for fusion

    modality_tasks = [
        ("physio", tmp_physio, extract_physio_features, registry.pipe_physio),
        ("motion", tmp_motion, extract_motion_features, registry.pipe_motion),
        ("voice",  tmp_voice,  extract_voice_features,  registry.pipe_voice),
        ("image",  tmp_image,  extract_image_features,  registry.pipe_image),
    ]

    for modality, tmp_path, extractor, pipe in modality_tasks:
        # Yield a "processing" heartbeat so the frontend knows we started
        yield {
            "event":    "processing",
            "modality": modality,
        }

        # Small yield to let the event loop breathe
        await asyncio.sleep(0)

        try:
            # Feature extraction (CPU-bound — fine for 100ms ops)
            feat_dict = extractor(tmp_path)
            feat_vec  = np.array(list(feat_dict.values())).reshape(1, -1)

            # Per-modality prediction
            proba = pipe.predict_proba(feat_vec)
            label = registry.label_enc.inverse_transform([np.argmax(proba)])[0]

            # Top feature by model coefficient magnitude
            clf        = pipe.named_steps["clf"]
            scaler     = pipe.named_steps["scaler"]
            feat_names = registry.config["feature_names"][modality]
            coef_mean  = np.mean(np.abs(clf.coef_), axis=0)
            top_feat   = feat_names[int(np.argmax(coef_mean))]

            modality_probas.append(proba)

            yield {
                "event":         "modality",
                "modality":      modality,
                "label":         label,
                "probabilities": _proba_to_dict(proba, registry.label_order),
                "top_feature":   top_feat,
                "cv_f1":         registry.cv_scores[modality]["mean"],
            }

        except Exception as e:
            # Still append zeros so fusion can proceed with remaining modalities
            modality_probas.append(
                np.ones((1, len(registry.label_order))) / len(registry.label_order)
            )
            yield {
                "event":    "error",
                "modality": modality,
                "message":  str(e),
            }

        await asyncio.sleep(0.05)  # brief pause so frontend can animate

    # ── Fusion ────────────────────────────────────────────────────────────────
    try:
        meta_input        = np.hstack(modality_probas)          # (1, 16)
        meta_input_scaled = registry.meta_scaler.transform(meta_input)
        fusion_proba      = registry.meta_clf.predict_proba(meta_input_scaled)
        fusion_label      = registry.label_enc.inverse_transform(
                                [np.argmax(fusion_proba)])[0]

        # SHAP on this specific sample
        shap_vals = registry.explainer.shap_values(meta_input_scaled)

        # Aggregate SHAP per modality
        n_classes = len(registry.label_order)
        sample_modality_shap = {}
        for i, mod in enumerate(registry.modality_names):
            cols = list(range(i * n_classes, (i + 1) * n_classes))
            if isinstance(shap_vals, list):
                imp = float(np.mean([np.abs(shap_vals[c][0, cols]).mean()
                                     for c in range(n_classes)]))
            else:
                imp = float(np.abs(shap_vals[0, cols]).mean())
            sample_modality_shap[mod] = imp

        yield {
            "event":          "fusion",
            "label":          fusion_label,
            "probabilities":  _proba_to_dict(fusion_proba, registry.label_order),
            "modality_shap":  sample_modality_shap,
            "confidence":     float(np.max(fusion_proba)),
        }

    except Exception as e:
        yield {
            "event":   "error",
            "modality": "fusion",
            "message": str(e),
        }

    finally:
        # Clean up temp files
        for path in [tmp_physio, tmp_motion, tmp_voice, tmp_image]:
            try:
                os.unlink(path)
            except Exception:
                pass
