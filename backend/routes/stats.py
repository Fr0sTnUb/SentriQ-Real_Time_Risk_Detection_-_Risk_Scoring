"""
Dashboard Statistics API routes.

Endpoints:
    GET /api/stats/summary      — Aggregate stats for last 24 hours
    GET /api/stats/hourly        — Last 60 data points (1 per minute) for AreaChart
    GET /api/stats/distribution  — Legit vs Fraud totals for PieChart
    GET /api/stats/kpi/delta     — Percentage change vs previous 24h period
"""

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select, func, and_, case, text
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from db.models import User, Transaction, Prediction
from auth.jwt import get_current_user
from schemas.schemas import (
    APIResponse,
    SummaryStats,
    HourlyDataPoint,
    DistributionData,
    KPIDelta,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/stats", tags=["Dashboard Stats"])


@router.get(
    "/summary",
    response_model=APIResponse[SummaryStats],
    summary="24h summary statistics",
    description="Returns aggregated KPI metrics for the last 24 hours: total transactions, fraud count, fraud rate, average confidence, and transactions per minute.",
)
async def get_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Compute aggregate stats for the last 24 hours."""
    now = datetime.now(timezone.utc)
    cutoff_24h = now - timedelta(hours=24)

    # Total transactions in last 24h
    total_result = await db.execute(
        select(func.count(Transaction.id))
        .where(and_(
            Transaction.created_at >= cutoff_24h,
            Transaction.is_deleted == False,
        ))
    )
    total_transactions = total_result.scalar() or 0

    # Fraud count and avg confidence in last 24h
    fraud_result = await db.execute(
        select(
            func.count(Prediction.id),
            func.avg(Prediction.confidence_score),
        )
        .join(Transaction, Transaction.txn_id == Prediction.txn_id)
        .where(and_(
            Transaction.created_at >= cutoff_24h,
            Transaction.is_deleted == False,
            Prediction.is_fraud == True,
        ))
    )
    fraud_row = fraud_result.one()
    fraud_count = fraud_row[0] or 0

    # Average confidence across ALL predictions (not just fraud)
    avg_conf_result = await db.execute(
        select(func.avg(Prediction.confidence_score))
        .join(Transaction, Transaction.txn_id == Prediction.txn_id)
        .where(and_(
            Transaction.created_at >= cutoff_24h,
            Transaction.is_deleted == False,
        ))
    )
    avg_confidence = avg_conf_result.scalar() or 0.0

    fraud_rate = (fraud_count / total_transactions * 100) if total_transactions > 0 else 0.0
    txn_per_min = total_transactions / (24 * 60) if total_transactions > 0 else 0.0

    return APIResponse(
        success=True,
        data=SummaryStats(
            total_transactions_24h=total_transactions,
            fraud_count_24h=fraud_count,
            fraud_rate_percent=round(fraud_rate, 4),
            avg_confidence=round(float(avg_confidence), 4),
            transactions_per_minute=round(txn_per_min, 2),
        ),
        message="24h summary statistics retrieved.",
    )


@router.get(
    "/hourly",
    response_model=APIResponse[list[HourlyDataPoint]],
    summary="Minute-by-minute data for AreaChart",
    description="Returns the last 60 data points (one per minute) with transaction_count and fraud_count. Used for the dashboard AreaChart.",
)
async def get_hourly(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return last 60 data points (1 per minute) for the AreaChart."""
    now = datetime.now(timezone.utc)
    cutoff_60m = now - timedelta(minutes=60)

    # Query transactions grouped by minute
    result = await db.execute(
        select(
            func.date_trunc('minute', Transaction.created_at).label('minute'),
            func.count(Transaction.id).label('txn_count'),
            func.count(case((Prediction.is_fraud == True, 1))).label('fraud_count'),
        )
        .outerjoin(Prediction, Transaction.txn_id == Prediction.txn_id)
        .where(and_(
            Transaction.created_at >= cutoff_60m,
            Transaction.is_deleted == False,
        ))
        .group_by(func.date_trunc('minute', Transaction.created_at))
        .order_by(func.date_trunc('minute', Transaction.created_at).asc())
    )
    rows = result.all()

    # Build the response with 60 data points (fill gaps with zeros)
    data_points = []
    minute_data = {}
    for row in rows:
        minute_key = row.minute.strftime("%H:%M") if row.minute else "00:00"
        minute_data[minute_key] = {
            "transaction_count": row.txn_count,
            "fraud_count": row.fraud_count,
        }

    for i in range(60):
        t = cutoff_60m + timedelta(minutes=i)
        key = t.strftime("%H:%M")
        if key in minute_data:
            data_points.append(HourlyDataPoint(
                time=key,
                transaction_count=minute_data[key]["transaction_count"],
                fraud_count=minute_data[key]["fraud_count"],
            ))
        else:
            data_points.append(HourlyDataPoint(
                time=key,
                transaction_count=0,
                fraud_count=0,
            ))

    return APIResponse(
        success=True,
        data=data_points,
        message=f"Returned {len(data_points)} minute-level data points.",
    )


@router.get(
    "/distribution",
    response_model=APIResponse[DistributionData],
    summary="Fraud vs Legit distribution",
    description="Returns total legit_count and fraud_count for the Donut PieChart on the dashboard.",
)
async def get_distribution(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return legit vs fraud distribution for the PieChart."""
    now = datetime.now(timezone.utc)
    cutoff_24h = now - timedelta(hours=24)

    result = await db.execute(
        select(
            func.count(case((Prediction.is_fraud == True, 1))).label('fraud_count'),
            func.count(case((Prediction.is_fraud == False, 1))).label('legit_count'),
        )
        .join(Transaction, Transaction.txn_id == Prediction.txn_id)
        .where(and_(
            Transaction.created_at >= cutoff_24h,
            Transaction.is_deleted == False,
        ))
    )
    row = result.one()

    return APIResponse(
        success=True,
        data=DistributionData(
            legit_count=row.legit_count or 0,
            fraud_count=row.fraud_count or 0,
        ),
        message="Classification distribution retrieved.",
    )


@router.get(
    "/kpi/delta",
    response_model=APIResponse[KPIDelta],
    summary="KPI percentage changes",
    description="Returns percentage change in KPIs versus the previous 24-hour period, used to populate the delta indicators on KPI cards.",
)
async def get_kpi_delta(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Compute percentage change vs previous 24h for all 4 KPIs."""
    now = datetime.now(timezone.utc)
    cutoff_24h = now - timedelta(hours=24)
    cutoff_48h = now - timedelta(hours=48)

    # Current period: last 24h
    curr_total = (await db.execute(
        select(func.count(Transaction.id))
        .where(and_(Transaction.created_at >= cutoff_24h, Transaction.is_deleted == False))
    )).scalar() or 0

    curr_fraud = (await db.execute(
        select(func.count(Prediction.id))
        .join(Transaction, Transaction.txn_id == Prediction.txn_id)
        .where(and_(
            Transaction.created_at >= cutoff_24h,
            Transaction.is_deleted == False,
            Prediction.is_fraud == True,
        ))
    )).scalar() or 0

    curr_avg_conf = (await db.execute(
        select(func.avg(Prediction.confidence_score))
        .join(Transaction, Transaction.txn_id == Prediction.txn_id)
        .where(and_(Transaction.created_at >= cutoff_24h, Transaction.is_deleted == False))
    )).scalar() or 0.0

    # Previous period: 48h to 24h ago
    prev_total = (await db.execute(
        select(func.count(Transaction.id))
        .where(and_(
            Transaction.created_at >= cutoff_48h,
            Transaction.created_at < cutoff_24h,
            Transaction.is_deleted == False,
        ))
    )).scalar() or 0

    prev_fraud = (await db.execute(
        select(func.count(Prediction.id))
        .join(Transaction, Transaction.txn_id == Prediction.txn_id)
        .where(and_(
            Transaction.created_at >= cutoff_48h,
            Transaction.created_at < cutoff_24h,
            Transaction.is_deleted == False,
            Prediction.is_fraud == True,
        ))
    )).scalar() or 0

    prev_avg_conf = (await db.execute(
        select(func.avg(Prediction.confidence_score))
        .join(Transaction, Transaction.txn_id == Prediction.txn_id)
        .where(and_(
            Transaction.created_at >= cutoff_48h,
            Transaction.created_at < cutoff_24h,
            Transaction.is_deleted == False,
        ))
    )).scalar() or 0.0

    def pct_change(current: float, previous: float) -> float:
        if previous == 0:
            return 100.0 if current > 0 else 0.0
        return round(((current - previous) / previous) * 100, 2)

    curr_fraud_rate = (curr_fraud / curr_total * 100) if curr_total > 0 else 0.0
    prev_fraud_rate = (prev_fraud / prev_total * 100) if prev_total > 0 else 0.0

    return APIResponse(
        success=True,
        data=KPIDelta(
            total_transactions_delta=pct_change(curr_total, prev_total),
            fraud_count_delta=pct_change(curr_fraud, prev_fraud),
            fraud_rate_delta=round(curr_fraud_rate - prev_fraud_rate, 4),
            avg_confidence_delta=pct_change(float(curr_avg_conf), float(prev_avg_conf)),
        ),
        message="KPI deltas computed vs previous 24h period.",
    )
