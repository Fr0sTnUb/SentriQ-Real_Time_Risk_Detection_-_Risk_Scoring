"""
ML Prediction API routes.

Endpoints:
    POST /api/predict/single       — Single transaction inference
    POST /api/predict/batch        — Batch inference (up to 100 transactions)
    GET  /api/predict/explain/{id} — Feature importance for a prediction
"""

import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from db.models import User, Transaction, Prediction
# pyrefly: ignore [missing-import]
from auth.jwt import get_current_user
from services.model_service import model_service
from schemas.schemas import (
    APIResponse,
    TransactionInput,
    TransactionBatchInput,
    PredictionResult,
    BatchPredictionResult,
    ExplanationResult,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/predict", tags=["Predictions"])


@router.post(
    "/single",
    response_model=APIResponse[PredictionResult],
    summary="Single transaction prediction",
    description="Submit a single transaction for ML fraud inference. Returns prediction with confidence score and risk score.",
)
async def predict_single(
    txn_input: TransactionInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Run ML inference on a single transaction, save to DB, and return the prediction result."""
    txn_id = f"tx_{uuid.uuid4().hex[:8]}"

    # Build features dict
    features = {
        "time": txn_input.time,
        "amount": txn_input.amount,
        "hour_of_day": txn_input.hour_of_day,
    }
    for i in range(1, 29):
        features[f"v{i}"] = getattr(txn_input, f"v{i}")

    # Run ML inference
    prediction = model_service.predict(features)

    # Save transaction
    txn = Transaction(
        txn_id=txn_id,
        time_elapsed=txn_input.time,
        amount=txn_input.amount,
        hour_of_day=txn_input.hour_of_day,
    )
    for i in range(1, 29):
        setattr(txn, f"v{i}", getattr(txn_input, f"v{i}"))
    db.add(txn)
    await db.flush()

    # Save prediction
    pred = Prediction(
        txn_id=txn_id,
        is_fraud=prediction["is_fraud"],
        confidence_score=prediction["confidence_score"],
        risk_score=prediction["risk_score"],
        model_version=prediction["model_version"],
        processing_time_ms=prediction["processing_time_ms"],
    )
    db.add(pred)
    await db.flush()
    await db.refresh(pred)

    status_str = "FRAUD" if prediction["is_fraud"] else "LEGIT"
    logger.info(
        f"🎯 Prediction: {txn_id} | ${txn_input.amount:,.2f} | {status_str} | "
        f"conf={prediction['confidence_score']:.3f} | user={current_user.username}"
    )

    return APIResponse(
        success=True,
        data=PredictionResult(
            txn_id=txn_id,
            is_fraud=prediction["is_fraud"],
            confidence_score=prediction["confidence_score"],
            risk_score=prediction["risk_score"],
            model_version=prediction["model_version"],
            processing_time_ms=prediction["processing_time_ms"],
            created_at=pred.created_at,
        ),
        message=f"Transaction classified as {status_str}.",
    )


@router.post(
    "/batch",
    response_model=APIResponse[BatchPredictionResult],
    summary="Batch inference (up to 100 transactions)",
)
async def predict_batch(
    payload: TransactionBatchInput,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Run model inference on a batch of transactions and save to database."""
    if not payload.transactions:
        raise HTTPException(status_code=400, detail="Batch cannot be empty.")

    transactions: list[Transaction] = []
    predictions: list[Prediction] = []
    results: list[PredictionResult] = []

    total_time = 0.0
    fraud_count = 0

    for item in payload.transactions:
        txn_id = f"tx_{uuid.uuid4().hex[:8]}"

        features = {
            "time": item.time,
            "amount": item.amount,
            "hour_of_day": item.hour_of_day,
        }
        for i in range(1, 29):
            features[f"v{i}"] = getattr(item, f"v{i}")

        result = model_service.predict(features)

        txn = Transaction(
            txn_id=txn_id,
            time_elapsed=item.time,
            amount=item.amount,
            hour_of_day=item.hour_of_day,
        )
        for i in range(1, 29):
            setattr(txn, f"v{i}", getattr(item, f"v{i}"))

        transactions.append(txn)

        pred = Prediction(
            txn_id=txn_id,
            is_fraud=result["is_fraud"],
            confidence_score=result["confidence_score"],
            risk_score=result["risk_score"],
            model_version=result["model_version"],
            processing_time_ms=result["processing_time_ms"],
        )
        predictions.append(pred)

        results.append(PredictionResult(
            txn_id=txn_id,
            is_fraud=result["is_fraud"],
            confidence_score=result["confidence_score"],
            risk_score=result["risk_score"],
            model_version=result["model_version"],
            processing_time_ms=result["processing_time_ms"],
            created_at=datetime.now(timezone.utc),
        ))

        total_time += result["processing_time_ms"]
        if result["is_fraud"]:
            fraud_count += 1

    db.add_all(transactions)
    db.add_all(predictions)
    await db.commit()

    total = len(payload.transactions)
    summary = BatchPredictionResult(
        total=total,
        fraud_count=fraud_count,
        legit_count=total - fraud_count,
        avg_confidence=sum(r.confidence_score for r in results) / total,
        avg_processing_time_ms=total_time / total,
        predictions=results,
    )

    logger.info(f"📦 Predict batch | count={total} | fraud={fraud_count}")

    return APIResponse(
        success=True,
        data=summary,
        message=f"Batch processed {total} transactions successfully.",
    )


@router.get(
    "/explain/{txn_id}",
    response_model=APIResponse[ExplanationResult],
    summary="Feature importance explanation",
    description="Returns global feature importance for the model. For a real production system, this would return SHAP values specific to the transaction.",
)
async def explain_prediction(
    txn_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return feature importances to explain a prediction."""
    result = await db.execute(
        select(Prediction).where(Prediction.txn_id == txn_id)
    )
    pred = result.scalar_one_or_none()

    if not pred:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Prediction not found for txn_id: {txn_id}"
        )

    txn_result = await db.execute(
        select(Transaction).where(Transaction.txn_id == txn_id)
    )
    txn = txn_result.scalar_one_or_none()
    
    if not txn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transaction not found for txn_id: {txn_id}"
        )
        
    features = {
        "time": txn.time_elapsed,
        "amount": txn.amount,
        "hour_of_day": txn.hour_of_day,
    }
    for i in range(1, 29):
        features[f"v{i}"] = getattr(txn, f"v{i}")

    explanation = model_service.explain_prediction(features)

    return APIResponse(
        success=True,
        data=ExplanationResult(
            txn_id=txn_id,
            feature_importances=explanation.get("scores", {}),
            top_features=explanation.get("top_features", []),
            model_version=pred.model_version,
        ),
        message="Explanation generated.",
    )
