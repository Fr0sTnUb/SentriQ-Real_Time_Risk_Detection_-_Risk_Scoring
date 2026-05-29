"""
Transaction management API routes.

Endpoints:
    GET    /api/transactions/recent   — Last 50 predictions with transaction data
    GET    /api/transactions/{txn_id} — Full detail of a single transaction
    DELETE /api/transactions/{txn_id} — Admin-only soft delete
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from db.database import get_db
from db.models import User, Transaction, Prediction
from auth.jwt import get_current_user, require_admin
from schemas.schemas import (
    APIResponse,
    RecentTransaction,
    TransactionDetail,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/transactions", tags=["Transactions"])


@router.get(
    "/recent",
    response_model=APIResponse[list[RecentTransaction]],
    summary="Recent transactions feed",
    description="Returns the most recent transactions joined with their prediction results. Supports filtering by fraud_only and custom limit.",
)
async def get_recent_transactions(
    fraud_only: bool = Query(False, description="If true, return only fraudulent transactions"),
    limit: int = Query(50, ge=1, le=200, description="Number of transactions to return"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return last N predictions joined with transaction data."""
    query = (
        select(Transaction, Prediction)
        .join(Prediction, Transaction.txn_id == Prediction.txn_id)
        .where(Transaction.is_deleted == False)
    )

    if fraud_only:
        query = query.where(Prediction.is_fraud == True)

    query = query.order_by(Transaction.created_at.desc()).limit(limit)

    result = await db.execute(query)
    rows = result.all()

    transactions = []
    for txn, pred in rows:
        transactions.append(RecentTransaction(
            txn_id=txn.txn_id,
            timestamp=txn.created_at.isoformat() if txn.created_at else "",
            amount=txn.amount,
            confidence_score=pred.confidence_score,
            risk_score=pred.risk_score,
            status="Fraud" if pred.is_fraud else "Legit",
            model_version=pred.model_version,
        ))

    return APIResponse(
        success=True,
        data=transactions,
        message=f"Retrieved {len(transactions)} recent transactions.",
    )


@router.get(
    "/{txn_id}",
    response_model=APIResponse[TransactionDetail],
    summary="Transaction detail",
    description="Return full detail of a single transaction including its prediction result.",
)
async def get_transaction_detail(
    txn_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return full detail of a single transaction with its prediction."""
    result = await db.execute(
        select(Transaction, Prediction)
        .outerjoin(Prediction, Transaction.txn_id == Prediction.txn_id)
        .where(and_(
            Transaction.txn_id == txn_id,
            Transaction.is_deleted == False,
        ))
    )
    row = result.one_or_none()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transaction not found: {txn_id}",
        )

    txn, pred = row

    detail = TransactionDetail(
        txn_id=txn.txn_id,
        amount=txn.amount,
        hour_of_day=txn.hour_of_day,
        v1=txn.v1,
        v2=txn.v2,
        v3=txn.v3,
        v4=txn.v4,
        v5=txn.v5,
        is_fraud=pred.is_fraud if pred else None,
        confidence_score=pred.confidence_score if pred else None,
        risk_score=pred.risk_score if pred else None,
        model_version=pred.model_version if pred else None,
        processing_time_ms=pred.processing_time_ms if pred else None,
        created_at=txn.created_at,
    )

    return APIResponse(
        success=True,
        data=detail,
        message=f"Transaction detail for {txn_id}.",
    )


@router.delete(
    "/{txn_id}",
    response_model=APIResponse[dict],
    summary="Soft delete transaction (admin only)",
    description="Marks a transaction as deleted. Requires admin role. Transaction data is retained but hidden from queries.",
)
async def delete_transaction(
    txn_id: str,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(require_admin),
):
    """Admin-only soft delete: sets is_deleted=True on the transaction."""
    result = await db.execute(
        select(Transaction).where(and_(
            Transaction.txn_id == txn_id,
            Transaction.is_deleted == False,
        ))
    )
    txn = result.scalar_one_or_none()

    if not txn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transaction not found or already deleted: {txn_id}",
        )

    txn.is_deleted = True
    await db.flush()

    logger.info(f"🗑️ Transaction soft-deleted: {txn_id} by admin={admin_user.username}")

    return APIResponse(
        success=True,
        data={"txn_id": txn_id, "deleted": True},
        message=f"Transaction {txn_id} soft-deleted successfully.",
    )
