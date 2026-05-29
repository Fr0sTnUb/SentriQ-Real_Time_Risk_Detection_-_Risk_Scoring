"""
APScheduler job definitions for the FraudGuard ML system.

Scheduled jobs:
    - Every 8 seconds:  Simulate a transaction (keep dashboard live)
    - Every 1 hour:     Compute model metrics on recent predictions
    - Every 6 hours:    Run Evidently drift check
    - Every Sunday at midnight: Full retraining pipeline
"""

import uuid
import asyncio
import logging
from datetime import datetime, timezone
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select, func, and_

from db.database import AsyncSessionLocal
from db.models import Prediction, ModelMetric
from services.model_service import model_service
from services.simulator import simulator_service
from services.monitoring import monitoring_service

logger = logging.getLogger(__name__)

# ─── Retraining job state (in-memory tracker) ───
retrain_jobs: dict = {}


class SchedulerService:
    """
    Manages all APScheduler background jobs for the FraudGuard system.
    """

    def __init__(self):
        self.scheduler = BackgroundScheduler(timezone="UTC")
        self._is_running = False

    def start(self):
        """Register all jobs and start the scheduler."""
        if self._is_running:
            logger.warning("Scheduler is already running.")
            return

        # Job 1: Transaction simulator — every 8 seconds
        self.scheduler.add_job(
            self._run_simulator_job,
            trigger=IntervalTrigger(seconds=8),
            id="simulate_transaction",
            name="Transaction Simulator",
            replace_existing=True,
            max_instances=1,
        )
        logger.info("📅 Scheduled: Transaction simulator (every 8s)")

        # Job 2: Model metrics computation — every 1 hour
        self.scheduler.add_job(
            self._compute_model_metrics_job,
            trigger=IntervalTrigger(hours=1),
            id="compute_model_metrics",
            name="Model Metrics Computation",
            replace_existing=True,
            max_instances=1,
        )
        logger.info("📅 Scheduled: Model metrics computation (every 1h)")

        # Job 3: Drift check — every 6 hours
        self.scheduler.add_job(
            self._run_drift_check_job,
            trigger=IntervalTrigger(hours=6),
            id="drift_check",
            name="Data Drift Check",
            replace_existing=True,
            max_instances=1,
        )
        logger.info("📅 Scheduled: Drift check (every 6h)")

        # Job 4: Retraining pipeline — every Sunday at midnight UTC
        self.scheduler.add_job(
            self._run_retraining_job,
            trigger=CronTrigger(day_of_week="sun", hour=0, minute=0),
            id="weekly_retraining",
            name="Weekly Retraining Pipeline",
            replace_existing=True,
            max_instances=1,
        )
        logger.info("📅 Scheduled: Weekly retraining (Sunday midnight UTC)")

        self.scheduler.start()
        self._is_running = True
        logger.info("✅ APScheduler started with all jobs registered.")

    def stop(self):
        """Gracefully shut down the scheduler."""
        if self._is_running:
            self.scheduler.shutdown(wait=False)
            self._is_running = False
            logger.info("🛑 APScheduler stopped.")

    def _run_simulator_job(self):
        """Sync wrapper for the simulator job."""
        asyncio.run(self._run_simulator())

    async def _run_simulator(self):
        """Execute a single simulation cycle."""
        await simulator_service.simulate_transaction()

    def _compute_model_metrics_job(self):
        """Sync wrapper for metrics computation."""
        asyncio.run(self._compute_model_metrics())

    async def _compute_model_metrics(self):
        """
        Compute model performance metrics on the last 1000 predictions.
        Saves results to the model_metrics table.
        """
        try:
            async with AsyncSessionLocal() as session:
                # Get last 1000 predictions
                result = await session.execute(
                    select(Prediction.is_fraud, Prediction.confidence_score)
                    .order_by(Prediction.created_at.desc())
                    .limit(1000)
                )
                rows = result.all()

                if len(rows) < 50:
                    logger.info("⏭️  Not enough predictions for metrics computation (need >= 50).")
                    return

                # Compute approximate metrics from prediction distribution
                total = len(rows)
                fraud_count = sum(1 for r in rows if r.is_fraud)
                legit_count = total - fraud_count

                # Approximate metrics based on confidence calibration
                avg_confidence = sum(r.confidence_score for r in rows) / total
                fraud_rate = fraud_count / total if total > 0 else 0

                # Simulated metrics (in production, you'd evaluate against ground truth labels)
                precision_val = min(0.99, avg_confidence + 0.02)
                recall_val = min(0.98, avg_confidence)
                f1 = 2 * (precision_val * recall_val) / (precision_val + recall_val) if (precision_val + recall_val) > 0 else 0
                auc_roc = min(0.99, avg_confidence + 0.05)

                async with session.begin():
                    metric = ModelMetric(
                        model_version=model_service.version,
                        auc_roc=round(auc_roc, 4),
                        f1_score=round(f1, 4),
                        precision_val=round(precision_val, 4),
                        recall=round(recall_val, 4),
                    )
                    session.add(metric)

                logger.info(
                    f"📈 Model metrics computed | AUC={auc_roc:.4f} | F1={f1:.4f} | "
                    f"Precision={precision_val:.4f} | Recall={recall_val:.4f} | "
                    f"Based on {total} predictions"
                )

        except Exception as e:
            logger.error(f"❌ Metrics computation failed: {e}", exc_info=True)

    def _run_drift_check_job(self):
        """Sync wrapper for drift check."""
        asyncio.run(self._run_drift_check())

    async def _run_drift_check(self):
        """Execute scheduled drift detection."""
        try:
            report = await monitoring_service.run_drift_check()
            logger.info(
                f"📊 Scheduled drift check | drift_detected={report.is_drift_detected} | "
                f"score={report.overall_drift_score:.4f}"
            )
        except Exception as e:
            logger.error(f"❌ Scheduled drift check failed: {e}", exc_info=True)

    def _run_retraining_job(self):
        """Sync wrapper for retraining."""
        asyncio.run(self._run_retraining(None))

    async def _run_retraining(self, job_id: str | None = None):
        """
        Execute the retraining pipeline.

        In a production system, this would:
        1. Pull labeled data from a data warehouse
        2. Train a new model
        3. Evaluate against a holdout set
        4. Save only if AUC-ROC improves by >= 0.005
        5. Hot-swap the production model

        For this implementation, it simulates the pipeline.
        """
        if job_id is None:
            job_id = str(uuid.uuid4())

        retrain_jobs[job_id] = {
            "status": "running",
            "started_at": datetime.now(timezone.utc).isoformat(),
            "completed_at": None,
            "model_version": None,
            "metrics": None,
        }

        try:
            logger.info(f"🔄 Retraining pipeline started | job_id={job_id}")

            # Simulate training time
            await asyncio.sleep(5)

            # Simulated new model metrics
            new_metrics = {
                "auc_roc": 0.967,
                "f1_score": 0.892,
                "precision": 0.934,
                "recall": 0.855,
            }

            new_version = f"v1.{len(retrain_jobs)}.0"

            # Save metrics to DB
            async with AsyncSessionLocal() as session:
                async with session.begin():
                    metric = ModelMetric(
                        model_version=new_version,
                        auc_roc=new_metrics["auc_roc"],
                        f1_score=new_metrics["f1_score"],
                        precision_val=new_metrics["precision"],
                        recall=new_metrics["recall"],
                    )
                    session.add(metric)

            retrain_jobs[job_id].update({
                "status": "complete",
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "model_version": new_version,
                "metrics": new_metrics,
            })

            logger.info(f"✅ Retraining complete | job_id={job_id} | version={new_version}")

        except Exception as e:
            retrain_jobs[job_id].update({
                "status": "failed",
                "completed_at": datetime.now(timezone.utc).isoformat(),
            })
            logger.error(f"❌ Retraining failed | job_id={job_id} | error={e}", exc_info=True)

    async def trigger_manual_retrain(self) -> dict:
        """
        Trigger a manual retraining job in the background.

        Returns:
            Dict with job_id and status.
        """
        job_id = str(uuid.uuid4())
        retrain_jobs[job_id] = {
            "status": "pending",
            "started_at": datetime.now(timezone.utc).isoformat(),
            "completed_at": None,
            "model_version": None,
            "metrics": None,
        }

        # Run in background
        asyncio.create_task(self._run_retraining(job_id))

        return {
            "job_id": job_id,
            "status": "pending",
            "triggered_at": datetime.now(timezone.utc).isoformat(),
        }

    def get_retrain_status(self, job_id: str) -> dict | None:
        """Get the status of a retraining job."""
        return retrain_jobs.get(job_id)


# ─── Global singleton instance ───
scheduler_service = SchedulerService()
