"""
In-memory store for password reset verification codes.
Codes expire after a configurable time and are cleaned up automatically.
"""
import logging
import secrets
import string
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class ResetCodeEntry:
    email: str
    code: str
    created_at: datetime
    expires_at: datetime
    verified: bool = False


class PasswordResetStore:
    """
    In-memory store for managing password reset verification codes.
    Codes are 6 characters (alphanumeric) and expire after a configurable time.
    """

    def __init__(self, expiry_minutes: int = 10):
        self._store: Dict[str, ResetCodeEntry] = {}  # email -> ResetCodeEntry
        self._code_to_email: Dict[str, str] = {}  # code -> email (for quick lookup)
        self.expiry_minutes = expiry_minutes

    def _generate_code(self) -> str:
        """Generate a 6-character alphanumeric code (uppercase for clarity)."""
        characters = string.ascii_uppercase + string.digits
        # Remove ambiguous characters (0, O, I, 1, L)
        characters = characters.replace("0", "").replace("O", "").replace("I", "").replace("1", "").replace("L", "")
        return "".join(secrets.choice(characters) for _ in range(6))

    def _cleanup_expired(self) -> None:
        """Remove expired entries."""
        now = datetime.now(timezone.utc)
        expired_emails = [
            email for email, entry in self._store.items() if entry.expires_at < now
        ]
        for email in expired_emails:
            entry = self._store.pop(email, None)
            if entry:
                self._code_to_email.pop(entry.code, None)
                logger.info(f"Cleaned up expired code for {email}")

    def create_reset_code(self, email: str) -> str:
        """
        Create a new reset code for the given email.
        If a code already exists for this email, it will be replaced.
        """
        self._cleanup_expired()

        # Remove existing code for this email if any
        if email in self._store:
            old_entry = self._store.pop(email)
            self._code_to_email.pop(old_entry.code, None)

        # Generate new code (ensure uniqueness)
        code = self._generate_code()
        while code in self._code_to_email:
            code = self._generate_code()

        now = datetime.now(timezone.utc)
        entry = ResetCodeEntry(
            email=email,
            code=code,
            created_at=now,
            expires_at=now + timedelta(minutes=self.expiry_minutes),
            verified=False,
        )

        self._store[email] = entry
        self._code_to_email[code] = email
        logger.info(f"Created reset code for {email}")

        return code

    def verify_code(self, email: str, code: str) -> bool:
        """
        Verify the code for the given email.
        Returns True if valid, False otherwise.
        Marks the code as verified if successful.
        """
        self._cleanup_expired()

        entry = self._store.get(email)
        if not entry:
            logger.warning(f"No reset code found for {email}")
            return False

        if entry.code.upper() != code.upper():
            logger.warning(f"Invalid code for {email}")
            return False

        if entry.expires_at < datetime.now(timezone.utc):
            logger.warning(f"Expired reset code for {email}")
            return False

        # Mark as verified
        entry.verified = True
        logger.info(f"Code verified for {email}")
        return True

    def consume_verified(self, email: str) -> bool:
        """
        Check if email is verified and remove the entry.
        Returns True if was verified, False otherwise.
        Used when actually resetting the password.
        """
        self._cleanup_expired()
        entry = self._store.get(email)
        if entry and entry.verified:
            self._store.pop(email, None)
            self._code_to_email.pop(entry.code, None)
            logger.info(f"Consumed verified code for {email}")
            return True
        return False

    def get_email_by_code(self, code: str) -> Optional[str]:
        """Get email associated with a code (for verification endpoint)."""
        self._cleanup_expired()
        return self._code_to_email.get(code.upper())


# Global instance
password_reset_store = PasswordResetStore(expiry_minutes=10)
