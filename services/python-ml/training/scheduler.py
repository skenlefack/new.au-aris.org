"""
ARIS 4.0 - ML Training Scheduler
Runs nightly training at 02:00 UTC with retry at 03:00 on failure.
"""

import logging
import os
import sys
import time
from datetime import datetime

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger

from .trainer import train_all_models

logger = logging.getLogger("aris.ml.scheduler")

# Configuration
TRAINING_HOUR = int(os.getenv("ML_TRAINING_HOUR", "2"))       # 02:00 UTC
RETRY_HOUR = int(os.getenv("ML_RETRY_HOUR", "3"))             # 03:00 UTC retry
MAX_RETRIES = int(os.getenv("ML_MAX_RETRIES", "1"))
ALERT_WEBHOOK_URL = os.getenv("ML_ALERT_WEBHOOK_URL", "")     # Slack/Teams webhook


def send_alert(message: str):
    """Send alert via webhook (Slack, Teams, etc.) on training failure."""
    if not ALERT_WEBHOOK_URL:
        logger.warning("No alert webhook configured, skipping alert: %s", message)
        return

    try:
        import httpx

        payload = {
            "text": f"[ARIS ML Training] {message}",
            "timestamp": datetime.utcnow().isoformat(),
        }
        response = httpx.post(ALERT_WEBHOOK_URL, json=payload, timeout=10)
        response.raise_for_status()
        logger.info("Alert sent successfully")
    except Exception as exc:
        logger.error("Failed to send alert: %s", exc)


def nightly_training_job():
    """
    Main nightly training job.
    Trains all registered models. On failure, schedules a single retry.
    """
    run_id = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    logger.info("=== Nightly training run started: %s ===", run_id)

    try:
        results = train_all_models(triggered_by="SCHEDULE")

        failed = [r for r in results if r["status"] == "FAILED"]
        succeeded = [r for r in results if r["status"] == "COMPLETED"]

        if failed:
            failed_codes = [r.get("model_code", "?") for r in failed]
            msg = (
                f"Training run {run_id}: {len(succeeded)} OK, {len(failed)} FAILED. "
                f"Failed models: {', '.join(failed_codes)}"
            )
            logger.warning(msg)
            send_alert(msg)
            return False
        else:
            logger.info(
                "Training run %s completed: %d models trained successfully",
                run_id,
                len(succeeded),
            )
            return True

    except Exception as exc:
        msg = f"Training run {run_id} crashed: {exc}"
        logger.error(msg, exc_info=True)
        send_alert(msg)
        return False


def retry_training_job():
    """
    Retry job at 03:00 UTC. Only trains models that are in FAILED status.
    If still failing, sends a final alert (no further retries).
    """
    logger.info("=== Retry training run started ===")

    try:
        from .trainer import get_registered_models, train_model

        failed_models = get_registered_models(status_filter=["FAILED"])

        if not failed_models:
            logger.info("No failed models to retry")
            return

        logger.info("Retrying %d failed models", len(failed_models))

        results = []
        for model_record in failed_models:
            result = train_model(model_record, triggered_by="SCHEDULE")
            result["model_code"] = model_record["code"]
            results.append(result)

        still_failed = [r for r in results if r["status"] == "FAILED"]
        if still_failed:
            codes = [r.get("model_code", "?") for r in still_failed]
            msg = (
                f"RETRY ALSO FAILED for {len(still_failed)} models: {', '.join(codes)}. "
                "Manual intervention required."
            )
            logger.error(msg)
            send_alert(msg)
        else:
            logger.info("All retried models succeeded on retry")

    except Exception as exc:
        msg = f"Retry training crashed: {exc}"
        logger.error(msg, exc_info=True)
        send_alert(msg)


def start_scheduler():
    """Start the blocking scheduler with nightly training + retry jobs."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(name)s] %(levelname)s %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    logger.info(
        "ML Training Scheduler starting: training at %02d:00 UTC, retry at %02d:00 UTC",
        TRAINING_HOUR,
        RETRY_HOUR,
    )

    scheduler = BlockingScheduler(timezone="UTC")

    # Nightly training at 02:00 UTC
    scheduler.add_job(
        nightly_training_job,
        trigger=CronTrigger(hour=TRAINING_HOUR, minute=0),
        id="nightly_training",
        name="ARIS ML Nightly Training",
        misfire_grace_time=3600,  # 1 hour grace
        max_instances=1,
    )

    # Retry at 03:00 UTC
    scheduler.add_job(
        retry_training_job,
        trigger=CronTrigger(hour=RETRY_HOUR, minute=0),
        id="retry_training",
        name="ARIS ML Training Retry",
        misfire_grace_time=3600,
        max_instances=1,
    )

    logger.info("Scheduler configured. Waiting for next run...")

    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        logger.info("Scheduler shutting down")
        scheduler.shutdown()


if __name__ == "__main__":
    start_scheduler()
