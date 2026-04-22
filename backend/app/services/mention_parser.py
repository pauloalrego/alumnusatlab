import logging
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session

from ..models import Professor, ProfessorGroup, Researcher, User
from ..slug import slugify

logger = logging.getLogger(__name__)


def extract_mentions(html: str) -> list[dict]:
    """Retorna lista de {'id': slug, 'email': str|None} a partir do HTML do TipTap."""
    soup = BeautifulSoup(html, "html.parser")
    seen, result = set(), []
    for span in soup.find_all(attrs={"data-type": "mention"}):
        mid = (span.get("data-id") or "").strip()
        email = span.get("data-email") or None
        if mid and mid not in seen:
            seen.add(mid)
            result.append({"id": mid, "email": email})
    return result


def resolve_mention_emails(
    db: Session,
    mentions: list[dict],
    group_id: int | None,
    author_email: str | None,
) -> set[str]:
    """Converte lista de menções em emails únicos, excluindo o autor."""
    emails: set[str] = set()
    for m in mentions:
        if m["id"] == "todos":
            if group_id:
                emails.update(_group_emails(db, group_id))
        elif m["email"]:
            emails.add(m["email"])
        else:
            # Professor mencionado sem email embedado — resolve por slug
            email = _professor_email_by_slug(db, m["id"])
            if email:
                emails.add(email)
    if author_email:
        emails.discard(author_email)
    return emails


def _group_emails(db: Session, group_id: int) -> list[str]:
    researcher_emails = (
        db.query(User.email)
        .join(Researcher, User.researcher_id == Researcher.id)
        .filter(Researcher.group_id == group_id, User.ativo == True)
        .all()
    )
    professor_emails = (
        db.query(User.email)
        .join(Professor, User.professor_id == Professor.id)
        .join(ProfessorGroup, ProfessorGroup.professor_id == Professor.id)
        .filter(ProfessorGroup.group_id == group_id, User.ativo == True)
        .all()
    )
    return [row[0] for row in researcher_emails + professor_emails if row[0]]


def _professor_email_by_slug(db: Session, slug: str) -> str | None:
    users = (
        db.query(User)
        .join(Professor, User.professor_id == Professor.id)
        .filter(User.ativo == True)
        .all()
    )
    for u in users:
        if slugify(u.nome) == slug:
            return u.email
    return None
