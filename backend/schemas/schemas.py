"""
Pydantic v2 schemas for all API request/response models.

Aligned with the Kaggle Credit Card Fraud Detection dataset:
    - 28 PCA features (V1–V28)
    - Amount, Time
    - Class (0=legit, 1=fraud)

Groups:
    - APIResponse: Generic JSON envelope wrapper
    - Auth: User registration, login, JWT tokens
    - Transaction: Input/output for transaction data
    - Prediction: ML inference results
    - Stats: Dashboard summary, hourly, distribution, KPI delta
    - Model: Health, metrics, drift, retraining
"""

from __future__ import annotations
import uuid
from datetime import datetime, timezone
from typing import Any, Generic, TypeVar
from pydantic import BaseModel, Field, ConfigDict


T = TypeVar("T")


# ──────────────────────────────────────────────────────────────
# Generic API Response Envelope
# ──────────────────────────────────────────────────────────────

class APIResponse(BaseModel, Generic[T]):
    """Standard JSON envelope for all API responses."""
    success: bool = True
    data: T | None = None
    message: str = ""
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    request_id: str = Field(default_factory=lambda: str(uuid.uuid4()))


class APIError(BaseModel):
    """Error response body."""
    success: bool = False
    error_code: str
    detail: str
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    request_id: str = Field(default_factory=lambda: str(uuid.uuid4()))


# ──────────────────────────────────────────────────────────────
# Auth Schemas
# ──────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    """Registration request body."""
    username: str = Field(..., min_length=3, max_length=100, description="Unique username")
    password: str = Field(..., min_length=6, max_length=128, description="Account password")
    role: str = Field(default="viewer", description="User role: admin or viewer")

    model_config = ConfigDict(json_schema_extra={
        "example": {"username": "analyst_01", "password": "SecureP@ss1", "role": "viewer"}
    })


class UserLogin(BaseModel):
    """Login request body."""
    username: str
    password: str


class UserResponse(BaseModel):
    """User data returned in responses (password excluded)."""
    id: int
    username: str
    role: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    """JWT token response after successful login."""
    access_token: str
    token_type: str = "bearer"
    expires_in_minutes: int = 1440


# ──────────────────────────────────────────────────────────────
# Transaction Schemas (V1–V28 from Kaggle dataset)
# ──────────────────────────────────────────────────────────────

class TransactionInput(BaseModel):
    """
    Single transaction input for ML inference.
    Matches the Kaggle Credit Card Fraud Detection dataset schema.
    """
    model_config = ConfigDict(from_attributes=True)
    
    time: float = Field(default=0.0, description="Seconds elapsed from first transaction in dataset")
    amount: float = Field(..., ge=0, description="Transaction amount in USD")
    hour_of_day: int = Field(default=0, ge=0, le=23, description="Hour of the transaction (0-23)")
    v1: float = Field(default=0.0, description="PCA feature V1")
    v2: float = Field(default=0.0, description="PCA feature V2")
    v3: float = Field(default=0.0, description="PCA feature V3")
    v4: float = Field(default=0.0, description="PCA feature V4")
    v5: float = Field(default=0.0, description="PCA feature V5")
    v6: float = Field(default=0.0, description="PCA feature V6")
    v7: float = Field(default=0.0, description="PCA feature V7")
    v8: float = Field(default=0.0, description="PCA feature V8")
    v9: float = Field(default=0.0, description="PCA feature V9")
    v10: float = Field(default=0.0, description="PCA feature V10")
    v11: float = Field(default=0.0, description="PCA feature V11")
    v12: float = Field(default=0.0, description="PCA feature V12")
    v13: float = Field(default=0.0, description="PCA feature V13")
    v14: float = Field(default=0.0, description="PCA feature V14")
    v15: float = Field(default=0.0, description="PCA feature V15")
    v16: float = Field(default=0.0, description="PCA feature V16")
    v17: float = Field(default=0.0, description="PCA feature V17")
    v18: float = Field(default=0.0, description="PCA feature V18")
    v19: float = Field(default=0.0, description="PCA feature V19")
    v20: float = Field(default=0.0, description="PCA feature V20")
    v21: float = Field(default=0.0, description="PCA feature V21")
    v22: float = Field(default=0.0, description="PCA feature V22")
    v23: float = Field(default=0.0, description="PCA feature V23")
    v24: float = Field(default=0.0, description="PCA feature V24")
    v25: float = Field(default=0.0, description="PCA feature V25")
    v26: float = Field(default=0.0, description="PCA feature V26")
    v27: float = Field(default=0.0, description="PCA feature V27")
    v28: float = Field(default=0.0, description="PCA feature V28")

    model_config = ConfigDict(json_schema_extra={
        "example": {
            "time": 406.0, "amount": 1250.50, "hour_of_day": 14,
            "v1": -1.36, "v2": -0.07, "v3": 2.54, "v4": 1.38, "v5": -0.34,
            "v6": 0.46, "v7": 0.24, "v8": 0.10, "v9": 0.36, "v10": 0.09,
            "v11": -0.55, "v12": -0.62, "v13": -0.99, "v14": -0.31,
            "v15": 1.47, "v16": -0.47, "v17": 0.21, "v18": 0.03,
            "v19": 0.40, "v20": 0.25, "v21": -0.02, "v22": 0.28,
            "v23": -0.11, "v24": 0.07, "v25": 0.13, "v26": -0.19,
            "v27": 0.13, "v28": -0.02,
        }
    })


