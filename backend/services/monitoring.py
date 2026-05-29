# services/monitoring.py
import logging
from datetime import datetime, timezone
from scipy.stats import ks_2samp
import pandas as pd
import numpy as np

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from db.database import AsyncSessionLocal
from db.models import Transaction
from schemas.schemas import DriftReport, DriftFeature

logger = logging.getLogger(__name__)

class DriftDetectionService:
    def __init__(self, reference_data: pd.DataFrame):
        self.reference_data = reference_data

    def check_drift(self, current_data: pd.DataFrame) -> dict:
        results = {}
        drifted_features = []
        for col in self.reference_data.columns:
            if col in current_data.columns:
                stat, p_value = ks_2samp(
                    self.reference_data[col].dropna(),
                    current_data[col].dropna()
                )
                drifted = p_value < 0.05
                results[col] = {
                    "drifted": drifted,
                    "p_value": round(float(p_value), 4),
                    "ks_statistic": round(float(stat), 4)
                }
                if drifted:
                    drifted_features.append(col)
        return {
            "drift_detected": len(drifted_features) > 0,
            "drifted_features": drifted_features,
            "drift_score": round(len(drifted_features) / len(results) * 100, 2) if results else 0.0,
            "feature_results": results
        }

class MonitoringService:
    """Wrapper to handle database fetching and drift report formatting."""
    
    async def run_drift_check(self, db: AsyncSession | None = None) -> DriftReport:
        session = db
        close_session = False
        if session is None:
            session = AsyncSessionLocal()
            close_session = True

        try:
            # For simplicity, reference_data = oldest 200, current_data = newest 200
            result_ref = await session.execute(
                select(Transaction).order_by(Transaction.created_at.asc()).limit(200)
            )
            ref_txns = result_ref.scalars().all()
            
            result_cur = await session.execute(
                select(Transaction).order_by(Transaction.created_at.desc()).limit(200)
            )
            cur_txns = result_cur.scalars().all()

            if len(ref_txns) < 50 or len(cur_txns) < 50:
                return DriftReport(
                    overall_drift_score=0.0,
                    is_drift_detected=False,
                    total_features=0,
                    drifted_features_count=0,
                    drifted_features=[],
                    checked_at=datetime.now(timezone.utc).isoformat()
                )

            # Build dataframes
            def to_df(txns):
                data = {f"v{i}": [getattr(t, f"v{i}") for t in txns] for i in range(1, 29)}
                data["amount"] = [t.amount for t in txns]
                data["hour_of_day"] = [t.hour_of_day for t in txns]
                return pd.DataFrame(data)

            ref_df = to_df(ref_txns)
            cur_df = to_df(cur_txns)

            detector = DriftDetectionService(reference_data=ref_df)
            drift_results = detector.check_drift(current_data=cur_df)

            features = []
            for feat, stats in drift_results["feature_results"].items():
                features.append(
                    DriftFeature(
                        feature_name=feat,
                        drift_score=stats["p_value"],
                        is_drifted=stats["drifted"]
                    )
                )

            return DriftReport(
                overall_drift_score=drift_results["drift_score"],
                is_drift_detected=drift_results["drift_detected"],
                total_features=len(drift_results["feature_results"]),
                drifted_features_count=len(drift_results["drifted_features"]),
                drifted_features=features,
                checked_at=datetime.now(timezone.utc).isoformat()
            )
        finally:
            if close_session and session:
                await session.close()

monitoring_service = MonitoringService()
