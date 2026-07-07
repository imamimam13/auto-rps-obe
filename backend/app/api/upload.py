from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
import os
import re
import httpx
import tempfile
from app.core.config import settings

router = APIRouter(prefix="/upload", tags=["Upload"])


class PdfUrlRequest(BaseModel):
    url: str


def extract_text_from_pdf(file: UploadFile) -> str:
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File harus PDF")

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    filepath = os.path.join(settings.UPLOAD_DIR, file.filename)

    content = file.file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    try:
        import fitz
        doc = fitz.open(filepath)
        text = "".join(page.get_text() for page in doc)
        doc.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal baca PDF: {str(e)}")
    finally:
        os.remove(filepath)

    if not text.strip():
        raise HTTPException(status_code=400, detail="Tidak ada teks yang bisa dibaca dari PDF")

    return text.strip()


def split_visi_misi(text: str) -> dict:
    """Auto-split visi & misi from PDF text using line-based parsing."""
    lines = text.split("\n")
    visi_lines = []
    misi_lines = []
    current = None

    # Keywords that mark the END of a section
    stop_keywords = ["tujuan", "sasaran", "strategi", "bab", "cpl", "cpmk", "dosen", "mata kuliah", "program studi", "fakultas"]

    for i, line in enumerate(lines):
        l = line.strip().lower()

        # Detect section headers
        is_visi_header = bool(re.match(r"^\s*\*?\*?\s*visi\b", l))
        is_misi_header = bool(re.match(r"^\s*\*?\*?\s*misi\b", l))

        if is_visi_header:
            current = "visi"
            # Grab text after the keyword on same line
            after = re.sub(r"^.*?\bvisi\b\s*[\*:\-\(\)]*\s*", "", line, flags=re.IGNORECASE).strip()
            after = re.sub(r"^[\*\-\.]+", "", after).strip()
            if after and len(after) > 2:
                visi_lines.append(after)
            continue

        if is_misi_header:
            current = "misi"
            after = re.sub(r"^.*?\bmisi\b\s*[\*:\-\(\)]*\s*", "", line, flags=re.IGNORECASE).strip()
            after = re.sub(r"^[\*\-\.]+", "", after).strip()
            if after and len(after) > 2:
                misi_lines.append(after)
            continue

        # Check if we hit a new section (stop collecting)
        if current and any(re.match(rf"^\s*\*?\*?\s*{kw}", l) for kw in stop_keywords):
            current = None
            continue

        # Collect lines for current section
        clean = line.strip()
        if current == "visi" and clean and clean not in [".", ",", "-", ""]:
            visi_lines.append(clean)
        elif current == "misi" and clean and clean not in [".", ",", "-", ""]:
            misi_lines.append(clean)

    visi = "\n".join(visi_lines).strip()
    misi = "\n".join(misi_lines).strip()

    # Clean up trailing junk
    visi = re.sub(r"[\s\.]+$", "", visi)
    misi = re.sub(r"[\s\.]+$", "", misi)

    return {"visi": visi, "misi": misi}


@router.post("/pdf")
async def upload_pdf(file: UploadFile = File(...)):
    text = extract_text_from_pdf(file)
    return {
        "success": True,
        "text": text,
        "filename": file.filename,
    }


@router.post("/pdf-prodi")
async def upload_pdf_prodi(file: UploadFile = File(...)):
    text = extract_text_from_pdf(file)
    result = split_visi_misi(text)

    # Fallback: if auto-split fails, return full text as visi
    if not result["visi"] and not result["misi"]:
        result["visi"] = text
        result["misi"] = ""

    return {
        "success": True,
        **result,
        "filename": file.filename,
    }


@router.post("/pdf-url")
async def upload_pdf_url(request: PdfUrlRequest):
    """Download & extract text from a PDF URL."""
    url = request.url
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="URL tidak valid")

    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Gagal download PDF: {str(e)}")

    content = resp.content
    if not content[:10].startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="URL bukan file PDF")

    # Save to temp file, extract, clean up
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    try:
        tmp.write(content)
        tmp.close()

        import fitz
        doc = fitz.open(tmp.name)
        text = "".join(page.get_text() for page in doc)
        doc.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal baca PDF: {str(e)}")
    finally:
        os.unlink(tmp.name)

    if not text.strip():
        raise HTTPException(status_code=400, detail="Tidak ada teks yang bisa dibaca dari PDF")

    return {
        "success": True,
        "text": text.strip(),
        "url": url,
    }


@router.post("/pdf-prodi-url")
async def upload_pdf_prodi_url(request: PdfUrlRequest):
    """Download PDF from URL & auto-split visi-misi."""
    url = request.url
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="URL tidak valid")

    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Gagal download PDF: {str(e)}")

    content = resp.content
    if not content[:10].startswith(b"%PDF"):
        raise HTTPException(status_code=400, detail="URL bukan file PDF")

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    try:
        tmp.write(content)
        tmp.close()

        import fitz
        doc = fitz.open(tmp.name)
        text = "".join(page.get_text() for page in doc)
        doc.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal baca PDF: {str(e)}")
    finally:
        os.unlink(tmp.name)

    if not text.strip():
        raise HTTPException(status_code=400, detail="Tidak ada teks yang bisa dibaca dari PDF")

    result = split_visi_misi(text.strip())
    if not result["visi"] and not result["misi"]:
        result["visi"] = text.strip()

    return {"success": True, **result, "url": url}
