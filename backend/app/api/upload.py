from fastapi import APIRouter, UploadFile, File, HTTPException, Form
import os
import re
import httpx
import tempfile
from app.core.config import settings

router = APIRouter(prefix="/upload", tags=["Upload"])


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
    """Auto-split visi & misi from PDF text using common patterns."""
    text_lower = text.lower()

    # Try splitting by common Indonesian headings
    patterns = [
        # "VISI: ... MISI: ..."
        r"(?:visi|visi\s+prodi)\s*[:\-]?\s*(.+?)(?=\s*(?:misi|misi\s+prodi)\s*[:\-]?\s*)",
        r"(?:misi|misi\s+prodi)\s*[:\-]?\s*(.+)",
    ]

    visi = misi = ""

    # Look for VISI section
    visi_match = re.search(
        r"(?:visi|visi\s+prodi)\s*[:\-]?\s*(.+?)(?=\s*(?:misi|misi\s+prodi|tujuan|bab\s+\d+|$))",
        text, re.IGNORECASE | re.DOTALL
    )
    misi_match = re.search(
        r"(?:misi|misi\s+prodi)\s*[:\-]?\s*(.+?)(?=\s*(?:tujuan|bab\s+\d+|$))",
        text, re.IGNORECASE | re.DOTALL
    )

    if visi_match:
        visi = visi_match.group(1).strip().rstrip(".")
    if misi_match:
        misi = misi_match.group(1).strip().rstrip(".")

    # If splitting didn't work, try line-based heuristic
    if not visi and not misi:
        lines = text.strip().split("\n")
        visi_lines, misi_lines = [], []
        current = None
        for line in lines:
            l = line.strip().lower()
            if re.search(r"\bvisi\b", l):
                current = "visi"
                # Extract text after "visi" keyword on same line
                after = re.sub(r"^.*?\bvisi\b\s*[:\-]?\s*", "", line, flags=re.IGNORECASE)
                if after.strip():
                    visi_lines.append(after.strip())
                continue
            elif re.search(r"\bmisi\b", l):
                current = "misi"
                after = re.sub(r"^.*?\bmisi\b\s*[:\-]?\s*", "", line, flags=re.IGNORECASE)
                if after.strip():
                    misi_lines.append(after.strip())
                continue
            if current == "visi":
                visi_lines.append(line)
            elif current == "misi":
                misi_lines.append(line)

        if visi_lines:
            visi = "\n".join(visi_lines).strip().rstrip(".")
        if misi_lines:
            misi = "\n".join(misi_lines).strip().rstrip(".")

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
async def upload_pdf_url(url: str = Form(...)):
    """Download & extract text from a PDF URL."""
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
async def upload_pdf_prodi_url(url: str = Form(...)):
    """Download PDF from URL & auto-split visi-misi."""
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
