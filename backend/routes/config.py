"""Runtime configuration API routes."""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from auth.jwt import get_current_user, require_admin
from db.models import User
from schemas.schemas import APIResponse

router = APIRouter(prefix="/api/config", tags=["Configuration"])

CONFIG_PATH = Path(__file__).resolve().parents[1] / "runtime" / "config.json"
DEFAULT_CONFIG = {
    "threshold": 0.35,
    "alerts": {
        "fraud": True,
        "drift": True,
        "slowdown": True,
        "volume": True,
        "sound": False,
    },
}


class ThresholdUpdate(BaseModel):
    threshold: float = Field(..., ge=0.1, le=0.9)


def _read_config() -> dict:
    if not CONFIG_PATH.exists():
        return DEFAULT_CONFIG.copy()
    try:
        with CONFIG_PATH.open("r", encoding="utf-8") as handle:
            data = json.load(handle)
    except json.JSONDecodeError:
        data = {}
    merged = DEFAULT_CONFIG.copy()
    merged.update(data)
    merged["alerts"] = {**DEFAULT_CONFIG["alerts"], **data.get("alerts", {})}
    return merged


def _write_config(data: dict) -> None:
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with CONFIG_PATH.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2)


@router.get("", response_model=APIResponse[dict])
async def get_config(current_user: User = Depends(get_current_user)):
    return APIResponse(success=True, data=_read_config(), message="Runtime config retrieved.")


@router.post("/threshold", response_model=APIResponse[dict])
async def update_threshold(payload: ThresholdUpdate, admin_user: User = Depends(require_admin)):
    config = _read_config()
    config["threshold"] = round(payload.threshold, 2)
    _write_config(config)
    return APIResponse(
        success=True,
        data={"threshold": config["threshold"], "updated_by": admin_user.username},
        message="Fraud threshold updated.",
    )
