from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models import RPS
from app.schemas import ExportRequest
from sqlalchemy import select
import json
import os
from app.core.config import settings
from jinja2 import Template

router = APIRouter(prefix="/export", tags=["Export"])


RPS_HTML_TEMPLATE = Template("""
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>RPS - {{ data.identitas.nama_mata_kuliah }}</title>
  <style>
    body { font-family: 'Times New Roman', serif; font-size: 12pt; margin: 2cm; }
    h1 { text-align: center; font-size: 16pt; margin-bottom: 5px; }
    h2 { font-size: 14pt; margin-top: 20px; border-bottom: 1px solid #000; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    th, td { border: 1px solid #000; padding: 6px; text-align: left; font-size: 11pt; }
    th { background: #f0f0f0; }
    .header { text-align: center; margin-bottom: 20px; }
    .header h1 { margin: 0; }
    .header p { margin: 3px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>RENCANA PEMBELAJARAN SEMESTER (RPS)</h1>
    <p>{{ data.identitas.prodi if data.identitas else '' }} - {{ data.identitas.fakultas if data.identitas else '' }}</p>
    <p>Tahun Akademik {{ data.identitas.tahun_akademik if data.identitas else '' }}</p>
  </div>

  <h2>Identitas Mata Kuliah</h2>
  <table>
    <tr><th>Nama MK</th><td>{{ data.identitas.nama_mata_kuliah if data.identitas else '' }}</td></tr>
    <tr><th>Kode MK</th><td>{{ data.identitas.kode_mata_kuliah if data.identitas else '' }}</td></tr>
    <tr><th>SKS</th><td>{{ data.identitas.sks if data.identitas else '' }}</td></tr>
    <tr><th>Semester</th><td>{{ data.identitas.semester if data.identitas else '' }}</td></tr>
  </table>

  <h2>Deskripsi Mata Kuliah</h2>
  <p>{{ data.deskripsi_mata_kuliah }}</p>

  <h2>CPMK (Capaian Pembelajaran Mata Kuliah)</h2>
  <table>
    <tr><th>Kode</th><th>Deskripsi</th><th>Bobot</th><th>CPL</th></tr>
    {% for c in data.cpmk %}
    {% if c is mapping %}
    <tr>
      <td>{{ c.kode if c.kode else '' }}</td>
      <td>{{ c.deskripsi if c.deskripsi else '' }}</td>
      <td>{{ c.bobot if c.bobot else '' }}</td>
      <td>
        {% if c.cpl_prodi is string %}
          {{ c.cpl_prodi }}
        {% elif c.cpl_prodi is iterable %}
          {{ c.cpl_prodi | join(', ') }}
        {% else %}
          {{ c.cpl_prodi }}
        {% endif %}
      </td>
    </tr>
    {% endif %}
    {% endfor %}
  </table>

  <h2>Sub-CPMK</h2>
  <table>
    <tr><th>Kode</th><th>CPMK</th><th>Deskripsi</th><th>Indikator</th></tr>
    {% for s in data.sub_cpmk %}
    {% if s is mapping %}
    <tr>
      <td>{{ s.kode if s.kode else '' }}</td>
      <td>{{ s.cpmk_kode if s.cpmk_kode else '' }}</td>
      <td>{{ s.deskripsi if s.deskripsi else '' }}</td>
      <td>
        {% if s.indikator is string %}
          {{ s.indikator }}
        {% elif s.indikator is iterable %}
          {{ s.indikator | join('; ') }}
        {% else %}
          {{ s.indikator }}
        {% endif %}
      </td>
    </tr>
    {% endif %}
    {% endfor %}
  </table>

  <h2>Rencana Pembelajaran</h2>
  <table>
    <tr><th>Minggu</th><th>Sub-CPMK</th><th>Materi</th><th>Metode</th><th>Media</th></tr>
    {% for r in data.rencana_pembelajaran %}
    {% if r is mapping %}
    <tr>
      <td>{{ r.minggu_ke if r.minggu_ke else '' }}</td>
      <td>{{ r.sub_cpmk_kode if r.sub_cpmk_kode else '' }}</td>
      <td>{{ r.materi if r.materi else '' }}</td>
      <td>
        {% if r.metode is string %}
          {{ r.metode }}
        {% elif r.metode is iterable %}
          {{ r.metode | join(', ') }}
        {% else %}
          {{ r.metode }}
        {% endif %}
      </td>
      <td>
        {% if r.media is string %}
          {{ r.media }}
        {% elif r.media is iterable %}
          {{ r.media | join(', ') }}
        {% else %}
          {{ r.media }}
        {% endif %}
      </td>
    </tr>
    {% endif %}
    {% endfor %}
  </table>

  <h2>Penilaian</h2>
  <table>
    <tr><th>Komponen</th><th>Bobot</th><th>Jenis</th></tr>
    {% for p in data.penilaian %}
    {% if p is mapping %}
    <tr>
      <td>{{ p.komponen if p.komponen else '' }}</td>
      <td>{{ p.bobot if p.bobot else '' }}</td>
      <td>{{ p.jenis if p.jenis else '' }}</td>
    </tr>
    {% endif %}
    {% endfor %}
  </table>

  <h2>Referensi</h2>
  <ul>
    {% for ref in data.referensi %}
    <li>
      {% if ref is string %}
        {{ ref }}
      {% elif ref is mapping %}
        {{ ref.judul if ref.judul else '' }}
        {{ ', ' + ref.pengarang if ref.pengarang else '' }}
        {% if ref.tahun %}
          ({{ ref.tahun }})
        {% endif %}
      {% else %}
        {{ ref }}
      {% endif %}
    </li>
    {% endfor %}
  </ul>
</body>
</html>
""")


