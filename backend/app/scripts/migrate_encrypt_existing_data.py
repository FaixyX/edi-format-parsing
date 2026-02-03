"""
Migration script to encrypt existing unencrypted data.

This script should be run ONCE after deploying the encryption feature.
It will:
1. Encrypt all existing agency credentials (username, password, link)
2. Encrypt all existing EDI file data in background_tasks
3. Encrypt all existing patient data in background_tasks params
4. Encrypt all existing PDF data in form_submissions
5. Encrypt all existing assessment data in form_submissions

The script is idempotent - it detects already-encrypted data and skips it.

Usage:
    python -m app.scripts.migrate_encrypt_existing_data

Or from the backend directory:
    python -c "from app.scripts.migrate_encrypt_existing_data import run_migration; run_migration()"
"""

import logging
import sys
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


def run_migration(dry_run: bool = False):
    """
    Run the encryption migration for all existing data.

    Args:
        dry_run: If True, don't actually encrypt data, just report what would be done.
    """
    from app.db.session import SessionLocal
    from app.services.crypto import get_phi_encryption_service, ENCRYPTED_PREFIX
    from app.models.agency import Agency
    from app.models.background_task import BackgroundTask
    from app.models.form_submission import FormSubmission

    # Initialize encryption service
    try:
        phi_crypto = get_phi_encryption_service()
        logger.info("✅ Encryption service initialized")
    except Exception as e:
        logger.error(f"❌ Failed to initialize encryption service: {e}")
        logger.error("Make sure HIPAA_KEK_HEX or DEV_KMS_FALLBACK_KEY is set")
        return False

    db = SessionLocal()
    stats = {
        "agencies_total": 0,
        "agencies_encrypted": 0,
        "agencies_skipped": 0,
        "tasks_total": 0,
        "tasks_edi_encrypted": 0,
        "tasks_params_encrypted": 0,
        "tasks_skipped": 0,
        "submissions_total": 0,
        "submissions_pdf_encrypted": 0,
        "submissions_assessment_encrypted": 0,
        "submissions_skipped": 0,
        "errors": 0,
    }

    try:
        mode = "DRY RUN" if dry_run else "LIVE"
        logger.info(f"🚀 Starting encryption migration ({mode})...")

        # =========================================================================
        # 1. Migrate Agencies
        # =========================================================================
        logger.info("\n📦 Migrating Agency credentials...")
        agencies = db.query(Agency).all()
        stats["agencies_total"] = len(agencies)

        for agency in agencies:
            try:
                needs_encryption = False

                # Check if any field needs encryption
                if agency.username and not agency.username.startswith(ENCRYPTED_PREFIX):
                    needs_encryption = True
                if agency.password and not agency.password.startswith(ENCRYPTED_PREFIX):
                    needs_encryption = True
                if agency.link and not agency.link.startswith(ENCRYPTED_PREFIX):
                    needs_encryption = True

                if not needs_encryption:
                    stats["agencies_skipped"] += 1
                    continue

                if not dry_run:
                    # Encrypt fields
                    if agency.username and not agency.username.startswith(
                        ENCRYPTED_PREFIX
                    ):
                        agency.username = phi_crypto.encrypt_agency_username(
                            agency.username
                        )
                    if agency.password and not agency.password.startswith(
                        ENCRYPTED_PREFIX
                    ):
                        agency.password = phi_crypto.encrypt_agency_password(
                            agency.password
                        )
                    if agency.link and not agency.link.startswith(ENCRYPTED_PREFIX):
                        agency.link = phi_crypto.encrypt_agency_link(agency.link)

                stats["agencies_encrypted"] += 1
                logger.info(f"  ✓ Agency '{agency.name}' ({agency.id})")

            except Exception as e:
                stats["errors"] += 1
                logger.error(f"  ✗ Agency '{agency.name}' ({agency.id}): {e}")

        if not dry_run:
            db.commit()
            logger.info(f"✅ Committed {stats['agencies_encrypted']} agency updates")

        # =========================================================================
        # 2. Migrate BackgroundTasks (EDI data)
        # =========================================================================
        logger.info("\n📦 Migrating BackgroundTask EDI data...")
        tasks = db.query(BackgroundTask).all()
        stats["tasks_total"] = len(tasks)

        for task in tasks:
            try:
                edi_needs_encryption = False
                params_need_encryption = False
                result_needs_encryption = False

                # Check EDI file data
                if task.edi_file_data and not task.edi_file_data.startswith(
                    ENCRYPTED_PREFIX
                ):
                    edi_needs_encryption = True

                # Check params.edi_patients
                if task.params and isinstance(task.params, dict):
                    edi_patients = task.params.get("edi_patients")
                    if edi_patients and isinstance(edi_patients, list):
                        params_need_encryption = True

                # Check result_data.validation_results (contains patient_name)
                if task.result_data and isinstance(task.result_data, dict):
                    validation_results = task.result_data.get("validation_results")
                    if validation_results and isinstance(validation_results, list):
                        result_needs_encryption = True

                if (
                    not edi_needs_encryption
                    and not params_need_encryption
                    and not result_needs_encryption
                ):
                    stats["tasks_skipped"] += 1
                    continue

                if not dry_run:
                    # Encrypt EDI file data
                    if edi_needs_encryption:
                        task.edi_file_data = phi_crypto.encrypt_edi_file(
                            task.edi_file_data
                        )
                        stats["tasks_edi_encrypted"] += 1

                    # Encrypt params.edi_patients
                    if params_need_encryption:
                        encrypted_params = phi_crypto.encrypt_task_params(task.params)
                        task.params = encrypted_params
                        stats["tasks_params_encrypted"] += 1

                    # Encrypt result_data.validation_results
                    if result_needs_encryption:
                        from app.services.background_task_service import (
                            _encrypt_result_data,
                        )

                        task.result_data = _encrypt_result_data(task.result_data)
                        stats["tasks_result_encrypted"] = (
                            stats.get("tasks_result_encrypted", 0) + 1
                        )
                else:
                    if edi_needs_encryption:
                        stats["tasks_edi_encrypted"] += 1
                    if params_need_encryption:
                        stats["tasks_params_encrypted"] += 1
                    if result_needs_encryption:
                        stats["tasks_result_encrypted"] = (
                            stats.get("tasks_result_encrypted", 0) + 1
                        )

                logger.info(f"  ✓ Task {task.task_id}")

            except Exception as e:
                stats["errors"] += 1
                logger.error(f"  ✗ Task {task.task_id}: {e}")

        if not dry_run:
            db.commit()
            logger.info(
                f"✅ Committed task updates (EDI: {stats['tasks_edi_encrypted']}, Params: {stats['tasks_params_encrypted']})"
            )

        # =========================================================================
        # 3. Migrate FormSubmissions (PDF and assessment data)
        # =========================================================================
        logger.info("\n📦 Migrating FormSubmission data...")
        submissions = db.query(FormSubmission).all()
        stats["submissions_total"] = len(submissions)

        for submission in submissions:
            try:
                pdf_needs_encryption = False
                assessment_needs_encryption = False

                # Check PDF file data
                if (
                    submission.pdf_file_data
                    and not submission.pdf_file_data.startswith(ENCRYPTED_PREFIX)
                ):
                    pdf_needs_encryption = True

                # Check assessment data (if stored as JSON string that's not encrypted)
                if submission.new_assessment_data:
                    if isinstance(submission.new_assessment_data, dict):
                        assessment_needs_encryption = True
                    elif isinstance(submission.new_assessment_data, str):
                        if not submission.new_assessment_data.startswith(
                            ENCRYPTED_PREFIX
                        ):
                            assessment_needs_encryption = True

                if not pdf_needs_encryption and not assessment_needs_encryption:
                    stats["submissions_skipped"] += 1
                    continue

                if not dry_run:
                    # Encrypt PDF file data
                    if pdf_needs_encryption:
                        submission.pdf_file_data = phi_crypto.encrypt_pdf_file(
                            submission.pdf_file_data
                        )
                        stats["submissions_pdf_encrypted"] += 1

                    # Encrypt assessment data
                    if assessment_needs_encryption:
                        submission.new_assessment_data = (
                            phi_crypto.encrypt_assessment_data(
                                submission.new_assessment_data
                            )
                        )
                        stats["submissions_assessment_encrypted"] += 1
                else:
                    if pdf_needs_encryption:
                        stats["submissions_pdf_encrypted"] += 1
                    if assessment_needs_encryption:
                        stats["submissions_assessment_encrypted"] += 1

                logger.info(f"  ✓ Submission {submission.id}")

            except Exception as e:
                stats["errors"] += 1
                logger.error(f"  ✗ Submission {submission.id}: {e}")

        if not dry_run:
            db.commit()
            logger.info(
                f"✅ Committed submission updates (PDF: {stats['submissions_pdf_encrypted']}, Assessment: {stats['submissions_assessment_encrypted']})"
            )

        # =========================================================================
        # Summary
        # =========================================================================
        logger.info("\n" + "=" * 60)
        logger.info("📊 MIGRATION SUMMARY")
        logger.info("=" * 60)
        logger.info(f"Mode: {mode}")
        logger.info(f"")
        logger.info(f"Agencies:")
        logger.info(f"  Total: {stats['agencies_total']}")
        logger.info(f"  Encrypted: {stats['agencies_encrypted']}")
        logger.info(f"  Skipped (already encrypted): {stats['agencies_skipped']}")
        logger.info(f"")
        logger.info(f"Background Tasks:")
        logger.info(f"  Total: {stats['tasks_total']}")
        logger.info(f"  EDI files encrypted: {stats['tasks_edi_encrypted']}")
        logger.info(f"  Params encrypted: {stats['tasks_params_encrypted']}")
        logger.info(
            f"  Result data encrypted: {stats.get('tasks_result_encrypted', 0)}"
        )
        logger.info(f"  Skipped (already encrypted): {stats['tasks_skipped']}")
        logger.info(f"")
        logger.info(f"Form Submissions:")
        logger.info(f"  Total: {stats['submissions_total']}")
        logger.info(f"  PDFs encrypted: {stats['submissions_pdf_encrypted']}")
        logger.info(
            f"  Assessments encrypted: {stats['submissions_assessment_encrypted']}"
        )
        logger.info(f"  Skipped (already encrypted): {stats['submissions_skipped']}")
        logger.info(f"")
        logger.info(f"Errors: {stats['errors']}")
        logger.info("=" * 60)

        if stats["errors"] > 0:
            logger.warning("⚠️ Migration completed with errors. Please review the logs.")
            return False

        if dry_run:
            logger.info(
                "✅ Dry run completed. Run with dry_run=False to apply changes."
            )
        else:
            logger.info("✅ Migration completed successfully!")

        return True

    except Exception as e:
        logger.error(f"❌ Migration failed: {e}")
        db.rollback()
        return False
    finally:
        db.close()


def main():
    """Main entry point for command line usage."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Migrate existing data to encrypted format for HIPAA compliance"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be encrypted without making changes",
    )
    parser.add_argument("--force", action="store_true", help="Skip confirmation prompt")

    args = parser.parse_args()

    if not args.dry_run and not args.force:
        print("\n⚠️  WARNING: This will encrypt existing data in the database.")
        print("Make sure you have a backup before proceeding.")
        print("")
        confirm = input("Type 'encrypt' to continue: ")
        if confirm.lower() != "encrypt":
            print("Aborted.")
            sys.exit(1)

    success = run_migration(dry_run=args.dry_run)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
