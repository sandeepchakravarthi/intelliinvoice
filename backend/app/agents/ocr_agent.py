import hashlib
import io
from pathlib import Path
from typing import Optional

from app.core.config import get_config
from app.core.logging import get_logger


logger = get_logger(__name__)


class OCRAgent:
    """
    Agent 1: OCR Agent

    Accepts invoice file bytes (PDF or image) and extracts raw text.
    Strategy:
      - PDF with native text layer  ->  use PyMuPDF directly (fast, high accuracy)
      - PDF without text layer      ->  rasterize pages and run PaddleOCR
      - Image files                 ->  run PaddleOCR directly
    """

    def __init__(self) -> None:
        self._cfg = get_config()["ocr"]
        self._ocr_engine = None

    def _get_ocr_engine(self):
        if self._ocr_engine is None:
            from paddleocr import PaddleOCR
            self._ocr_engine = PaddleOCR(
                use_angle_cls=self._cfg["use_angle_cls"],
                lang=self._cfg["lang"],
                use_gpu=self._cfg["use_gpu"],
                show_log=False,
            )
            logger.info("PaddleOCR engine initialised")
        return self._ocr_engine

    def compute_file_hash(self, file_bytes: bytes) -> str:
        return hashlib.sha256(file_bytes).hexdigest()

    def _extract_pdf_text_layer(self, file_bytes: bytes) -> Optional[str]:
        try:
            import fitz
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            pages = [page.get_text("text") for page in doc]
            doc.close()
            combined = "\n".join(pages).strip()
            return combined if len(combined) > 50 else None
        except Exception as exc:
            logger.warning(f"PDF text layer extraction failed: {exc}")
            return None

    def _pdf_to_images(self, file_bytes: bytes) -> list:
        import fitz
        import numpy as np

        doc = fitz.open(stream=file_bytes, filetype="pdf")
        images = []
        for page in doc:
            mat = fitz.Matrix(2.0, 2.0)
            pix = page.get_pixmap(matrix=mat, alpha=False)
            arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(
                pix.height, pix.width, 3
            )
            images.append(arr)
        doc.close()
        return images

    def _run_ocr_on_array(self, image_array) -> str:
        engine = self._get_ocr_engine()
        result = engine.ocr(image_array, cls=True)
        if not result or not result[0]:
            return ""
        threshold = self._cfg["confidence_threshold"]
        lines = [
            line[1][0]
            for line in result[0]
            if line and len(line) >= 2 and line[1][1] >= threshold
        ]
        return "\n".join(lines)

    def process(self, file_bytes: bytes, filename: str) -> dict:
        file_hash = self.compute_file_hash(file_bytes)
        extension = Path(filename).suffix.lower()
        logger.info(f"OCR Agent processing: {filename} ({len(file_bytes)} bytes)")

        raw_text = ""
        confidence_score = 0.0
        method = "paddleocr"

        if extension == ".pdf":
            text_layer = self._extract_pdf_text_layer(file_bytes)
            if text_layer:
                raw_text = text_layer
                confidence_score = 0.98
                method = "pdf_text_layer"
                logger.info("Used native PDF text layer")
            else:
                images = self._pdf_to_images(file_bytes)
                parts = []
                for idx, img in enumerate(images):
                    page_text = self._run_ocr_on_array(img)
                    if page_text:
                        parts.append(f"--- Page {idx + 1} ---\n{page_text}")
                raw_text = "\n".join(parts)
                confidence_score = 0.88
                method = "paddleocr_pdf"
        else:
            from PIL import Image
            import numpy as np

            img = Image.open(io.BytesIO(file_bytes))
            if img.mode != "RGB":
                img = img.convert("RGB")
            raw_text = self._run_ocr_on_array(np.array(img))
            confidence_score = 0.90
            method = "paddleocr_image"

        if not raw_text.strip():
            raise ValueError("OCR extracted no text from the document")

        logger.info(
            f"OCR complete. method={method} chars={len(raw_text)} confidence={confidence_score}"
        )

        return {
            "raw_text": raw_text,
            "file_hash": file_hash,
            "confidence_score": confidence_score,
            "method": method,
        }
