import httpx
from typing import Optional, Dict, Any, AsyncGenerator, List
from app.core.config import settings


class AIService:
    def __init__(self):
        self.provider = settings.AI_PROVIDER
        self.base_url = settings.AI_BASE_URL.rstrip("/")
        self.model = settings.AI_MODEL
        self.api_key = settings.AI_API_KEY
        self.timeout = settings.AI_TIMEOUT
        self.client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=self.timeout,
        )

    def _get_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        format: str = "json",
    ) -> str:
        if self.provider in ("ollama", "9router"):
            return await self._generate_ollama(prompt, system_prompt, temperature, max_tokens, format)
        else:
            return await self._generate_openai_compat(prompt, system_prompt, temperature, max_tokens, format)

    async def _generate_ollama(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        format: str = "json",
    ) -> str:
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "format": format if format == "json" else None,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            },
        }
        if system_prompt:
            payload["system"] = system_prompt

        try:
            resp = await self.client.post("/api/generate", json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data.get("response", "")
        except httpx.HTTPStatusError as e:
            raise Exception(f"API error: {e.response.text}")
        except Exception as e:
            raise Exception(f"Error: {str(e)}")

    async def _generate_openai_compat(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        format: str = "json",
    ) -> str:
        messages: List[Dict[str, str]] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if format == "json":
            payload["response_format"] = {"type": "json_object"}

        try:
            resp = await self.client.post(
                "/v1/chat/completions",
                json=payload,
                headers=self._get_headers(),
            )
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            if format == "json":
                return content
            return content
        except httpx.HTTPStatusError as e:
            raise Exception(f"API error: {e.response.text}")
        except Exception as e:
            raise Exception(f"Error: {str(e)}")

    async def generate_stream(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
    ) -> AsyncGenerator[str, None]:
        if self.provider in ("ollama", "9router"):
            payload = {
                "model": self.model,
                "prompt": prompt,
                "stream": True,
                "options": {"temperature": temperature},
            }
            if system_prompt:
                payload["system"] = system_prompt
            try:
                async with self.client.stream("POST", "/api/generate", json=payload) as resp:
                    resp.raise_for_status()
                    async for line in resp.aiter_lines():
                        if line:
                            try:
                                result = resp.json()
                                yield result.get("response", "")
                            except Exception:
                                pass
            except Exception as e:
                yield f"Error: {str(e)}"
        else:
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": prompt})
            try:
                async with self.client.stream(
                    "POST",
                    "/v1/chat/completions",
                    json={"model": self.model, "messages": messages, "temperature": temperature, "stream": True},
                    headers=self._get_headers(),
                ) as resp:
                    resp.raise_for_status()
                    async for line in resp.aiter_lines():
                        if line and line.startswith("data:"):
                            if "[DONE]" in line:
                                break
                            import json
                            data = json.loads(line[5:])
                            delta = data["choices"][0].get("delta", {}).get("content", "")
                            if delta:
                                yield delta
            except Exception as e:
                yield f"Error: {str(e)}"

    async def check_available(self) -> bool:
        if self.provider in ("ollama", "9router"):
            try:
                resp = await self.client.get("/api/tags")
                return resp.status_code == 200
            except Exception:
                return False
        else:
            try:
                resp = await self.client.get("/v1/models", headers=self._get_headers())
                return resp.status_code == 200
            except Exception:
                return False

    async def list_models(self) -> list:
        if self.provider in ("ollama", "9router"):
            try:
                resp = await self.client.get("/api/tags")
                resp.raise_for_status()
                data = resp.json()
                return [m["name"] for m in data.get("models", [])]
            except Exception as e:
                raise Exception(f"Failed: {str(e)}")
        else:
            try:
                resp = await self.client.get("/v1/models", headers=self._get_headers())
                resp.raise_for_status()
                data = resp.json()
                return [m["id"] for m in data.get("data", [])]
            except Exception as e:
                raise Exception(f"Failed: {str(e)}")


ai_service = AIService()


async def get_ai() -> AIService:
    return ai_service