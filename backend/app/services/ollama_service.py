import httpx
from typing import Optional, Dict, Any, AsyncGenerator, List
from app.core.config import settings


class AIService:
    def __init__(self):
        self.provider = settings.AI_PROVIDER
        self.base_url = settings.AI_BASE_URL.rstrip("/")
        self.model = settings.AI_MODEL
        self.api_key = settings.AI_API_KEY
        self.timeout = max(300, getattr(settings, "AI_TIMEOUT", 300))
        self.client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=self.timeout,
        )

    def _get_client(self) -> httpx.AsyncClient:
        current_base_url = settings.AI_BASE_URL.rstrip("/")
        current_timeout = max(300, getattr(settings, "AI_TIMEOUT", 300))
        if self.client.is_closed or str(self.client.base_url).rstrip("/") != current_base_url:
            self.client = httpx.AsyncClient(
                base_url=current_base_url,
                timeout=current_timeout,
            )
        return self.client

    def _get_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        api_key = settings.AI_API_KEY or self.api_key
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"
        return headers

    async def generate(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
        format: str = "json",
    ) -> str:
        provider = settings.AI_PROVIDER or self.provider
        if provider in ("ollama", "9router"):
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
        model = settings.AI_MODEL or self.model
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "format": format if format == "json" else None,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
                "num_ctx": 8192,
            },
        }
        if system_prompt:
            payload["system"] = system_prompt

        try:
            client = self._get_client()
            resp = await client.post("/api/generate", json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data.get("response", "")
        except httpx.HTTPStatusError as e:
            print(f"[AI HTTP ERROR] {e.response.status_code}: {e.response.text[:500]}")
            raise Exception(f"API error: {e.response.text[:500]}")
        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"[AI ERROR] {e}")
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

        model = settings.AI_MODEL or self.model
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if format == "json":
            payload["response_format"] = {"type": "json_object"}

        client = self._get_client()
        try:
            resp = await client.post(
                "/v1/chat/completions",
                json=payload,
                headers=self._get_headers(),
            )
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            return content
        except httpx.HTTPStatusError as e:
            if format == "json" and "response_format" in payload:
                print(f"[AI WARNING] OpenAI-compat JSON mode failed ({e.response.status_code}), retrying without response_format...")
                del payload["response_format"]
                try:
                    resp = await client.post(
                        "/v1/chat/completions",
                        json=payload,
                        headers=self._get_headers(),
                    )
                    resp.raise_for_status()
                    data = resp.json()
                    content = data["choices"][0]["message"]["content"]
                    return content
                except Exception as retry_err:
                    print(f"[AI ERROR] Fallback failed: {retry_err}")
                    raise Exception(f"API error (JSON mode failed, fallback also failed): {str(retry_err)}")
            
            print(f"[AI HTTP ERROR] {e.response.status_code}: {e.response.text[:500]}")
            raise Exception(f"API error: {e.response.text[:500]}")
        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"[AI ERROR] {e}")
            raise Exception(f"Error: {str(e)}")

    async def generate_stream(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
    ) -> AsyncGenerator[str, None]:
        provider = settings.AI_PROVIDER or self.provider
        model = settings.AI_MODEL or self.model
        client = self._get_client()
        if provider in ("ollama", "9router"):
            payload = {
                "model": model,
                "prompt": prompt,
                "stream": True,
                "options": {"temperature": temperature, "num_ctx": 8192, "num_predict": 4096},
            }
            if system_prompt:
                payload["system"] = system_prompt
            try:
                async with client.stream("POST", "/api/generate", json=payload) as resp:
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
                async with client.stream(
                    "POST",
                    "/v1/chat/completions",
                    json={"model": model, "messages": messages, "temperature": temperature, "stream": True},
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
        provider = settings.AI_PROVIDER or self.provider
        client = self._get_client()
        if provider in ("ollama", "9router"):
            try:
                resp = await client.get("/api/tags")
                return resp.status_code == 200
            except Exception:
                return False
        else:
            try:
                resp = await client.get("/v1/models", headers=self._get_headers())
                return resp.status_code == 200
            except Exception:
                return False

    async def list_models(self) -> list:
        provider = settings.AI_PROVIDER or self.provider
        client = self._get_client()
        if provider in ("ollama", "9router"):
            try:
                resp = await client.get("/api/tags")
                resp.raise_for_status()
                data = resp.json()
                return [m["name"] for m in data.get("models", [])]
            except Exception as e:
                raise Exception(f"Failed: {str(e)}")
        else:
            try:
                resp = await client.get("/v1/models", headers=self._get_headers())
                resp.raise_for_status()
                data = resp.json()
                return [m["id"] for m in data.get("data", [])]
            except Exception as e:
                raise Exception(f"Failed: {str(e)}")


ai_service = AIService()
ollama_service = ai_service  # alias for backward compat


async def get_ai() -> AIService:
    return ai_service