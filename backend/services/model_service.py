"""
ML Inference Engine for fraud detection.

Loads a trained model (XGBoost or sklearn pipeline) from disk on startup.
If model files are missing, automatically creates a mock pipeline that
returns realistic dummy predictions so the frontend works during development.

Key behavior:
    - Decision threshold: 0.35 (not 0.5) to maximize fraud recall
    - Model cached in class attribute — never reloaded per request
    - Thread-safe prediction via numpy operations
"""

import os
import time
import logging
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime, timezone

import joblib

logger = logging.getLogger(__name__)

# Feature names matching the transaction schema
FEATURE_NAMES = [
    "time", "amount", "hour_of_day", 
    "v1", "v2", "v3", "v4", "v5", "v6", "v7", "v8", "v9", "v10", 
    "v11", "v12", "v13", "v14", "v15", "v16", "v17", "v18", "v19", "v20", 
    "v21", "v22", "v23", "v24", "v25", "v26", "v27", "v28"
]


class ModelService:
    """
    Singleton-style ML inference service.

    Attributes:
        model: The loaded sklearn/xgboost model or mock pipeline.
        scaler: Feature scaler (StandardScaler).
        version: Model version string.
        is_mock: Whether using a fallback mock model.
        is_loaded: Whether a model is ready for predictions.
        startup_time: Timestamp when the model was loaded.
        last_prediction_at: Timestamp of last inference call.
        total_predictions: Counter of total predictions made.
    """

    def __init__(self):
        self.model = None
        self.scaler = None
        self.version: str = "v1.0.0-mock"
        self.is_mock: bool = True
        self.is_loaded: bool = False
        self.startup_time: datetime | None = None
        self.last_prediction_at: datetime | None = None
        self.total_predictions: int = 0
        self._feature_importances: dict | None = None

    def load(self, model_path: str | None = None, scaler_path: str | None = None):
        """
        Load the ML model and scaler from disk.
        Falls back to a mock pipeline if files are not found.

        Args:
            model_path: Path to the serialized model (.pkl).
            scaler_path: Path to the serialized scaler (.pkl).
        """
        model_path = model_path or os.getenv("MODEL_PATH", "ml/models/fraud_model.pkl")
        scaler_path = scaler_path or os.getenv("SCALER_PATH", "ml/models/scaler.pkl")

        try:
            if Path(model_path).exists() and Path(scaler_path).exists():
                self.model = joblib.load(model_path)
                self.scaler = joblib.load(scaler_path)
                self.is_mock = False
                self.version = getattr(self.model, "version_", "v1.0.0")
                logger.info(f"✅ Production model loaded: {model_path} (version: {self.version})")
            else:
                logger.warning(f"⚠️  Model files not found at {model_path}. Creating mock pipeline...")
                self._load_mock_model()
        except Exception as e:
            logger.error(f"❌ Failed to load model: {e}. Falling back to mock pipeline.")
            self._load_mock_model()

        self.is_loaded = True
        self.startup_time = datetime.now(timezone.utc)
        self._compute_feature_importances()
        logger.info(f"🤖 ModelService ready | version={self.version} | mock={self.is_mock}")

    def _load_mock_model(self):
        from sklearn.pipeline import Pipeline
        from sklearn.preprocessing import StandardScaler
        from sklearn.linear_model import LogisticRegression
        import numpy as np

        X_dummy = np.random.randn(200, 30)
        y_dummy = np.array([0] * 190 + [1] * 10)

        pipeline = Pipeline([
            ('scaler', StandardScaler()),
            ('clf', LogisticRegression(random_state=42))
        ])
        pipeline.fit(X_dummy, y_dummy)
        self.model = pipeline
        self.version = "mock-v0.1"
        self.is_mock = True
        # Set a dummy scaler for the predict method that relies on self.scaler
        self.scaler = StandardScaler().fit(np.random.randn(10, len(FEATURE_NAMES)))
        logger.warning("Running with MOCK model — predictions are simulated")

    def _compute_feature_importances(self):
        """Extract feature importances from the model."""
        try:
            # For pipeline
            if hasattr(self.model, "named_steps") and "clf" in self.model.named_steps:
                clf = self.model.named_steps["clf"]
                if hasattr(clf, "feature_importances_"):
                    importances = clf.feature_importances_
                elif hasattr(clf, "coef_"):
                    importances = np.abs(clf.coef_[0])
                else:
                    importances = np.ones(len(FEATURE_NAMES)) / len(FEATURE_NAMES)
            elif hasattr(self.model, "feature_importances_"):
                importances = self.model.feature_importances_
            elif hasattr(self.model, "coef_"):
                importances = np.abs(self.model.coef_[0])
            else:
                importances = np.ones(len(FEATURE_NAMES)) / len(FEATURE_NAMES)

            # Ensure lengths match
            if len(importances) < len(FEATURE_NAMES):
                importances = np.pad(importances, (0, len(FEATURE_NAMES) - len(importances)))
            elif len(importances) > len(FEATURE_NAMES):
                importances = importances[:len(FEATURE_NAMES)]

            self._feature_importances = {
                name: round(float(imp), 4)
                for name, imp in zip(FEATURE_NAMES, importances)
            }
        except Exception as e:
            logger.warning(f"Could not compute feature importances: {e}")
            self._feature_importances = {name: 1.0 / len(FEATURE_NAMES) for name in FEATURE_NAMES}

    def predict(self, features: dict) -> dict:
        """
        Run ML inference on a single transaction.

        Args:
            features: Dict with keys matching FEATURE_NAMES.

        Returns:
            Dict with keys: is_fraud, confidence_score, risk_score, processing_time_ms, model_version
        """
        if not self.is_loaded:
            raise RuntimeError("Model not loaded. Call load() first.")

        start = time.perf_counter()

        # Build feature vector in correct order
        feature_vector = np.array([[features.get(f, 0.0) for f in FEATURE_NAMES]])

        # If it's the mock pipeline from user spec, we should pass the unscaled data since the pipeline has a scaler
        if self.is_mock and hasattr(self.model, "predict_proba"):
            # We must slice the feature vector to 30 features because the mock data had 30 features
            feature_vector_for_mock = feature_vector[:, :30]
            probas = self.model.predict_proba(feature_vector_for_mock)[0]
        else:
            # Scale features for standard model
            feature_vector_scaled = self.scaler.transform(feature_vector) if self.scaler else feature_vector
            probas = self.model.predict_proba(feature_vector_scaled)[0]

        fraud_probability = float(probas[1]) if len(probas) > 1 else float(probas[0])

        # Apply decision threshold of 0.35 for higher recall
        is_fraud = fraud_probability >= 0.35

        # Confidence: how confident the model is in its prediction
        confidence_score = fraud_probability if is_fraud else (1.0 - fraud_probability)
        confidence_score = round(min(max(confidence_score, 0.0), 1.0), 4)

        # Risk score: 0-100 scale based on fraud probability
        risk_score = int(round(fraud_probability * 100))
        risk_score = min(max(risk_score, 0), 100)

        elapsed_ms = (time.perf_counter() - start) * 1000

        self.last_prediction_at = datetime.now(timezone.utc)
        self.total_predictions += 1

        return {
            "is_fraud": is_fraud,
            "confidence_score": confidence_score,
            "risk_score": risk_score,
            "processing_time_ms": round(elapsed_ms, 3),
            "model_version": self.version,
        }

    def explain_prediction(self, features: dict) -> dict:
        if hasattr(self.model, 'feature_importances_'):
            importances = self.model.feature_importances_
            feature_names = list(features.keys())
            explanation = {
                name: round(float(score), 6)
                for name, score in zip(feature_names, importances)
            }
            sorted_explanation = dict(
                sorted(explanation.items(), key=lambda x: x[1], reverse=True)
            )
            return {
                "method": "feature_importance",
                "scores": sorted_explanation,
                "top_features": list(sorted_explanation.keys())[:5]
            }
        
        # Fallback if the model is a pipeline or doesn't have feature_importances_
        importances = self._feature_importances or {}
        feature_names = list(features.keys())
        explanation = {
            name: round(float(importances.get(name, 0.0)), 6)
            for name in feature_names
        }
        sorted_explanation = dict(
            sorted(explanation.items(), key=lambda x: x[1], reverse=True)
        )
        return {
            "method": "feature_importance",
            "scores": sorted_explanation,
            "top_features": list(sorted_explanation.keys())[:5]
        }

    def predict_batch(self, features_list: list[dict]) -> list[dict]:
        """
        Run ML inference on a batch of transactions.

        Args:
            features_list: List of feature dicts.

        Returns:
            List of prediction result dicts.
        """
        return [self.predict(features) for features in features_list]

    def get_feature_importance(self) -> dict:
        """Return feature importance scores."""
        return self._feature_importances or {}

    def get_health(self) -> dict:
        """Return model health status."""
        uptime = 0.0
        if self.startup_time:
            uptime = (datetime.now(timezone.utc) - self.startup_time).total_seconds()

        return {
            "model_version": self.version,
            "is_loaded": self.is_loaded,
            "is_mock": self.is_mock,
            "uptime_seconds": round(uptime, 2),
            "last_prediction_at": self.last_prediction_at.isoformat() if self.last_prediction_at else None,
            "total_predictions": self.total_predictions,
        }


# ─── Global singleton instance ───
model_service = ModelService()
