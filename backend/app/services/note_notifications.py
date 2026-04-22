import asyncio
import logging
from sqlalchemy.orm import Session

from ..models import Researcher, User
from ..slug import slugify
from .mention_parser import extract_mentions, resolve_mention_emails
from .email_service import send_email
from .email_templates import note_created_html, mention_html

logger = logging.getLogger(__name__)


def send_note_notifications(
    note_html: str,
    profile_user_id: int,
    author_email: str | None,
    author_name: str,
    SessionLocal,
) -> None:
    db: Session = SessionLocal()
    try:
        profile_user = db.query(User).get(profile_user_id)
        if not profile_user:
            return

        profile_name = profile_user.nome
        profile_slug = slugify(profile_name)
        profile_email = profile_user.email

        researcher = db.query(Researcher).filter(
            Researcher.id == profile_user.researcher_id
        ).first() if profile_user.researcher_id else None
        group_id = researcher.group_id if researcher else None

        mentions = extract_mentions(note_html)
        mention_emails = resolve_mention_emails(db, mentions, group_id, author_email)

        tasks = []

        # Dono do perfil — recebe se não for o autor e não foi mencionado explicitamente
        if profile_email and profile_email != author_email and profile_email not in mention_emails:
            tasks.append((
                profile_email,
                "Nova anotação no seu perfil",
                note_created_html(author_name, note_html, profile_slug),
            ))

        # Mencionados
        for email in mention_emails:
            tasks.append((
                email,
                "Oba! Você foi marcado no Alumnus!",
                mention_html(author_name, note_html, profile_name, profile_slug),
            ))

        if tasks:
            asyncio.run(_send_all(tasks))
    except Exception:
        logger.exception("Erro ao enviar notificações de nota")
    finally:
        db.close()


async def _send_all(tasks: list[tuple]) -> None:
    await asyncio.gather(*[send_email(to, subject, html) for to, subject, html in tasks])
