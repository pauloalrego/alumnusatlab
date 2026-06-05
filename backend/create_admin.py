"""
Cria (ou reseta a senha de) um usuário admin.

Uso:
    docker compose exec backend python create_admin.py
    docker compose exec backend python create_admin.py --email admin@lab.com --password minhasenha
"""
import argparse
import os
import sys

from passlib.context import CryptContext
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://alumnus:alumnus123@db:5432/alumnus")

engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def main():
    parser = argparse.ArgumentParser(description="Criar usuário superadmin")
    parser.add_argument("--email",    default="admin@alumnus.local")
    parser.add_argument("--nome",     default="Admin")
    parser.add_argument("--password", default="admin123")
    args = parser.parse_args()

    with Session() as db:
        from app.models import User
        from app.plan import clear_plan

        existing = db.query(User).filter(User.email == args.email).first()
        if existing:
            existing.password_hash = pwd_ctx.hash(args.password)
            existing.role = "superadmin"
            clear_plan(existing)
            db.commit()
            print(f"✓ Usuário '{args.email}' atualizado para superadmin.")
        else:
            user = User(
                email=args.email,
                nome=args.nome,
                password_hash=pwd_ctx.hash(args.password),
                role="superadmin",
                researcher_id=None,
            )
            db.add(user)
            db.commit()
            print(f"✓ Superadmin criado: {args.email} / {args.password}")
            print("  Altere a senha após o primeiro acesso.")


if __name__ == "__main__":
    main()
