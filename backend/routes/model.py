"""
Model health, metrics, drift, and retraining API routes.

Endpoints:
    GET  /api/model/health               — Model version, status, uptime
    GET  /api/model/metrics              — Latest model AUC-ROC, F1, Precision, Recall
    GET  /api/model/drift                — Run Evidently drift report
    POST /api/model/retrain              — Trigger manual retraining (admin only)
    GET  /api/model/retrain/status/{id}  — Check retraining job status
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from db.models import User, ModelMetric
# pyrefly: ignore [missing-import]
from auth.jwt import get_current_user, require_admin
from services.model_service import model_service
from services.monitoring import monitoring_service
from services.scheduler import scheduler_service
from schemas.schemas import (
    APIResponse,
    ModelHealth,
    ModelMetricsResponse,
    DriftReport,
    RetrainRequest,
    RetrainStatus,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/model", tags=["Model & Monitoring"])


@router.get(
    "/health",
    response_model=APIResponse[ModelHealth],
    summary="Model health check",
    description="Returns the current model version, load status, uptime in seconds, last prediction timestamp, and total prediction count.",
)
async def get_model_health(
    current_user: User = Depends(get_current_user),
):
    """Return model health and operational status."""
    health = model_service.get_health()

    return APIResponse(
        success=True,
        data=ModelHealth(**health),
        message="Model health status retrieved.",
    )


@router.get(
    "/metrics",
    response_model=APIResponse[ModelMetricsResponse],
    summary="Current model metrics",
    description="Returns the latest model evaluation metrics (AUC-ROC, F1-Score, Precision, Recall) from the model_metrics table.",
)
async def get_model_metrics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the most recent model metrics from the database."""
    result = await db.execute(
        select(ModelMetric).order_by(ModelMetric.evaluated_at.desc()).limit(1)
    )
    metric = result.scalar_one_or_none()

    if not metric:
        # Return default metrics if none exist yet
        return APIResponse(
            success=True,
            data=ModelMetricsResponse(
                model_version=model_service.version,
                auc_roc=0.0,
                f1_score=0.0,
                precision_val=0.0,
                recall=0.0,
                evaluated_at=datetime.now(timezone.utc),
            ),
            message="No metrics recorded yet. Metrics are computed hourly.",
        )

    return APIResponse(
        success=True,
        data=ModelMetricsResponse.model_validate(metric),
        message="Latest model metrics retrieved.",
    )


@router.get(
    "/drift",
    response_model=APIResponse[DriftReport],
    summary="Data drift detection",
    description="Runs an Evidently data drift report comparing reference data against recent transactions. Returns overall drift score and per-feature drift details.",
)
async def get_drift_report(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Run drift detection and return the report."""
    report = await monitoring_service.run_drift_check(db=db)

    return APIResponse(
        success=True,
        data=report,
        message="Drift report generated.",
    )


@router.post(
    "/retrain",
    response_model=APIResponse[RetrainRequest],
    summary="Trigger model retraining (admin only)",
    description="Queues a manual model retraining job that runs in the background. Returns a job_id to track progress. Admin role required.",
)
async def trigger_retrain(
    admin_user: User = Depends(require_admin),
):
    """Trigger a manual retraining job in the background."""
    result = await scheduler_service.trigger_manual_retrain()

    logger.info(f"🔄 Manual retrain triggered by admin={admin_user.username} | job_id={result['job_id']}")

    return APIResponse(
        success=True,
        data=RetrainRequest(
            job_id=result["job_id"],
            status=result["status"],
            triggered_at=result["triggered_at"],
        ),
        message="Retraining job queued. Use /api/model/retrain/status/{job_id} to track progress.",
    )


@router.get(
    "/retrain/status/{job_id}",
    response_model=APIResponse[RetrainStatus],
    summary="Retraining job status",
    description="Returns the current status of a retraining job (pending / running / complete / failed).",
)
async def get_retrain_status(
    job_id: str,
    current_user: User = Depends(get_current_user),
):
    """Return the status of a retraining job."""
    job_status = scheduler_service.get_retrain_status(job_id)

    if not job_status:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Retraining job not found: {job_id}",
        )

    return APIResponse(
        success=True,
        data=RetrainStatus(
            job_id=job_id,
            status=job_status["status"],
            model_version=job_status.get("model_version"),
            metrics=job_status.get("metrics"),
            started_at=job_status.get("started_at"),
            completed_at=job_status.get("completed_at"),
        ),
        message=f"Retraining job status: {job_status['status']}.",
    )
