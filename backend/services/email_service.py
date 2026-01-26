"""
Email service for sending emails (password reset codes, notifications, etc.)
"""
import asyncio
import logging
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from core.config import settings

logger = logging.getLogger(__name__)

# Retry configuration
MAX_RETRIES = 3
RETRY_DELAY = 2  # seconds


async def send_email(
    to_email: str,
    subject: str,
    body_html: str,
    body_text: str | None = None,
) -> bool:
    """
    Send an email asynchronously with retry logic.
    
    Args:
        to_email: Recipient email address
        subject: Email subject
        body_html: HTML body content
        body_text: Plain text body (optional, will strip HTML if not provided)
    
    Returns:
        True if email sent successfully, False otherwise
    """
    if not settings.SMTP_HOST or not settings.SMTP_USER:
        logger.warning(f"SMTP not configured. Would send to {to_email}: {subject}")
        return False

    message = MIMEMultipart("alternative")
    message["From"] = settings.SMTP_FROM_EMAIL or settings.SMTP_USER
    message["To"] = to_email
    message["Subject"] = subject

    # Add plain text version
    if body_text:
        message.attach(MIMEText(body_text, "plain"))
    
    # Add HTML version
    message.attach(MIMEText(body_html, "html"))

    # Retry logic
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            logger.info(f"Sending email to {to_email} (attempt {attempt}/{MAX_RETRIES})")
            await aiosmtplib.send(
                message,
                hostname=settings.SMTP_HOST,
                port=settings.SMTP_PORT,
                username=settings.SMTP_USER,
                password=settings.SMTP_PASSWORD,
                use_tls=settings.SMTP_USE_TLS,
                start_tls=settings.SMTP_START_TLS,
                timeout=10,  # 10 second timeout
            )
            logger.info(f"Email sent successfully to {to_email}")
            return True
        except aiosmtplib.SMTPException as e:
            logger.error(f"SMTP error sending to {to_email} (attempt {attempt}/{MAX_RETRIES}): {e}")
            if attempt < MAX_RETRIES:
                await asyncio.sleep(RETRY_DELAY)
        except TimeoutError:
            logger.error(f"Timeout sending email to {to_email} (attempt {attempt}/{MAX_RETRIES})")
            if attempt < MAX_RETRIES:
                await asyncio.sleep(RETRY_DELAY)
        except Exception as e:
            logger.exception(f"Unexpected error sending email to {to_email} (attempt {attempt}/{MAX_RETRIES}): {e}")
            if attempt < MAX_RETRIES:
                await asyncio.sleep(RETRY_DELAY)
    
    logger.error(f"Failed to send email to {to_email} after {MAX_RETRIES} attempts")
    return False


async def send_password_reset_code(to_email: str, code: str, user_name: str | None = None) -> bool:
    """
    Send password reset verification code to user's email.
    
    Args:
        to_email: User's email address
        code: 6-character verification code
        user_name: User's name (optional, for personalization)
    
    Returns:
        True if email sent successfully, False otherwise
    """
    greeting = f"Hi {user_name}," if user_name else "Hi,"
    
    subject = f"NavigateChat: Password Reset Code"
    
    body_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .code-box {{ 
                background-color: #f4f4f4; 
                border: 2px dashed #007bff; 
                border-radius: 8px;
                padding: 20px; 
                text-align: center; 
                margin: 20px 0;
            }}
            .code {{ 
                font-size: 32px; 
                font-weight: bold; 
                letter-spacing: 8px; 
                color: #007bff;
            }}
            .warning {{ color: #dc3545; font-size: 14px; }}
            .footer {{ margin-top: 30px; font-size: 12px; color: #666; }}
        </style>
    </head>
    <body>
        <div class="container">
            <h2>Password Reset Request</h2>
            <p>{greeting}</p>
            <p>We received a request to reset your password. Use the verification code below to proceed:</p>
            
            <div class="code-box">
                <div class="code">{code}</div>
            </div>
            
            <p>This code will expire in <strong>10 minutes</strong>.</p>
            
            <p class="warning">If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
            
            <div class="footer">
                <p>This is an automated message.</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    body_text = f"""
{greeting}

We received a request to reset your password.

Your verification code is: {code}

This code will expire in 10 minutes.

If you didn't request a password reset, please ignore this email.

- NavigateChat Team
    """
    
    return await send_email(
        to_email=to_email,
        subject=subject,
        body_html=body_html,
        body_text=body_text,
    )

