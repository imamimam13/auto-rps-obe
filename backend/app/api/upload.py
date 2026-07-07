from fastapi import APIRouter, UploadFile, File, HTTPException
import os
from app.core.config import settings

router = APIRouter(prefix="/upload", tags=["Upload"])


@router.post("/pdf")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File harus PDF")

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    filepath = os.path.join(settings.UPLOAD_DIR, file.filename)

    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    try:
        import fitz
        doc = fitz.open(filepath)
        text = ""
        for page in doc:
            text += page.get_text()
        doc.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal baca PDF: {str(e)}")

    os.remove(filepath)

    if not text.strip():
        raise HTTPException(status_code=400, detail="Tidak ada teks yang bisa dibaca dari PDF")

    return {
        "success": True,
        "text": text.strip(),
        "filename": file.filename,
        "pages": len(text.split("\n\n")),
    }
