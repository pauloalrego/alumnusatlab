"""
Popula o banco com dados demo realistas para screenshots.
Roda dentro do container: docker compose exec backend python seed_demo.py
"""
import os
from datetime import datetime, date, timedelta
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from passlib.context import CryptContext

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://alumnus:alumnus123@db:5432/alumnus")
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

def h(pw): return pwd_ctx.hash(pw)

def run():
    with Session() as db:
        from app.models import (
            Professor, Researcher, User, Note, Reminder,
            Tip, Relationship, GraphLayout
        )

        # ── IDs existentes ───────────────────────────────────────────────
        def rid(email):
            r = db.query(Researcher).filter_by(email=email).first()
            return r.id if r else None

        def uid(email):
            u = db.query(User).filter_by(email=email).first()
            return u.id if u else None

        def pid(email):
            u = db.query(User).filter_by(email=email).first()
            return u.professor_id if u and u.professor_id else None

        prof1_pid = pid('gustavo.pinto@ufpa.br')
        ana_rid   = rid('ana.beatriz@ufpa.br')
        raf_rid   = rid('rafael.mendes@ufpa.br')
        thi_rid   = rid('thiago.barbosa@ufpa.br')
        car_rid   = rid('carlos.souza@ufpa.br')
        fer_rid   = rid('fernanda.castro@ufpa.br')
        jul_rid   = rid('julia.nunes@ufpa.br')
        luc_rid   = rid('lucas.ferreira@ufpa.br')
        let_rid   = rid('leticia.moura@ufpa.br')
        mar_rid   = rid('mariana.lima@ufpa.br')
        ped_rid   = rid('pedro.alves@ufpa.br')

        prof1_uid = uid('gustavo.pinto@ufpa.br')
        ana_uid   = uid('ana.beatriz@ufpa.br')

        # ── 2º Grupo: Profa. Marina Santos ───────────────────────────────
        if not db.query(User).filter_by(email='marina.santos@ufpa.br').first():
            prof2 = Professor(
                nome='Marina Santos',
                ativo=True,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )
            db.add(prof2)
            db.flush()
            prof2_pid = prof2.id
        else:
            prof2_pid = pid('marina.santos@ufpa.br')

        # Alunos da Profa. Marina
        marina_students = [
            dict(nome='Diego Almeida Fonseca',  status='doutorado', email='diego.almeida@ufpa.br',
                 matricula='202001015', curso='Ciência da Computação', enrollment_date=date(2020,3,1),
                 lattes_url='http://lattes.cnpq.br/8800000000000001',
                 scholar_url='https://scholar.google.com/citations?user=diegoalmeida',
                 github_url='https://github.com/diegoalmeida',
                 whatsapp='91991220001',
                 interesses='Computação em Nuvem, Kubernetes, Microsserviços',
                 photo_url='https://i.pravatar.cc/300?img=12'),
            dict(nome='Beatriz Tavares Leal',   status='mestrado',  email='beatriz.tavares@ufpa.br',
                 matricula='202201020', curso='Ciência da Computação', enrollment_date=date(2022,3,1),
                 github_url='https://github.com/btavares',
                 whatsapp='91991220002',
                 interesses='Segurança de Redes, Criptografia, Zero Trust',
                 photo_url='https://i.pravatar.cc/300?img=44'),
            dict(nome='Renato Vieira Cunha',    status='mestrado',  email='renato.vieira@ufpa.br',
                 matricula='202201025', curso='Sistemas de Informação', enrollment_date=date(2022,8,1),
                 github_url='https://github.com/rvieira',
                 whatsapp='91991220003',
                 interesses='DevOps, CI/CD, Infraestrutura como Código',
                 photo_url='https://i.pravatar.cc/300?img=52'),
            dict(nome='Isabela Rocha Pimentel', status='graduacao', email='isabela.rocha@ufpa.br',
                 matricula='202301030', curso='Engenharia da Computação', enrollment_date=date(2023,3,1),
                 whatsapp='91991220004',
                 interesses='Cloud Functions, Serverless, AWS',
                 photo_url='https://i.pravatar.cc/300?img=39'),
            dict(nome='Gabriel Neto Barbosa',   status='graduacao', email='gabriel.neto@ufpa.br',
                 matricula='202301035', curso='Ciência da Computação', enrollment_date=date(2023,8,1),
                 github_url='https://github.com/gabrielneto',
                 whatsapp='91991220005',
                 interesses='Monitoramento de sistemas, Observabilidade, Prometheus',
                 photo_url='https://i.pravatar.cc/300?img=61'),
        ]
        for s in marina_students:
            if not db.query(Researcher).filter_by(email=s['email']).first():
                db.add(Researcher(orientador_id=prof2_pid, ativo=True, registered=False,
                                  created_at=datetime.utcnow(), updated_at=datetime.utcnow(), **s))
        db.flush()

        # ── Users ──────────────────────────────────────────────────────────
        def ensure_user(email, nome, role, professor_id=None, researcher_id=None, pw='alumnus123'):
            if not db.query(User).filter_by(email=email).first():
                from app.models import UserPlan
                now = datetime.utcnow()
                u = User(
                    email=email, nome=nome, password_hash=h(pw),
                    role=role,
                    professor_id=professor_id,
                    researcher_id=researcher_id,
                    last_login=now - timedelta(days=1),
                    created_at=now,
                )
                db.add(u)
                db.flush()
                if role == 'professor':
                    db.add(UserPlan(
                        user_id=u.id,
                        plan_type='trial',
                        plan_status='active',
                        account_activated_at=now - timedelta(days=5),
                        plan_period_ends_at=now + timedelta(days=25),
                    ))

        ensure_user('marina.santos@ufpa.br', 'Marina Santos', 'professor', professor_id=prof2_pid)

        # Registra alguns alunos de Gustavo que ainda não têm conta
        for email, nome in [
            ('rafael.mendes@ufpa.br',   'Rafael Mendes Oliveira'),
            ('thiago.barbosa@ufpa.br',  'Thiago Barbosa Rocha'),
            ('carlos.souza@ufpa.br',    'Carlos Eduardo Souza'),
            ('fernanda.castro@ufpa.br', 'Fernanda Castro Dias'),
            ('julia.nunes@ufpa.br',     'Júlia Nunes Alves'),
            ('lucas.ferreira@ufpa.br',  'Lucas Ferreira Gomes'),
        ]:
            r = db.query(Researcher).filter_by(email=email).first()
            if r and not db.query(User).filter_by(email=email).first():
                db.add(User(
                    email=email, nome=nome, password_hash=h('alumnus123'),
                    role='researcher',
                    researcher_id=r.id,
                    last_login=datetime.utcnow() - timedelta(days=3),
                    created_at=datetime.utcnow(),
                ))
                r.registered = True

        db.flush()
        # Refresh IDs
        def uid2(email):
            u = db.query(User).filter_by(email=email).first()
            return u.id if u else None

        prof1_uid = uid2('gustavo.pinto@ufpa.br')
        ana_uid   = uid2('ana.beatriz@ufpa.br')
        raf_uid   = uid2('rafael.mendes@ufpa.br')
        car_uid   = uid2('carlos.souza@ufpa.br')
        fer_uid   = uid2('fernanda.castro@ufpa.br')
        marina_uid = uid2('marina.santos@ufpa.br')

        # ── Relationships adicionais ───────────────────────────────────────
        def ensure_rel(src, tgt, rtype):
            if src and tgt and not db.query(Relationship).filter_by(
                source_researcher_id=src, target_researcher_id=tgt).first():
                db.add(Relationship(source_researcher_id=src, target_researcher_id=tgt,
                                    relation_type=rtype, created_at=datetime.utcnow()))

        diego_rid    = rid('diego.almeida@ufpa.br')
        beatriz_rid  = rid('beatriz.tavares@ufpa.br')
        renato_rid   = rid('renato.vieira@ufpa.br')
        isabela_rid  = rid('isabela.rocha@ufpa.br')
        gabriel_rid  = rid('gabriel.neto@ufpa.br')

        # Grupo da Profa. Marina
        ensure_rel(diego_rid,   renato_rid,  'colaboracao')
        ensure_rel(beatriz_rid, renato_rid,  'colaboracao')
        ensure_rel(diego_rid,   gabriel_rid, 'co-autoria')
        ensure_rel(isabela_rid, gabriel_rid, 'colaboracao')

        # Co-autorias entre grupos
        ensure_rel(ana_rid, diego_rid, 'co-autoria')

        # ── NOTES ─────────────────────────────────────────────────────────
        notes_data = [
            # Ana Beatriz
            (ana_rid, prof1_uid, '**Reunião 14/05/2024** — Discutimos os resultados preliminares do experimento com CodeBERT. Ana apresentou comparativo com GPT-4: acurácia de 87% vs 91%. Próximo passo: aumentar dataset para 500 projetos e replicar experimento.\n\n**Pendente:** Escrever seção de ameaças à validade até 21/05.'),
            (ana_rid, prof1_uid, '**Reunião 28/05/2024** — Revisão do rascunho da seção de resultados. Estrutura está boa, mas precisa melhorar a discussão dos falsos positivos. Sugerido incluir análise qualitativa de 10 casos representativos.\n\n**Próxima reunião:** 11/06 para revisar versão completa.'),
            (ana_rid, prof1_uid, '**Reunião 11/06/2024** — Versão completa revisada. Trabalho em bom estado para submissão. Ana vai ajustar abstract e conclusão conforme sugestões. Meta: submeter para JSS até 30/06.\n\n**Observação:** Verificar formatação das referências no estilo da revista.'),
            (ana_rid, ana_uid,   '**Anotação pessoal** — Preciso revisar o capítulo 3 da tese antes de mandar pro Gustavo. Revisar referências do survey de LLMs para SE.'),

            # Rafael
            (raf_rid, prof1_uid, '**Reunião 02/05/2024** — Rafael apresentou resultados do plugin VSCode. Demo funcionando para Java. Precisamos adicionar suporte a Python ainda. Desempenho aceitável: < 200ms de latência para arquivos de até 1000 linhas.\n\n**Ação:** Rafael vai perfilar o código e identificar gargalos até 09/05.'),
            (raf_rid, prof1_uid, '**Reunião 16/05/2024** — Revisão do artigo EMSE. Introdução e trabalhos relacionados OK. Seção de metodologia precisa de mais detalhes sobre o processo de seleção dos repositórios. Adicionar critérios de exclusão explícitos.'),
            (raf_rid, raf_uid,   '**Reunião 30/05/2024** — Gustavo aprovou a metodologia revisada. Agora foco na seção de resultados: incluir tabela comparativa com outras ferramentas. Preparar gráficos de boxplot para as métricas de latência.'),

            # Thiago
            (thi_rid, prof1_uid, '**Reunião 07/05/2024** — Thiago apresentou o estado da arte sobre predição de PRs. Boa cobertura da literatura. Sugeri adicionar papers de 2023 sobre LLMs para code review (Tufano et al., Guo et al.).\n\n**Próximo:** Rascunho da metodologia até 21/05.'),
            (thi_rid, prof1_uid, '**Reunião 21/05/2024** — Metodologia aprovada com pequenos ajustes. Thiago vai coletar dados de 50 projetos top-estrelas do GitHub. Usar GHTorrent + GitHub API. Atenção ao rate limiting.\n\n**Meta:** Dataset completo até 15/06.'),

            # Carlos
            (car_rid, prof1_uid, '**Reunião 08/05/2024** — Carlos apresentou protótipo da ferramenta de visualização. Interface limpa e intuitiva. Sugerido adicionar filtro por período e por contribuidor. Integrar com GitLab além do GitHub.\n\n**Próximo:** Adicionar filtros e fazer user study com 5 devs.'),
            (car_rid, prof1_uid, '**Reunião 22/05/2024** — User study realizado. Feedback geral positivo. Usuários sentiram falta de exportação para PDF/PNG. Adicionado no backlog. Carlos vai trabalhar na dissertação enquanto aguarda próxima rodada de feedback.'),
            (car_rid, car_uid,   '**Lembrete:** Entregar rascunho do capítulo 2 até 07/06. Marcar reunião com Gustavo para semana de 10/06.'),

            # Fernanda
            (fer_rid, prof1_uid, '**Reunião 10/05/2024** — Fernanda concluiu o survey de ferramentas de análise estática. Cobertura de 8 ferramentas: SonarQube, PMD, CheckStyle, SpotBugs, ESLint, Pylint, Flake8, Bandit. Próximo passo: definir conjunto de projetos para avaliação.\n\n**Critério:** Projetos com > 5 anos e > 100 stars no GitHub.'),
            (fer_rid, fer_uid,   '**Reunião 24/05/2024** — Gustavo aprovou os critérios de seleção. Coletados 150 projetos. Rodando análises essa semana. Resultados preliminares mostram SonarQube com melhor recall mas menor precisão para bugs de segurança.'),

            # Júlia
            (jul_rid, prof1_uid, '**Reunião 15/05/2024** — Júlia apresentou análise das 300 APIs. Descobertas interessantes: 67% não documentam corretamente os códigos de erro, 45% têm exemplos desatualizados. Sugeri refinar taxonomia de problemas de documentação.\n\n**Próximo:** Comparar com estudos de Sohan et al. e Wijst et al.'),
            (jul_rid, prof1_uid, '**Reunião 29/05/2024** — Júlia mostrou o gerador de documentação em funcionamento. Precisão de 78% comparado à documentação manual. Bom resultado para a área. Trabalhar na cobertura de casos de borda.\n\n**Meta:** Avaliação com desenvolvedores reais até 20/06.'),

            # Lucas
            (luc_rid, prof1_uid, '**Reunião 17/05/2024** — Lucas apresentou análise dos anti-padrões de desempenho mobile. Identificados 12 anti-padrões recorrentes. Os mais frequentes: uso inadequado do main thread, queries síncronas de banco.\n\n**Próximo:** Implementar detector estático para os 5 anti-padrões mais frequentes.'),
            (luc_rid, prof1_uid, '**Reunião 31/05/2024** — Detector implementado para 3 dos 5 padrões. Precision de 82%, recall de 74%. Precisamos melhorar o recall. Ideia: adicionar análise de fluxo de dados inter-procedural.'),

            # Grupo Marina
            (diego_rid, marina_uid, '**Reunião 06/05/2024** — Diego apresentou resultados do algoritmo LSTM para autoscaling. MAPE de 8.3% vs 15.1% do HPA padrão do Kubernetes. Excelente resultado. Próximo passo: validar em cluster de produção da UFPA.\n\n**Publicação:** Expandir para journal com versão completa dos experimentos.'),
            (beatriz_rid, marina_uid, '**Reunião 13/05/2024** — Beatriz demonstrou o sistema de detecção de anomalias. Taxa de falsos positivos de 2.1% em ambiente simulado. Bom resultado. Precisa testar com tráfego real.\n\n**Próximo:** Integrar com ambiente de staging do CloudLab.'),
            (renato_rid, marina_uid, '**Reunião 20/05/2024** — Renato apresentou comparativo Terraform vs Pulumi vs CDK. Terraform vence em maturidade do ecossistema, Pulumi em produtividade para devs Python/TS. CDK interessante para quem está no ecossistema AWS.\n\n**Ação:** Escrever seção de resultados com tabela comparativa detalhada.'),
        ]

        for r_id, u_id, text_ in notes_data:
            if r_id and u_id:
                db.add(Note(researcher_id=r_id, text=text_, created_by_id=u_id,
                            created_at=datetime.utcnow() - timedelta(days=10)))

        # ── REMINDERS ─────────────────────────────────────────────────────
        def add_reminder(u_id, text_, due, done=False):
            if u_id and not db.query(Reminder).filter_by(text=text_, created_by_id=u_id).first():
                db.add(Reminder(text=text_, due_date=due, done=done,
                                created_by_id=u_id, created_at=datetime.utcnow()))

        today = date.today()
        add_reminder(prof1_uid, 'Revisar rascunho final da dissertação do Carlos Eduardo', today + timedelta(days=3), False)
        add_reminder(prof1_uid, 'Enviar carta de recomendação para Ana Beatriz (bolsa sanduíche)', today + timedelta(days=7), False)
        add_reminder(prof1_uid, 'Reunião com coordenação do PPGCC — pauta: vagas 2025', today + timedelta(days=12), False)
        add_reminder(prof1_uid, 'Revisar proposta de projeto FAPESPA antes do envio', today + timedelta(days=15), False)
        add_reminder(prof1_uid, 'Bancas de qualificação: Thiago (20/06) e Lucas (27/06)', today + timedelta(days=18), False)
        add_reminder(prof1_uid, 'Submeter relatório anual CNPq', today + timedelta(days=21), False)
        add_reminder(prof1_uid, 'Confirmar presença no SBES 2024 (Curitiba, setembro)', today + timedelta(days=30), False)
        add_reminder(prof1_uid, 'Ler artigo do Thiago e dar feedback — EMSE', today - timedelta(days=2), True)
        add_reminder(prof1_uid, 'Aprovar plano de trabalho do Pedro e da Mariana', today - timedelta(days=5), True)

        add_reminder(marina_uid, 'Avaliar relatório semestral do Diego Almeida', today + timedelta(days=5), False)
        add_reminder(marina_uid, 'Revisão de artigo: Beatriz Tavares — RAID 2024', today + timedelta(days=9), False)
        add_reminder(marina_uid, 'Reunião com parceiro industrial (TerraCloud) — apresentação de resultados', today + timedelta(days=14), False)
        add_reminder(marina_uid, 'Solicitar renovação de bolsas CAPES para 2025', today + timedelta(days=20), False)

        # ── TIPS ───────────────────────────────────────────────────────────
        existing_manual = {e.question for e in db.query(Tip).all()}
        manual_entries = [
            ('Como funciona o processo de qualificação no PPGCC?',
             'A qualificação ocorre até o 18º mês para mestrado e 30º mês para doutorado. O aluno entrega uma proposta escrita (20-40 páginas) e apresenta para uma banca de 3 membros. É necessária aprovação por maioria. Em caso de reprovação, há uma segunda chance em 60 dias.\n\nDocumentos necessários:\n- Proposta de pesquisa atualizada\n- Relatório de atividades\n- Comprovante de publicações (se houver)\n\nNão deixe para a última hora — agende a banca com pelo menos 30 dias de antecedência.', 1),

            ('Quais são as exigências de publicação para defesa?',
             '**Mestrado:** 1 artigo publicado ou aceito em veículo Qualis B2 ou superior.\n\n**Doutorado:** 2 artigos em veículos Qualis A2 ou superior, sendo ao menos 1 como primeiro autor.\n\nOs artigos devem estar relacionados ao tema da tese/dissertação. Verificar sempre a tabela Qualis mais recente (a área de Computação tem avaliações quadrienais).\n\n**Dica:** Submeta cedo. O processo de revisão pode demorar 6-12 meses.', 2),

            ('Como fazer a inscrição nas disciplinas?',
             'As inscrições são feitas pelo SIGAA no início de cada semestre. O período de inscrição geralmente é de 2 semanas antes do início das aulas. Alunos novos têm um período especial na primeira semana.\n\nPasso a passo:\n1. Acesse sigaa.ufpa.br\n2. Módulo "Pós-Graduação" > "Inscrição em Turmas"\n3. Busque as disciplinas por código ou nome\n4. Confirme com o orientador antes de se inscrever\n\n**Atenção:** Mestrandos devem cursar ao menos 24 créditos; doutorandos, 32 créditos.', 1),

            ('Como acessar os recursos do laboratório remotamente?',
             'O laboratório mantém um servidor de acesso remoto (VPN institucional). Para acessar:\n\n1. Solicite acesso ao prof. Gustavo com justificativa\n2. Você receberá credenciais para a VPN (OpenVPN)\n3. Após conectar na VPN, acesse os servidores via SSH:\n   - Servidor principal: `lab-server.ufpa.br`\n   - GPU cluster (uso agendado): `gpu01.ufpa.br`\n\nO acesso ao GPU cluster requer agendamento prévio via planilha compartilhada no grupo do WhatsApp.\n\nAlgum problema? Fale com o Diego (administrador de sistemas).', 3),

            ('Como funciona o pagamento das bolsas?',
             'Bolsas CAPES e CNPq são pagas mensalmente, geralmente entre os dias 5 e 10 de cada mês, via depósito em conta corrente do Banco do Brasil.\n\nPara manter a bolsa você deve:\n- Registrar atividades no SigaBolsas mensalmente (até dia 5)\n- Não ter vínculo empregatício com carga horária > 20h\n- Manter desempenho acadêmico satisfatório\n- Cumprir as obrigações de ensino (estágio em docência para doutorado)\n\n**Mestrado CAPES:** R$ 2.100,00/mês\n**Doutorado CAPES:** R$ 3.100,00/mês\n\nEm caso de problemas no pagamento, entre em contato diretamente com a secretaria da pós-graduação.', 1),
        ]

        for i, (q, a, pos) in enumerate(manual_entries):
            if q not in existing_manual:
                db.add(Tip(question=q, answer=a, position=pos + 10,
                                   author_id=prof1_uid,
                                   created_at=datetime.utcnow() - timedelta(days=30 - i)))

        # ── GRAPH LAYOUT ───────────────────────────────────────────────────
        # Layout para o grupo do Gustavo (posições espalhadas e visualmente agradáveis)
        layout_g1 = {
            str(ana_rid):   {"x": 220, "y": 120},
            str(raf_rid):   {"x": 620, "y": 110},
            str(thi_rid):   {"x": 760, "y": 280},
            str(car_rid):   {"x": 330, "y": 460},
            str(fer_rid):   {"x": 120, "y": 340},
            str(jul_rid):   {"x": 580, "y": 460},
            str(luc_rid):   {"x": 700, "y": 430},
            str(let_rid):   {"x": 90,  "y": 160},
            str(mar_rid):   {"x": 200, "y": 460},
            str(ped_rid):   {"x": 450, "y": 530},
        }
        if prof1_pid:
            layout_g1[f"p{prof1_pid}"] = {"x": 450, "y": 280}
        existing = db.query(GraphLayout).filter_by(name='default').first()
        if existing:
            existing.layout_jsonb = layout_g1
            existing.updated_at = datetime.utcnow()
        else:
            db.add(GraphLayout(name='default', layout_jsonb=layout_g1,
                               updated_at=datetime.utcnow()))

        db.commit()
        print('✓ Seed demo concluído com sucesso!')
        print(f'  Researchers: {db.query(Researcher).count()}')
        print(f'  Users: {db.query(User).count()}')
        print(f'  Notes: {db.query(Note).count()}')
        print(f'  Reminders: {db.query(Reminder).count()}')
        print(f'  Tips: {db.query(Tip).count()}')
        print(f'  Relationships: {db.query(Relationship).count()}')

if __name__ == '__main__':
    run()
