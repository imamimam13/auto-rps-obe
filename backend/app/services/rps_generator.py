import json
from typing import Dict, Any, List, Optional
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
            return json.loads(response)
        except json.JSONDecodeError:
            # Try to extract JSON from response
            import re
            json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', response, re.DOTALL)
            if json_match:
                return json.loads(json_match.group(1))
            raise ValueError(f"Respon AI bukan JSON yang valid. Output: {response[:400]}")

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
            result = json.loads(response)
            return result.get("cpmk", result)
        except json.JSONDecodeError:
            raise ValueError(f"Respon AI bukan JSON yang valid. Output: {response[:400]}")

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
            result = json.loads(response)
            return result.get("sub_cpmk", result)
        except json.JSONDecodeError:
            raise ValueError(f"Respon AI bukan JSON yang valid. Output: {response[:400]}")

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
            result = json.loads(response)
            return result.get("rencana_pembelajaran", result)
        except json.JSONDecodeError:
            raise ValueError(f"Respon AI bukan JSON yang valid. Output: {response[:400]}")

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
            result = json.loads(response)
            return result.get("penilaian", result)
        except json.JSONDecodeError:
            raise ValueError(f"Respon AI bukan JSON yang valid. Output: {response[:400]}")

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
            return json.loads(response)
        except json.JSONDecodeError:
            raise ValueError(f"Respon AI bukan JSON yang valid. Output: {response[:400]}")

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
            return json.loads(response)
        except json.JSONDecodeError:
            raise ValueError(f"Respon AI bukan JSON yang valid. Output: {response[:400]}")


rps_generator_service = RPSGeneratorService()


async def get_rps_generator() -> RPSGeneratorService:
    return rps_generator_service