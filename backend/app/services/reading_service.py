import logging
import os

import httpx
from bs4 import BeautifulSoup
from openai import OpenAI
from sqlalchemy.orm import Session, joinedload

from ..models import Reading, ReadingStatusHistory

logger = logging.getLogger(__name__)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL   = os.getenv("OPENAI_MODEL", "gpt-4o-mini")


def list_by_user(db: Session, user_id: int) -> list[Reading]:
    return (
        db.query(Reading)
        .options(
            joinedload(Reading.created_by),
            joinedload(Reading.status_history).joinedload(ReadingStatusHistory.changed_by),
        )
        .filter(Reading.user_id == user_id)
        .order_by(Reading.created_at.desc())
        .all()
    )


def get_by_id(db: Session, reading_id: int) -> Reading | None:
    return db.query(Reading).filter(Reading.id == reading_id).first()


def exists(db: Session, user_id: int, url: str) -> bool:
    return db.query(Reading).filter(
        Reading.user_id == user_id,
        Reading.url == url,
    ).first() is not None


def create(db: Session, user_id: int, url: str, created_by_id: int | None) -> Reading:
    reading = Reading(
        user_id=user_id,
        url=url,
        status="quero_ler",
        created_by_id=created_by_id,
    )
    db.add(reading)
    db.flush()
    _record_history(db, reading.id, "quero_ler", created_by_id)
    db.commit()
    db.refresh(reading)
    return reading


def update_status(db: Session, reading: Reading, new_status: str, changed_by_id: int | None) -> Reading:
    reading.status = new_status
    _record_history(db, reading.id, new_status, changed_by_id)
    db.commit()
    db.refresh(reading)
    return reading


def save_summary(db: Session, reading: Reading, summary: str) -> Reading:
    reading.summary = summary
    db.commit()
    db.refresh(reading)
    return reading


def delete(db: Session, reading: Reading) -> None:
    db.delete(reading)
    db.commit()


def _record_history(db: Session, reading_id: int, status: str, changed_by_id: int | None) -> None:
    db.add(ReadingStatusHistory(
        reading_id=reading_id,
        status=status,
        changed_by_id=changed_by_id,
    ))


# ── Background tasks ──────────────────────────────────────────────────────────

def fetch_and_set_title(reading_id: int, url: str, db_factory) -> None:
    """Chamado como BackgroundTask: busca título do paper via GPT e persiste."""
    db: Session = db_factory()
    try:
        reading = db.query(Reading).filter(Reading.id == reading_id).first()
        if not reading:
            return

        headers = {"User-Agent": "Mozilla/5.0 (compatible; AlumnusBot/1.0)"}
        try:
            resp = httpx.get(url, timeout=15, follow_redirects=True, headers=headers)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "html.parser")
            for tag in soup(["script", "style", "nav", "footer", "header"]):
                tag.decompose()
            text = soup.get_text(separator="\n", strip=True)[:8_000]
        except Exception as e:
            logger.warning("fetch_and_set_title: erro ao buscar url=%s: %s", url, e)
            return

        if not OPENAI_API_KEY:
            logger.warning("fetch_and_set_title: OPENAI_API_KEY não configurada")
            return

        try:
            client = OpenAI(api_key=OPENAI_API_KEY)
            completion = client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "Você é um assistente que extrai o título de artigos acadêmicos a partir do "
                            "conteúdo de páginas web. Retorne APENAS o título do artigo, sem aspas, sem "
                            "markdown, sem explicações. Se não conseguir identificar um título claro, "
                            "retorne exatamente a string vazia."
                        ),
                    },
                    {"role": "user", "content": f"URL: {url}\n\nConteúdo:\n{text}"},
                ],
                temperature=0,
                max_tokens=200,
            )
            title = completion.choices[0].message.content.strip()
        except Exception as e:
            logger.error("fetch_and_set_title: erro OpenAI url=%s: %s", url, e)
            return

        if title:
            reading.title = title[:500]
            db.commit()
    finally:
        db.close()


def generate_summary(reading_id: int, url: str, db_factory) -> None:
    """Chamado como BackgroundTask: gera resumo do paper via GPT e persiste."""
    db: Session = db_factory()
    try:
        reading = db.query(Reading).filter(Reading.id == reading_id).first()
        if not reading:
            return

        headers = {"User-Agent": "Mozilla/5.0 (compatible; AlumnusBot/1.0)"}
        try:
            resp = httpx.get(url, timeout=15, follow_redirects=True, headers=headers)
            resp.raise_for_status()
            soup = BeautifulSoup(resp.text, "html.parser")
            for tag in soup(["script", "style", "nav", "footer", "header"]):
                tag.decompose()
            text = soup.get_text(separator="\n", strip=True)[:12_000]
        except Exception as e:
            logger.warning("generate_summary: erro ao buscar url=%s: %s", url, e)
            return

        if not OPENAI_API_KEY:
            return

        try:
            client = OpenAI(api_key=OPENAI_API_KEY)
            completion = client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "Você é um assistente acadêmico. Gere um resumo conciso (3-5 parágrafos) "
                            "do artigo em português, destacando: problema abordado, metodologia, "
                            "principais resultados e contribuição. Sem markdown. Texto corrido."
                        ),
                    },
                    {"role": "user", "content": f"URL: {url}\n\nConteúdo:\n{text}"},
                ],
                temperature=0.3,
                max_tokens=600,
            )
            summary = completion.choices[0].message.content.strip()
        except Exception as e:
            logger.error("generate_summary: erro OpenAI url=%s: %s", url, e)
            return

        if summary:
            reading.summary = summary
            db.commit()
    finally:
        db.close()
