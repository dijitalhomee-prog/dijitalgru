#!/usr/bin/env python3
"""Aşama 1 — HTML düzeltmeleri (footer tekrarları, iletişim formu)."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STYLE = 'style="font-size:12px;opacity:.55;"'
SEP = '<span style="font-size:12px;opacity:.4;margin:0 8px;" aria-hidden="true">&middot;</span>'
NEW_FOOTER = (
    '&copy; 2026 Dijital Gru. Tüm hakları saklıdır.' + SEP +
    f'<a href="/gizlilik.html" {STYLE}>Gizlilik</a>' + SEP +
    f'<a href="#" data-cookie-prefs {STYLE}>Çerez Tercihleri</a>'
)
FOOT_RE = re.compile(r'&copy; 2026 Dijital Gru Tasarım Stüdyosu\. Tüm Hakları Saklıdır\..*?(?=</p>)', re.S)

CAREER_BLOCK_RE = re.compile(r'\s*<div class="career-note" id="career-note" hidden>.*?</div>', re.S)
OPT_TEKLIF = '<option value="Proje Teklifi">Proje Teklifi</option>'
OPT_NEW = '<option value="Proje Teklifi">Yeni Proje</option>'  # değer aynı: server.py allowlist'i bozulmaz
OPT_IS_RE = re.compile(r'\s*<option value="İş Başvurusu">İş Başvurusu</option>')
CAREER_LINE = ('<p class="form-career-line">İş başvuruları için '
               '<a href="/kariyer.html">Kariyer sayfamızı</a> ziyaret edin.</p>')

changed = {}
for p in list(ROOT.glob("*.html")) + list(ROOT.glob("blog/*.html")):
    s = p.read_text(encoding="utf-8")
    o = s
    s = FOOT_RE.sub(lambda m: NEW_FOOTER, s)
    if 'id="subject-field"' in s:
        s = s.replace(OPT_TEKLIF, OPT_NEW)
        s = OPT_IS_RE.sub("", s)
        s = CAREER_BLOCK_RE.sub("", s)
        if "form-career-line" not in s:
            # KVKK satırından sonra, </form> öncesine
            s = re.sub(r'(<p class="form-privacy-note".*?</p>)(\s*</form>)',
                       lambda m: m.group(1) + "\n                        " + CAREER_LINE + m.group(2), s, count=1, flags=re.S)
    if s != o:
        p.write_text(s, encoding="utf-8")
        changed[p.name] = True
print("güncellenen dosya:", len(changed))
print(sorted(changed))
