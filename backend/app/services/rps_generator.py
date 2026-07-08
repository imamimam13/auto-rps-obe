import json
from typing import Dict, Any, List, Optional
import re
from app.services.ollama_service import ai_service as ollama_service
from app.prompts.rps_prompts import (
    RPS_GENERATION_SYSTEM_PROMPT,
    RPS_GENERATION_PROMPT,
    RPS_REVIEW_PROMPT,
    RPS_IMPROVE_PROMPT,
    OBE_VALIDATION_SYSTEM_PROMPT,
    OBE_VALIDATION_PROMPT,
    CPMK_GENERATION_PROMPT,
    SUB_CPMK_GENERATION_PROMPT,
    RENCANA_MINGGUAN_PROMPT,
    PENILAIAN_GENERATION_PROMPT,
)


def repair_truncated_json(json_str: str) -> str:
    """Balance open brackets, braces, and quotes in truncated JSON strings to make them parsable."""
    json_str = json_str.strip()
    if not json_str:
        return json_str
        
    try:
        json.loads(json_str)
        return json_str
    except ValueError:
        pass

    in_string = False
    escape = False
    stack = []
    repaired_chars = []
    
    for char in json_str:
        if escape:
            escape = False
            repaired_chars.append(char)
            continue
            
        if char == '\\':
            escape = True
            repaired_chars.append(char)
            continue
            
        if char == '"':
            in_string = not in_string
            repaired_chars.append(char)
            continue
            
        if in_string:
            repaired_chars.append(char)
            continue
            
        if char in ('{', '['):
            stack.append(char)
        elif char in ('}', ']'):
            if stack:
                top = stack[-1]
                if (char == '}' and top == '{') or (char == ']' and top == '['):
                    stack.pop()
                else:
                    continue
            else:
                continue
                
        repaired_chars.append(char)

    repaired_str = "".join(repaired_chars)
    
    if in_string:
        repaired_str += '"'
        
    repaired_str = repaired_str.rstrip()
    if repaired_str.endswith(','):
        repaired_str = repaired_str[:-1].rstrip()
        
    while stack:
        top = stack.pop()
        repaired_str = repaired_str.rstrip()
        if top == '{':
            if repaired_str.endswith(':'):
                repaired_str += ' null'
            elif repaired_str.endswith(','):
                repaired_str = repaired_str[:-1].rstrip()
            repaired_str += '}'
        elif top == '[':
            if repaired_str.endswith(','):
                repaired_str = repaired_str[:-1].rstrip()
            repaired_str += ']'
            
    try:
        json.loads(repaired_str)
        return repaired_str
    except ValueError:
        pass
        
    return json_str


def extract_json(text: str) -> Any:
    """Robustly extract and parse JSON from LLM outputs, handling conversational text, code blocks, and truncation."""
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
        
    # 1. Coba cari di dalam markdown code block: ```json ... ``` atau ``` ... ```
    code_block_match = re.search(r'```(?:json)?\s*(.*?)\s*```', text, re.DOTALL)
    if code_block_match:
        content = code_block_match.group(1).strip()
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            try:
                repaired = repair_truncated_json(content)
                return json.loads(repaired)
            except Exception:
                pass
            
    # 2. Coba cari dengan mendeteksi posisi kurung kurawal/siku pertama dan terakhir
    start_idx = -1
    for i, char in enumerate(text):
        if char in ('{', '['):
            start_idx = i
            break
            
    if start_idx != -1:
        candidate = text[start_idx:]
        try:
            repaired = repair_truncated_json(candidate)
            return json.loads(repaired)
        except Exception:
            pass
            
    raise ValueError("Respon AI tidak berisi format JSON yang valid.")


