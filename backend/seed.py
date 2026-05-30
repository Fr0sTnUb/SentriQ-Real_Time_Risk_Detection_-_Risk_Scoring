"""
Seed script for the SentriQ system.

Populates the database with:
    - 2 users (admin + viewer)
    - 500 historical transactions with predictions (spread over last 48 hours)
    - 1 initial model_metrics entry

Safe to run multiple times — checks for existing data before inserting.

Usage:
    cd backend
    python seed.py
"""

import asyncio
import uuid
import random
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, func

from db.database import engine, AsyncSessionLocal, init_db
from db.models import User, Transaction, Prediction, ModelMetric
from auth.jwt import hash_password
from services.model_service import model_service


async def seed():
    """Main seed function."""
    print("=" * 60)
    print(" SentriQ - Database Seed Script")
    print("=" * 60)

    # Initialize tables
    await init_db()

    # Load model for predictions
    model_service.load()

    async with AsyncSessionLocal() as session:
        async with session.begin():
            # ─── Check if data already exists ───
            user_count = (await session.execute(select(func.count(User.id)))).scalar()
            txn_count = (await session.execute(select(func.count(Transaction.id)))).scalar()

            if user_count > 0 and txn_count > 0:
                print("Database already has users and transactions.")
                print("   Skipping seed. Delete existing data first to re-seed.")
                return

            # ─── Seed Users ───
            if user_count == 0:
                admin_user = User(
                    username="admin",
                    hashed_password=hash_password("no123"),
                    role="admin",
                )
                viewer_user = User(
                    username="viewer",
                    hashed_password=hash_password("viewer123"),
                    role="viewer",
                )
                session.add_all([admin_user, viewer_user])
                print("Created users: admin (no123), viewer (viewer123)")

            # ─── Seed Transactions & Predictions ───
            if txn_count == 0:
                print("Generating 500 historical transactions from creditcard.csv...")
                now = datetime.now(timezone.utc)
                
                csv_path = Path("..") / "creditcard.csv" if Path("..", "creditcard.csv").exists() else Path("creditcard.csv")
                
                if csv_path.exists():
                    df = pd.read_csv(csv_path)
                    
                    df_fraud = df[df["Class"] == 1]
                    df_legit = df[df["Class"] == 0]
                    
                    # Take ~15 fraud and 485 legit
                    num_fraud = min(15, len(df_fraud))
                    num_legit = 500 - num_fraud
                    
                    df_sample = pd.concat([
                        df_fraud.sample(num_fraud, random_state=42),
                        df_legit.sample(num_legit, random_state=42)
                    ]).sample(frac=1, random_state=42)
                else:
                    print("creditcard.csv not found, generating synthetic data instead.")
                    df_sample = None

                transactions = []
                predictions = []

                for i in range(500):
                    minutes_ago = random.randint(0, 48 * 60)
                    created_at = now - timedelta(minutes=minutes_ago)
                    txn_id = f"tx_{uuid.uuid4().hex[:8]}"
                    hour = created_at.hour

                    if df_sample is not None:
                        row = df_sample.iloc[i]
                        time_val = float(row["Time"])
                        amount = float(row["Amount"])
                        v_features = {f"v{j}": float(row[f"V{j}"]) for j in range(1, 29)}
                    else:
                        time_val = float(np.random.randint(0, 100000))
                        amount = round(float(np.random.lognormal(mean=3.5, sigma=1.2)), 2)
                        amount = min(max(amount, 1.0), 5000.0)
                        v_features = {f"v{j}": round(float(np.random.normal(0, 1.0)), 4) for j in range(1, 29)}

                    txn = Transaction(
                        txn_id=txn_id,
                        time_elapsed=time_val,
                        amount=amount,
                        hour_of_day=hour,
                        created_at=created_at,
                        **v_features
                    )
                    transactions.append(txn)

                    # Run prediction
                    features = {
                        "time": time_val,
                        "amount": amount,
                        "hour_of_day": hour,
                        **v_features
                    }
                    pred_result = model_service.predict(features)

                    pred = Prediction(
                        txn_id=txn_id,
                        is_fraud=pred_result["is_fraud"],
                        confidence_score=pred_result["confidence_score"],
                        risk_score=pred_result["risk_score"],
                        model_version=pred_result["model_version"],
                        processing_time_ms=pred_result["processing_time_ms"],
                        created_at=created_at,
                    )
                    predictions.append(pred)

                session.add_all(transactions)
                await session.flush()
                session.add_all(predictions)

                fraud_count = sum(1 for p in predictions if p.is_fraud)
                print(f"   Created 500 transactions ({fraud_count} fraud, {500 - fraud_count} legit)")

                # ─── Seed Model Metrics ───
                metric = ModelMetric(
                    model_version=model_service.version,
                    auc_roc=0.962,
                    f1_score=0.884,
                    precision_val=0.921,
                    recall=0.849,
                )
                session.add(metric)
                print("Created initial model metrics entry")

    print("=" * 60)
    print("Seed complete! Start the server with: uvicorn main:app --reload")
    print("=" * 60)

    # Clean up
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
