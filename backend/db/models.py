"""
SQLAlchemy ORM models for the FraudGuard ML system.

Tables:
    - users: Application users with roles (admin/viewer)
    - transactions: Raw transaction data with all 28 PCA features from the
      Kaggle Credit Card Fraud Detection dataset
    - predictions: ML inference results linked to transactions
    - model_metrics: Historical model evaluation metrics
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Index
)
from sqlalchemy.orm import relationship
from db.database import Base


def utcnow():
    """Return current UTC timestamp."""
    return datetime.now(timezone.utc)


def generate_uuid():
    """Generate a new UUID4 string."""
    return str(uuid.uuid4())


class User(Base):
    """Application user with role-based access control."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="viewer")  # admin | viewer
    created_at = Column(DateTime(timezone=True), default=utcnow)

    def __repr__(self):
        return f"<User(id={self.id}, username={self.username}, role={self.role})>"


class Transaction(Base):
    """
    Raw transaction record with PCA-transformed features.

    Mirrors the Kaggle Credit Card Fraud Detection dataset:
    - Time: seconds elapsed from the first transaction
    - V1–V28: PCA-transformed anonymized features
    - Amount: transaction amount in USD
    - Class (stored in prediction): 0 = legit, 1 = fraud
    """
    __tablename__ = "transactions"
    __table_args__ = (
        Index("idx_transactions_created_at", "created_at"),
        Index("idx_transactions_txn_id", "txn_id"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    txn_id = Column(String(50), unique=True, nullable=False, default=generate_uuid)
    time_elapsed = Column(Float, nullable=False, default=0.0)
    amount = Column(Float, nullable=False)
    hour_of_day = Column(Integer, nullable=False, default=0)

    # All 28 PCA features from the Kaggle dataset
    v1 = Column(Float, nullable=False, default=0.0)
    v2 = Column(Float, nullable=False, default=0.0)
    v3 = Column(Float, nullable=False, default=0.0)
    v4 = Column(Float, nullable=False, default=0.0)
    v5 = Column(Float, nullable=False, default=0.0)
    v6 = Column(Float, nullable=False, default=0.0)
    v7 = Column(Float, nullable=False, default=0.0)
    v8 = Column(Float, nullable=False, default=0.0)
    v9 = Column(Float, nullable=False, default=0.0)
    v10 = Column(Float, nullable=False, default=0.0)
    v11 = Column(Float, nullable=False, default=0.0)
    v12 = Column(Float, nullable=False, default=0.0)
    v13 = Column(Float, nullable=False, default=0.0)
    v14 = Column(Float, nullable=False, default=0.0)
    v15 = Column(Float, nullable=False, default=0.0)
    v16 = Column(Float, nullable=False, default=0.0)
    v17 = Column(Float, nullable=False, default=0.0)
    v18 = Column(Float, nullable=False, default=0.0)
    v19 = Column(Float, nullable=False, default=0.0)
    v20 = Column(Float, nullable=False, default=0.0)
    v21 = Column(Float, nullable=False, default=0.0)
    v22 = Column(Float, nullable=False, default=0.0)
    v23 = Column(Float, nullable=False, default=0.0)
    v24 = Column(Float, nullable=False, default=0.0)
    v25 = Column(Float, nullable=False, default=0.0)
    v26 = Column(Float, nullable=False, default=0.0)
    v27 = Column(Float, nullable=False, default=0.0)
    v28 = Column(Float, nullable=False, default=0.0)

    is_deleted = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    # Relationship to prediction
    prediction = relationship("Prediction", back_populates="transaction", uselist=False)

    def __repr__(self):
        return f"<Transaction(txn_id={self.txn_id}, amount={self.amount})>"


class Prediction(Base):
    """ML inference result for a single transaction."""
    __tablename__ = "predictions"
    __table_args__ = (
        Index("idx_predictions_created_at", "created_at"),
        Index("idx_predictions_is_fraud", "is_fraud"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    txn_id = Column(String(50), ForeignKey("transactions.txn_id"), nullable=False, unique=True)
    is_fraud = Column(Boolean, nullable=False)
    confidence_score = Column(Float, nullable=False)
    risk_score = Column(Integer, nullable=False)  # 0–100
    model_version = Column(String(50), nullable=False, default="v1.0.0-mock")
    processing_time_ms = Column(Float, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    # Relationship back to transaction
    transaction = relationship("Transaction", back_populates="prediction")

    def __repr__(self):
        return f"<Prediction(txn_id={self.txn_id}, is_fraud={self.is_fraud}, confidence={self.confidence_score})>"


class ModelMetric(Base):
    """Periodic model evaluation metrics snapshot."""
    __tablename__ = "model_metrics"

    id = Column(Integer, primary_key=True, autoincrement=True)
    model_version = Column(String(50), nullable=False)
    auc_roc = Column(Float, nullable=False)
    f1_score = Column(Float, nullable=False)
    precision_val = Column(Float, nullable=False)
    recall = Column(Float, nullable=False)
    evaluated_at = Column(DateTime(timezone=True), default=utcnow)

    def __repr__(self):
        return f"<ModelMetric(version={self.model_version}, auc={self.auc_roc})>"