class RPSGeneratorService:
    
    async def generate_complete_rps(
        self,
        visi_prodi: str,
        misi_prodi: str,
        cpl_prodi: List[Dict[str, Any]],
        mata_kuliah: Dict[str, Any],
        semester: int,
        tahun_akademik: str,
        additional_context: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generate complete RPS from prodi vision, mission, and course info"""
        
        prompt = RPS_GENERATION_PROMPT.format(
            visi_prodi=visi_prodi,
            misi_prodi=misi_prodi,
            cpl_prodi=json.dumps(cpl_prodi, indent=2),
            nama_mata_kuliah=mata_kuliah.get("nama", ""),
            kode_mata_kuliah=mata_kuliah.get("kode", ""),
            sks=mata_kuliah.get("sks", 3),
            sks_teori=mata_kuliah.get("sks_teori", 2),
            sks_praktik=mata_kuliah.get("sks_praktik", 1),
            deskripsi_mata_kuliah=mata_kuliah.get("deskripsi", ""),
            semester=semester,
            tahun_akademik=tahun_akademik,
            additional_context=additional_context or "",
        )
        
        response = await ollama_service.generate(
            prompt=prompt,
            system_prompt=RPS_GENERATION_SYSTEM_PROMPT,
            temperature=0.3,
            max_tokens=8192,
        )
        
        try:
            rps_data = extract_json(response)
            
            # Post-process defaults if configured
            from app.core.config import settings
            if "identitas" in rps_data and isinstance(rps_data["identitas"], dict):
                if settings.DEFAULT_KOORDINATOR_PENGEMBANG:
                    rps_data["identitas"]["koordinator_pengembang_rps"] = settings.DEFAULT_KOORDINATOR_PENGEMBANG
                if settings.DEFAULT_KOORDINATOR_RMK:
                    rps_data["identitas"]["koordinator_rmk"] = settings.DEFAULT_KOORDINATOR_RMK
                if settings.DEFAULT_KA_PRODI:
                    rps_data["identitas"]["ka_prodi"] = settings.DEFAULT_KA_PRODI
                    
            return rps_data
        except Exception as e:
            raise ValueError(f"Respon AI bukan JSON yang valid. Detail: {str(e)}. Output: {response[:400]}")

    async def generate_cpmk(
        self,
        visi_prodi: str,
        misi_prodi: str,
        cpl_prodi: List[Dict[str, Any]],
        nama_mk: str,
        deskripsi_mk: str,
    ) -> List[Dict[str, Any]]:
        prompt = CPMK_GENERATION_PROMPT.format(
            visi_prodi=visi_prodi,
            misi_prodi=misi_prodi,
            cpl_prodi=json.dumps(cpl_prodi, indent=2),
            nama_mk=nama_mk,
            deskripsi_mk=deskripsi_mk,
        )
        
        response = await ollama_service.generate(
            prompt=prompt,
            system_prompt=RPS_GENERATION_SYSTEM_PROMPT,
            temperature=0.3,
        )
        
        try:
            result = extract_json(response)
            return result.get("cpmk", result)
        except Exception as e:
            raise ValueError(f"Respon AI bukan JSON yang valid. Detail: {str(e)}. Output: {response[:400]}")

    async def generate_sub_cpmk(
        self,
        cpmk_list: List[Dict[str, Any]],
        nama_mk: str,
    ) -> List[Dict[str, Any]]:
        prompt = SUB_CPMK_GENERATION_PROMPT.format(
            cpmk=json.dumps(cpmk_list, indent=2),
            nama_mk=nama_mk,
        )
        
        response = await ollama_service.generate(
            prompt=prompt,
            temperature=0.3,
        )
        
        try:
            result = extract_json(response)
            return result.get("sub_cpmk", result)
        except Exception as e:
            raise ValueError(f"Respon AI bukan JSON yang valid. Detail: {str(e)}. Output: {response[:400]}")

    async def generate_rencana_mingguan(
        self,
        cpmk: List[Dict[str, Any]],
        sub_cpmk: List[Dict[str, Any]],
        sks: int,
    ) -> List[Dict[str, Any]]:
        prompt = RENCANA_MINGGUAN_PROMPT.format(
            cpmk=json.dumps(cpmk, indent=2),
            sub_cpmk=json.dumps(sub_cpmk, indent=2),
            sks=sks,
        )
        
        response = await ollama_service.generate(
            prompt=prompt,
            temperature=0.3,
        )
        
        try:
            result = extract_json(response)
            return result.get("rencana_pembelajaran", result)
        except Exception as e:
            raise ValueError(f"Respon AI bukan JSON yang valid. Detail: {str(e)}. Output: {response[:400]}")

    async def generate_penilaian(
        self,
        cpmk: List[Dict[str, Any]],
        sub_cpmk: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        prompt = PENILAIAN_GENERATION_PROMPT.format(
            cpmk=json.dumps(cpmk, indent=2),
            sub_cpmk=json.dumps(sub_cpmk, indent=2),
        )
        
        response = await ollama_service.generate(
            prompt=prompt,
            temperature=0.3,
        )
        
        try:
            result = extract_json(response)
            return result.get("penilaian", result)
        except Exception as e:
            raise ValueError(f"Respon AI bukan JSON yang valid. Detail: {str(e)}. Output: {response[:400]}")

    async def validate_obe(self, rps_data: Dict[str, Any]) -> Dict[str, Any]:
        prompt = OBE_VALIDATION_PROMPT.format(
            rps_data=json.dumps(rps_data, indent=2),
        )
        
        response = await ollama_service.generate(
            prompt=prompt,
            system_prompt=OBE_VALIDATION_SYSTEM_PROMPT,
            temperature=0.2,
        )
        
        try:
            return extract_json(response)
        except Exception as e:
            raise ValueError(f"Respon AI bukan JSON yang valid. Detail: {str(e)}. Output: {response[:400]}")

    async def review_and_improve(self, rps_data: Dict[str, Any], feedback: str) -> Dict[str, Any]:
        prompt = RPS_IMPROVE_PROMPT.format(
            rps_data=json.dumps(rps_data, indent=2),
            feedback=feedback,
        )
        
        response = await ollama_service.generate(
            prompt=prompt,
            system_prompt=RPS_GENERATION_SYSTEM_PROMPT,
            temperature=0.3,
        )
        
        try:
            return extract_json(response)
        except Exception as e:
            raise ValueError(f"Respon AI bukan JSON yang valid. Detail: {str(e)}. Output: {response[:400]}")


rps_generator_service = RPSGeneratorService()


async def get_rps_generator() -> RPSGeneratorService:
    return rps_generator_service