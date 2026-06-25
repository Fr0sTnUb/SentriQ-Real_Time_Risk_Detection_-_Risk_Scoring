"""Manual review workflow API routes."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth.jwt import get_current_user
from db.database import get_db
from db.models import Prediction, Transaction, User
from schemas.schemas import APIResponse

router = APIRouter(prefix="/api/review", tags=["Review"])

REVIEW_PATH = Path(__file__).resolve().parents[1] / "runtime" / "reviews.json"


class ReviewAction(BaseModel):
    action: Literal["approve", "reject", "escalate"]


def _read_reviews() -> dict:
    if not REVIEW_PATH.exists():
        return {}
    try:
        with REVIEW_PATH.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except json.JSONDecodeError:
        return {}


def _write_reviews(data: dict) -> None:
    REVIEW_PATH.parent.mkdir(parents=True, exist_ok=True)
    with REVIEW_PATH.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2)


@router.post("/{txn_id}", response_model=APIResponse[dict])
async def review_transaction(
    txn_id: str,
    payload: ReviewAction,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Transaction, Prediction)
        .join(Prediction, Transaction.txn_id == Prediction.txn_id)
        .where(Transaction.txn_id == txn_id)
    )
    if not result.one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transaction not found: {txn_id}",
        )

    reviews = _read_reviews()
    reviews[txn_id] = {
        "action": payload.action,
        "reviewed_by": current_user.username,
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
    }
    _write_reviews(reviews)

    return APIResponse(
        success=True,
        data={"txn_id": txn_id, **reviews[txn_id]},
        message=f"Review action '{payload.action}' recorded.",
    )
