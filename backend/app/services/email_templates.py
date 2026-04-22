import os
from bs4 import BeautifulSoup

APP_URL = os.getenv("APP_URL", "https://alumnus.app")


def _strip_html(html: str) -> str:
    return BeautifulSoup(html, "html.parser").get_text(" ", strip=True)


def _excerpt(html: str, max_chars: int = 220) -> str:
    text = _strip_html(html)
    return text[:max_chars] + "…" if len(text) > max_chars else text


def _render(headline: str, subtext: str, excerpt: str, cta_url: str, cta_label: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{headline}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1e3a8a 0%,#4f46e5 100%);padding:32px 36px 28px;">
            <p style="margin:0;color:#a5b4fc;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Alumnus</p>
            <h1 style="margin:10px 0 0;color:#ffffff;font-size:26px;font-weight:800;line-height:1.2;">{headline}</h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px 36px 8px;">
            <p style="margin:0;font-size:16px;color:#374151;line-height:1.6;">{subtext}</p>
          </td>
        </tr>

        <!-- Excerpt -->
        <tr>
          <td style="padding:16px 36px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#f8fafc;border-left:4px solid #6366f1;border-radius:0 8px 8px 0;padding:14px 18px;">
                  <p style="margin:0;font-size:14px;color:#4b5563;line-height:1.65;font-style:italic;">"{excerpt}"</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:24px 36px 36px;">
            <a href="{cta_url}"
               style="display:inline-block;background:linear-gradient(135deg,#4f46e5,#7c3aed);color:#ffffff;
                      text-decoration:none;font-size:15px;font-weight:700;padding:14px 32px;
                      border-radius:10px;letter-spacing:0.3px;">
              {cta_label} &rarr;
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:18px 36px;">
            <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">
              Você recebeu este e-mail porque está cadastrado no
              <a href="{APP_URL}" style="color:#6366f1;text-decoration:none;">Alumnus</a>.
              Esta é uma mensagem automática — não responda.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>"""


def note_created_html(creator_name: str, note_html: str, profile_slug: str) -> str:
    url = f"{APP_URL}/app/profile/{profile_slug}"
    return _render(
        headline="Nova anotação no seu perfil",
        subtext=f"<strong>{creator_name}</strong> adicionou uma anotação sobre você no Alumnus.",
        excerpt=_excerpt(note_html),
        cta_url=url,
        cta_label="Ver no Alumnus",
    )


def mention_html(creator_name: str, note_html: str, profile_name: str, profile_slug: str) -> str:
    url = f"{APP_URL}/app/profile/{profile_slug}"
    return _render(
        headline="Oba! Você foi marcado no Alumnus!",
        subtext=f"<strong>{creator_name}</strong> mencionou você em uma anotação sobre <strong>{profile_name}</strong>.",
        excerpt=_excerpt(note_html),
        cta_url=url,
        cta_label="Ver aqui",
    )
