#!/usr/bin/env python3
"""
Gera eventos de atividade fake para testar a interface do dashboard.

Uso:
  python seed_activity.py                       # usa DATABASE_URL do ambiente
  python seed_activity.py postgresql://...      # URL explícita

Pré-requisito: a migration 019_activity_events.sql já deve ter sido aplicada.
"""

import json
import os
import random
import sys
from datetime import datetime, timedelta

import psycopg2

random.seed(42)


def get_url():
    if len(sys.argv) > 1 and not sys.argv[1].startswith("--"):
        return sys.argv[1]
    url = os.getenv("DATABASE_URL", "")
    if not url:
        sys.exit("Erro: DATABASE_URL não definida. Passe como argumento ou variável de ambiente.")
    return url.replace("postgres://", "postgresql://", 1)


def get_researchers_and_professor(cur):
    """Busca orientandos e o professor deles."""
    # Pega pesquisadores com user vinculado
    cur.execute("""
        SELECT r.id AS researcher_id, u.id AS user_id, u.nome, r.orientador_id
        FROM researchers r
        JOIN users u ON u.researcher_id = r.id
        WHERE r.orientador_id IS NOT NULL AND u.ativo = TRUE
    """)
    researchers = cur.fetchall()

    if not researchers:
        sys.exit("Nenhum pesquisador com orientador encontrado. Rode seed.py primeiro.")

    # Pega o user_id do professor (orientador)
    professor_ids = set(r[3] for r in researchers)
    cur.execute("""
        SELECT p.id AS professor_id, u.id AS user_id, u.nome
        FROM professors p
        JOIN users u ON u.professor_id = p.id
        WHERE p.id = ANY(%s)
    """, (list(professor_ids),))
    professors = {row[0]: {"user_id": row[1], "nome": row[2]} for row in cur.fetchall()}

    return researchers, professors


def random_time_in_last_days(days_ago_max=30):
    """Retorna um datetime aleatório nos últimos N dias."""
    now = datetime.utcnow()
    delta = timedelta(
        days=random.randint(0, days_ago_max),
        hours=random.randint(8, 22),
        minutes=random.randint(0, 59),
    )
    return now - delta


READING_URLS = [
    "https://arxiv.org/abs/2301.07543",
    "https://dl.acm.org/doi/10.1145/3597503.3608132",
    "https://ieeexplore.ieee.org/document/10172590",
    "https://arxiv.org/abs/2310.06825",
    "https://dl.acm.org/doi/10.1145/3611643.3616244",
    "https://arxiv.org/abs/2403.15332",
    "https://ieeexplore.ieee.org/document/10555812",
    "https://arxiv.org/abs/2312.02120",
]

MILESTONE_TYPES = [
    ("entrada", "Entrada no grupo"),
    ("qualificacao", "Qualificação"),
    ("defesa", "Defesa da dissertação"),
    ("publicacao", "Artigo aceito no SBES 2026"),
    ("publicacao", "Artigo submetido ao MSR 2026"),
    ("apresentacao", "Apresentação no seminário do grupo"),
    ("curso", "Conclusão da disciplina de Métodos de Pesquisa"),
]

STATUS_TRANSITIONS = [
    ("quero_ler", "lendo"),
    ("lendo", "lido"),
    ("quero_ler", "lendo"),
    ("lendo", "lido"),
]