def generate_docx(rps_data: dict, output_path: str):
    from docx import Document
    from docx.shared import Pt
    from docx.enum.text import WD_ALIGN_PARAGRAPH

    doc = Document()
    style = doc.styles['Normal']
    style.font.name = 'Times New Roman'
    style.font.size = Pt(12)

    # Header
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run('RENCANA PEMBELAJARAN SEMESTER (RPS)')
    run.bold = True
    run.font.size = Pt(16)

    identitas = rps_data.get('identitas') or {}
    
    # Identitas table
    doc.add_heading('Identitas Mata Kuliah', level=2)
    table = doc.add_table(rows=4, cols=2)
    rows = [
        ('Nama MK', identitas.get('nama_mata_kuliah', '')),
        ('Kode MK', identitas.get('kode_mata_kuliah', '')),
        ('SKS', str(identitas.get('sks', ''))),
        ('Semester', str(identitas.get('semester', ''))),
    ]
    for i, (label, val) in enumerate(rows):
        table.rows[i].cells[0].text = label
        table.rows[i].cells[1].text = val

    # CPMK
    doc.add_heading('CPMK', level=2)
    cpmk_table = doc.add_table(rows=1, cols=4)
    for j, h in enumerate(['Kode', 'Deskripsi', 'Bobot', 'CPL']):
        cpmk_table.rows[0].cells[j].text = h
    for cpmk in (rps_data.get('cpmk') or []):
        if not isinstance(cpmk, dict):
            continue
        row = cpmk_table.add_row()
        row.cells[0].text = cpmk.get('kode', '') or ''
        row.cells[1].text = cpmk.get('deskripsi', '') or ''
        row.cells[2].text = str(cpmk.get('bobot', '')) or ''
        
        cpl_prodi = cpmk.get('cpl_prodi', [])
        if isinstance(cpl_prodi, list):
            row.cells[3].text = ', '.join([str(x) for x in cpl_prodi])
        else:
            row.cells[3].text = str(cpl_prodi or '')

    # Rencana Pembelajaran
    doc.add_heading('Rencana Pembelajaran', level=2)
    rp_table = doc.add_table(rows=1, cols=5)
    for j, h in enumerate(['Minggu', 'Sub-CPMK', 'Materi', 'Metode', 'Media']):
        rp_table.rows[0].cells[j].text = h
    for rp in (rps_data.get('rencana_pembelajaran') or []):
        if not isinstance(rp, dict):
            continue
        row = rp_table.add_row()
        row.cells[0].text = str(rp.get('minggu_ke', '')) or ''
        row.cells[1].text = rp.get('sub_cpmk_kode', '') or ''
        row.cells[2].text = rp.get('materi', '') or ''
        
        metode = rp.get('metode', [])
        if isinstance(metode, list):
            row.cells[3].text = ', '.join([str(x) for x in metode])
        else:
            row.cells[3].text = str(metode or '')
            
        media = rp.get('media', [])
        if isinstance(media, list):
            row.cells[4].text = ', '.join([str(x) for x in media])
        else:
            row.cells[4].text = str(media or '')

    # Penilaian
    doc.add_heading('Penilaian', level=2)
    pen_table = doc.add_table(rows=1, cols=3)
    for j, h in enumerate(['Komponen', 'Bobot', 'Jenis']):
        pen_table.rows[0].cells[j].text = h
    for p in (rps_data.get('penilaian') or []):
        if not isinstance(p, dict):
            continue
        row = pen_table.add_row()
        row.cells[0].text = p.get('komponen', '') or ''
        row.cells[1].text = str(p.get('bobot', '')) or ''
        row.cells[2].text = p.get('jenis', '') or ''

    doc.save(output_path)


