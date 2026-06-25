"""
Background transaction simulator for the SentriQ system.

Generates realistic fake transactions and runs them through the ML model
at a configurable interval (default: every 8 seconds). This keeps the
dashboard live with fresh data without manual API calls.

Fraud injection strategy:
    - Base fraud rate: 0.3%
    - Spike to 5% between hours 2–4 AM (simulating real-world patterns)
"""

import logging
import uuid
import random
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import AsyncSessionLocal
from db.models import Transaction, Prediction
from services.live_feed import live_feed_manager
from services.model_service import model_service

logger = logging.getLogger(__name__)


class SimulatorService:
    """
    Generates and processes simulated credit card transactions.

    Uses creditcard.csv to draw realistic samples.
    """

    def __init__(self):
        self.transactions_generated = 0
        self.df_legit = None
        self.df_fraud = None
        self._load_data()

    def _load_data(self):
        csv_path = Path("..") / "creditcard.csv" if Path("..", "creditcard.csv").exists() else Path("creditcard.csv")
        if csv_path.exists():
            logger.info(f"Simulator loading data from {csv_path}")
            try:
                df = pd.read_csv(csv_path)
                self.df_fraud = df[df["Class"] == 1].copy()
                self.df_legit = df[df["Class"] == 0].copy()
            except Exception as e:
                logger.error(f"Simulator failed to load CSV: {e}")
                self.df_legit = None
                self.df_fraud = None

    def _generate_transaction(self) -> dict:
        """
        Generate a single realistic fake transaction.
        """
        current_hour = datetime.now(timezone.utc).hour
        is_fraud_injection = self._should_inject_fraud(current_hour)

        if self.df_legit is not None and self.df_fraud is not None:
            if is_fraud_injection and not self.df_fraud.empty:
                sample = self.df_fraud.sample(1).iloc[0]
            else:
                sample = self.df_legit.sample(1).iloc[0]

            txn = {
                "txn_id": f"tx_{uuid.uuid4().hex[:8]}",
                "time": float(sample["Time"]),
                "amount": float(sample["Amount"]),
                "hour_of_day": current_hour,
            }
            for i in range(1, 29):
                txn[f"v{i}"] = float(sample[f"V{i}"])
            return txn
        else:
            # Fallback to pure synthetic
            amount = round(float(np.random.lognormal(mean=3.5, sigma=1.2)), 2)
            amount = min(max(amount, 1.0), 5000.0)
            txn = {
                "txn_id": f"tx_{uuid.uuid4().hex[:8]}",
                "time": float(np.random.randint(0, 100000)),
                "amount": amount,
                "hour_of_day": current_hour,
            }
            for i in range(1, 29):
                txn[f"v{i}"] = round(float(np.random.normal(0, 1.0)), 4)
            
            if is_fraud_injection:
                txn["amount"] = round(float(np.random.uniform(800, 4500)), 2)
                txn["v1"] = round(float(np.random.normal(-3.0, 1.0)), 4)
                txn["v3"] = round(float(np.random.normal(2.5, 1.0)), 4)
                
            return txn

    def _should_inject_fraud(self, hour: int) -> bool:
        base_rate = 0.003
        if 2 <= hour <= 4:
            base_rate = 0.05
        return random.random() < base_rate

    async def simulate_transaction(self):
        try:
            txn_data = self._generate_transaction()

            features = {
                "time": txn_data["time"],
                "amount": txn_data["amount"],
                "hour_of_day": txn_data["hour_of_day"],
            }
            for i in range(1, 29):
                features[f"v{i}"] = txn_data[f"v{i}"]
                
            prediction = model_service.predict(features)

            async with AsyncSessionLocal() as session:
                async with session.begin():
                    txn = Transaction(
                        txn_id=txn_data["txn_id"],
                        time_elapsed=txn_data["time"],
                        amount=txn_data["amount"],
                        hour_of_day=txn_data["hour_of_day"],
                    )
                    for i in range(1, 29):
                        setattr(txn, f"v{i}", txn_data[f"v{i}"])
                        
                    session.add(txn)
                    await session.flush()

                    pred = Prediction(
                        txn_id=txn_data["txn_id"],
                        is_fraud=prediction["is_fraud"],
                        confidence_score=prediction["confidence_score"],
                        risk_score=prediction["risk_score"],
                        model_version=prediction["model_version"],
                        processing_time_ms=prediction["processing_time_ms"],
                    )
                    session.add(pred)

            self.transactions_generated += 1
            await live_feed_manager.broadcast({
                "txn_id": txn_data["txn_id"],
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "amount": txn_data["amount"],
                "confidence_score": prediction["confidence_score"],
                "risk_score": prediction["risk_score"],
                "status": "Fraud" if prediction["is_fraud"] else "Legit",
                "model_version": prediction["model_version"],
            })
            status_str = "🔴 FRAUD" if prediction["is_fraud"] else "🟢 Legit"
            logger.debug(
                f"Simulated txn {txn_data['txn_id']} | "
                f"${txn_data['amount']:,.2f} | {status_str} | "
                f"conf={prediction['confidence_score']:.3f} | "
                f"total_generated={self.transactions_generated}"
            )

        except Exception as e:
            logger.error(f"❌ Simulator error: {e}", exc_info=True)


# ─── Global singleton instance ───
simulator_service = SimulatorService()