def generate_events(researchers, professors):
    """Gera lista de eventos variados."""
    events = []

    for researcher_id, user_id, nome, orientador_id in researchers:
        prof = professors.get(orientador_id, {})
        prof_user_id = prof.get("user_id", user_id)

        # -- Leituras criadas (algumas pelo aluno, algumas pelo professor) --
        num_readings = random.randint(3, 6)
        urls_sample = random.sample(READING_URLS, min(num_readings, len(READING_URLS)))
        for i, url in enumerate(urls_sample):
            actor = random.choice([user_id, prof_user_id])
            events.append({
                "actor_id": actor,
                "target_user_id": user_id,
                "action": "reading_created",
                "entity_type": "reading",
                "entity_id": random.randint(100, 999),
                "metadata_json": json.dumps({"url": url}),
                "created_at": random_time_in_last_days(25),
            })

            # Algumas leituras mudam de status
            if random.random() < 0.7:
                from_s, to_s = STATUS_TRANSITIONS[i % len(STATUS_TRANSITIONS)]
                events.append({
                    "actor_id": user_id,
                    "target_user_id": user_id,
                    "action": "reading_status_changed",
                    "entity_type": "reading",
                    "entity_id": events[-1]["entity_id"],
                    "metadata_json": json.dumps({"from": from_s, "to": to_s}),
                    "created_at": random_time_in_last_days(15),
                })

        # -- Milestones --
        num_milestones = random.randint(1, 3)
        milestones_sample = random.sample(MILESTONE_TYPES, min(num_milestones, len(MILESTONE_TYPES)))
        for m_type, m_title in milestones_sample:
            actor = random.choice([user_id, prof_user_id])
            events.append({
                "actor_id": actor,
                "target_user_id": user_id,
                "action": "milestone_created",
                "entity_type": "milestone",
                "entity_id": random.randint(100, 999),
                "metadata_json": json.dumps({"title": m_title, "type": m_type}),
                "created_at": random_time_in_last_days(20),
            })

            # Alguns milestones são atualizados
            if random.random() < 0.4:
                events.append({
                    "actor_id": user_id,
                    "target_user_id": user_id,
                    "action": "milestone_updated",
                    "entity_type": "milestone",
                    "entity_id": events[-1]["entity_id"],
                    "metadata_json": json.dumps({"title": m_title}),
                    "created_at": random_time_in_last_days(10),
                })

        # -- Notas --
        num_notes = random.randint(2, 5)
        for _ in range(num_notes):
            actor = random.choice([user_id, prof_user_id])
            note_id = random.randint(100, 999)
            events.append({
                "actor_id": actor,
                "target_user_id": user_id,
                "action": "note_created",
                "entity_type": "note",
                "entity_id": note_id,
                "metadata_json": None,
                "created_at": random_time_in_last_days(20),
            })

            # Algumas notas são editadas
            if random.random() < 0.3:
                events.append({
                    "actor_id": actor,
                    "target_user_id": user_id,
                    "action": "note_updated",
                    "entity_type": "note",
                    "entity_id": note_id,
                    "metadata_json": None,
                    "created_at": random_time_in_last_days(8),
                })

        # -- Logins --
        num_logins = random.randint(5, 15)
        for _ in range(num_logins):
            events.append({
                "actor_id": user_id,
                "target_user_id": user_id,
                "action": "login",
                "entity_type": "user",
                "entity_id": user_id,
                "metadata_json": None,
                "created_at": random_time_in_last_days(30),
            })

    # Ordena por data
    events.sort(key=lambda e: e["created_at"])
    return events


def insert_events(cur, events):
    for e in events:
        cur.execute("""
            INSERT INTO activity_events (actor_id, target_user_id, action, entity_type, entity_id, metadata_json, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            e["actor_id"],
            e["target_user_id"],
            e["action"],
            e["entity_type"],
            e["entity_id"],
            e["metadata_json"],
            e["created_at"],
        ))


def main():
    url = get_url()
    conn = psycopg2.connect(url)
    conn.autocommit = False
    cur = conn.cursor()

    # Garante que a tabela existe
    cur.execute("SELECT to_regclass('activity_events')")
    if cur.fetchone()[0] is None:
        print("Tabela activity_events não existe. Rodando migration...")
        from pathlib import Path
        migration = Path(__file__).parent / "migrations" / "019_activity_events.sql"
        cur.execute(migration.read_text(encoding="utf-8"))
        conn.commit()
        print("  Tabela criada.")

    # Limpa eventos anteriores
    cur.execute("DELETE FROM activity_events")
    deleted = cur.rowcount
    if deleted:
        print(f"  {deleted} eventos anteriores removidos.")

    researchers, professors = get_researchers_and_professor(cur)
    print(f"  {len(researchers)} pesquisador(es) encontrado(s)")
    for _, _, nome, _ in researchers:
        print(f"    - {nome}")

    events = generate_events(researchers, professors)
    insert_events(cur, events)
    conn.commit()

    # Resumo
    cur.execute("SELECT action, count(*) FROM activity_events GROUP BY action ORDER BY action")
    print(f"\n  {len(events)} eventos criados:")
    for action, count in cur.fetchall():
        print(f"    {action:30s} {count}")

    conn.close()
    print("\nSeed de atividade concluído.")


if __name__ == "__main__":
    main()