class TransactionBatchInput(BaseModel):
    """Batch of transactions (max 100)."""
    transactions: list[TransactionInput] = Field(..., max_length=100, description="List of transactions")


class TransactionDetail(BaseModel):
    """Full transaction detail with prediction result."""
    txn_id: str
    time_elapsed: float
    amount: float
    hour_of_day: int
    v1: float
    v2: float
    v3: float
    v4: float
    v5: float
    v6: float
    v7: float
    v8: float
    v9: float
    v10: float
    v11: float
    v12: float
    v13: float
    v14: float
    v15: float
    v16: float
    v17: float
    v18: float
    v19: float
    v20: float
    v21: float
    v22: float
    v23: float
    v24: float
    v25: float
    v26: float
    v27: float
    v28: float
    is_fraud: bool | None = None
    confidence_score: float | None = None
    risk_score: int | None = None
    model_version: str | None = None
    processing_time_ms: float | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ──────────────────────────────────────────────────────────────
# Prediction Schemas
# ──────────────────────────────────────────────────────────────

class PredictionResult(BaseModel):
    """Result of a single ML inference."""
    txn_id: str
    is_fraud: bool
    confidence_score: float = Field(..., ge=0.0, le=1.0)
    risk_score: int = Field(..., ge=0, le=100)
    model_version: str
    processing_time_ms: float
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BatchPredictionResult(BaseModel):
    """Summary of a batch inference run."""
    total: int
    fraud_count: int
    legit_count: int
    avg_confidence: float
    avg_processing_time_ms: float
    predictions: list[PredictionResult]


class ExplanationResult(BaseModel):
    """Feature importance explanation for a given prediction."""
    txn_id: str
    feature_importances: dict[str, float]
    top_features: list[str]
    model_version: str


# ──────────────────────────────────────────────────────────────
# Stats / Dashboard Schemas
# ──────────────────────────────────────────────────────────────

class SummaryStats(BaseModel):
    """Aggregate stats for the last 24 hours."""
    total_transactions_24h: int
    fraud_count_24h: int
    fraud_rate_percent: float
    avg_confidence: float
    transactions_per_minute: float


class HourlyDataPoint(BaseModel):
    """Single data point for the AreaChart (1-minute granularity)."""
    time: str  # HH:MM format
    transaction_count: int
    fraud_count: int


class DistributionData(BaseModel):
    """Legit vs Fraud totals for the Donut PieChart."""
    legit_count: int
    fraud_count: int


class KPIDelta(BaseModel):
    """Percentage change in KPIs vs previous 24h period."""
    total_transactions_delta: float
    fraud_count_delta: float
    fraud_rate_delta: float
    avg_confidence_delta: float


# ──────────────────────────────────────────────────────────────
# Model / Monitoring Schemas
# ──────────────────────────────────────────────────────────────

class ModelHealth(BaseModel):
    """Current model health and status."""
    model_version: str
    is_loaded: bool
    is_mock: bool
    uptime_seconds: float
    last_prediction_at: str | None = None
    total_predictions: int


class ModelMetricsResponse(BaseModel):
    """Model evaluation metrics."""
    model_version: str
    auc_roc: float
    f1_score: float
    precision_val: float
    recall: float
    evaluated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DriftFeature(BaseModel):
    """A single drifted feature."""
    feature_name: str
    drift_score: float
    is_drifted: bool


class DriftReport(BaseModel):
    """Overall drift detection report."""
    overall_drift_score: float
    is_drift_detected: bool
    total_features: int
    drifted_features_count: int
    drifted_features: list[DriftFeature]
    checked_at: str


class RetrainRequest(BaseModel):
    """Manual retraining trigger response."""
    job_id: str
    status: str = "pending"
    triggered_at: str


class RetrainStatus(BaseModel):
    """Status of a retraining job."""
    job_id: str
    status: str  # pending | running | complete | failed
    model_version: str | None = None
    metrics: dict[str, Any] | None = None
    started_at: str | None = None
    completed_at: str | None = None


# ──────────────────────────────────────────────────────────────
# Recent Transaction Feed Schemas
# ──────────────────────────────────────────────────────────────

class RecentTransaction(BaseModel):
    """Transaction joined with its prediction for the live feed table."""
    txn_id: str
    timestamp: str
    amount: float
    confidence_score: float
    risk_score: int
    status: str  # "Fraud" | "Legit"
    model_version: str
