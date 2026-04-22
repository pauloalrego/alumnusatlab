import asyncio
import logging
import os

import resend

logger = logging.getLogger(__name__)

resend.api_key = os.getenv("RESEND_API_KEY", "")

FROM_ADDRESS = "Alumnus <notificacoes@alumnus.app>"


def _send_sync(to: str, subject: str, html: str) -> None:
    resend.Emails.send({"from": FROM_ADDRESS, "to": to, "subject": subject, "html": html})


async def send_email(to: str, subject: str, html: str) -> None:
    if not resend.api_key:
        logger.warning("RESEND_API_KEY não configurada — e-mail não enviado")
        return
    try:
        await asyncio.to_thread(_send_sync, to, subject, html)
        logger.info("E-mail enviado para %s — %s", to, subject)
    except Exception:
        logger.exception("Falha ao enviar e-mail para %s", to)
