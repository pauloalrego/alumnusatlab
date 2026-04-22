import logging

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from sqlalchemy.orm import joinedload

from ..models import GraphLayout, Professor, ProfessorInstitution, Relationship, Researcher, User
from ..schemas import LayoutUpdate
from ..slug import slugify

logger = logging.getLogger(__name__)

STATUS_COLORS = {
    "graduacao": "#3B82F6",
    "mestrado":  "#F59E0B",
    "doutorado": "#10B981",
    "postdoc":   "#06B6D4",
    "professor": "#7C3AED",
    "egresso":   "#6B7280",
}


def build_graph_payload(db: Session, institution_id: int | None = None) -> dict:
    professors_q  = (
        db.query(Professor)
        .join(User, User.professor_id == Professor.id)
        .options(joinedload(Professor.user))
        .filter(User.ativo == True)
    )
    researchers_q = (
        db.query(Researcher)
        .outerjoin(User, User.researcher_id == Researcher.id)
        .options(joinedload(Researcher.user))
        .filter(User.ativo == True)
    )

    if institution_id is not None:
        from ..models import ResearchGroup
        prof_ids = select(ProfessorInstitution.professor_id).where(
            ProfessorInstitution.institution_id == institution_id
        )
        professors_q = professors_q.filter(Professor.id.in_(prof_ids))
        group_ids = select(ResearchGroup.id).where(
            ResearchGroup.institution_id == institution_id
        )
        # Include researchers by group membership OR by orientador being in the institution (only when no group)
        researchers_q = researchers_q.filter(
            or_(
                Researcher.group_id.in_(group_ids),
                and_(Researcher.group_id.is_(None), Researcher.orientador_id.in_(prof_ids)),
            )
        )

    professors  = professors_q.all()
    # Superadmin users are invisible to all profiles
    professors  = [p for p in professors if not (p.user and p.user.role == 'superadmin')]
    researchers = researchers_q.all()
    researchers = [r for r in researchers if not (r.user and r.user.role == 'superadmin')]
    relationships = db.query(Relationship).all()

    layout    = db.query(GraphLayout).filter(GraphLayout.name == "default").first()
    positions = layout.layout_jsonb if layout else {}

    nodes = []

    # Nós de professores — id prefixado com "p"
    prof_positions: dict[int, dict] = {}
    for p in professors:
        node_id = f"p{p.id}"
        pos = positions.get(node_id, {"x": 400, "y": 100})
        prof_positions[p.id] = pos
        nodes.append({
            "id": node_id,
            "type": "researcher",
            "position": pos,
            "data": {
                "name":       p.nome,
                "slug":       slugify(p.nome),
                "email":      p.user.email if p.user else None,
                "photoUrl":   p.user.photo_url if p.user else None,
                "status":     "professor",
                "color":      STATUS_COLORS["professor"],
                "registered": bool(p.user and p.user.password_hash),
            },
        })

    # Nós de pesquisadores
    active_researcher_ids = {r.id for r in researchers}
    for r in researchers:
        node_id = str(r.id)
        if r.orientador_id and r.orientador_id in prof_positions:
            ppos = prof_positions[r.orientador_id]
            default_pos = {"x": ppos["x"] + 60 + (r.id % 6) * 80, "y": ppos["y"] + 100 + (r.id % 4) * 70}
        else:
            default_pos = {"x": r.id * 100, "y": r.id * 80}
        pos = positions.get(node_id, default_pos)
        nodes.append({
            "id": node_id,
            "type": "researcher",
            "position": pos,
            "data": {
                "name":       r.nome,
                "slug":       slugify(r.nome),
                "photoUrl":   r.user.photo_url if r.user else None,
                "status":     r.status,
                "color":      STATUS_COLORS.get(r.status, "#6B7280"),
                "registered": bool(r.user and r.user.password_hash),
            },
        })

    edges = []

    # Arestas implícitas: orientador → pesquisador (via orientador_id)
    for r in researchers:
        if r.orientador_id:
            edges.append({
                "id":     f"orient-{r.id}",
                "source": f"p{r.orientador_id}",
                "target": str(r.id),
            })

    # Arestas explícitas: researcher ↔ researcher
    for rel in relationships:
        if rel.source_researcher_id in active_researcher_ids and rel.target_researcher_id in active_researcher_ids:
            edges.append({
                "id":     f"e{rel.id}",
                "source": str(rel.source_researcher_id),
                "target": str(rel.target_researcher_id),
            })

    return {"nodes": nodes, "edges": edges}


def merge_layout(db: Session, data: LayoutUpdate) -> dict:
    layout = db.query(GraphLayout).filter(GraphLayout.name == "default").first()
    if not layout:
        layout = GraphLayout(name="default", layout_jsonb={})
        db.add(layout)

    current = dict(layout.layout_jsonb or {})
    layout.layout_jsonb = {**current, **data.positions}
    db.commit()
    db.refresh(layout)
    logger.info("Layout updated")
    return layout.layout_jsonb