@router.post("/{rps_id}")
async def export_rps(
    rps_id: int,
    export_format: str = "pdf",
    db: AsyncSession = Depends(get_db),
):
    from app.models import MataKuliah
    result = await db.execute(select(RPS).where(RPS.id == rps_id))
    rps = result.scalar_one_or_none()
    if not rps:
        raise HTTPException(status_code=404, detail="RPS not found")
        
    # Ambil deskripsi mata kuliah dari database secara dinamis agar tidak hardcoded
    mk_result = await db.execute(select(MataKuliah).where(MataKuliah.id == rps.mata_kuliah_id))
    mk = mk_result.scalar_one_or_none()
    deskripsi_mk = mk.deskripsi if (mk and mk.deskripsi) else ""
    
    rps_data = {
        "identitas": rps.identitas or {},
        "deskripsi_mata_kuliah": deskripsi_mk or "",
        "cpmk": rps.cpmk or [],
        "sub_cpmk": rps.sub_cpmk or [],
        "rencana_pembelajaran": rps.rencana_pembelajaran or [],
        "metode_pembelajaran": rps.metode_pembelajaran or [],
        "media_pembelajaran": rps.media_pembelajaran or [],
        "penilaian": rps.penilaian or [],
        "referensi": rps.referensi or [],
    }
    
    os.makedirs(settings.EXPORT_DIR, exist_ok=True)
    filename = f"RPS_{rps.kode}_{rps.semester}_{rps.tahun_akademik}"
    filename = filename.replace("/", "-").replace("\\", "-")
    
    if export_format == "docx":
        filepath = os.path.join(settings.EXPORT_DIR, f"{filename}.docx")
        generate_docx(rps_data, filepath)
        return FileResponse(filepath, media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document", filename=f"{filename}.docx")
    
    elif export_format == "pdf":
        html_content = RPS_HTML_TEMPLATE.render(data=rps_data)
        
        try:
            from xhtml2pdf import pisa
            pdf_filename = f"{filename}.pdf"
            filepath = os.path.join(settings.EXPORT_DIR, pdf_filename)
            with open(filepath, "w+b") as result_file:
                pisa_status = pisa.CreatePDF(html_content, dest=result_file)
                if pisa_status.err:
                    raise Exception("Gagal mengonversi HTML ke PDF")
            
            return FileResponse(
                filepath,
                media_type="application/pdf",
                filename=pdf_filename,
                headers={"Content-Disposition": f"attachment; filename={pdf_filename}"}
            )
        except ImportError:
            # Fallback: jika library xhtml2pdf belum terinstall di server, return file html
            html_filename = f"{filename}.html"
            filepath = os.path.join(settings.EXPORT_DIR, html_filename)
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(html_content)
            return FileResponse(
                filepath,
                media_type="text/html",
                filename=html_filename,
                headers={"Content-Disposition": f"attachment; filename={html_filename}"}
            )
    
    else:
        raise HTTPException(status_code=400, detail=f"Format {export_format} tidak didukung")