from abc import abstractmethod
import json
from urllib.request import urlopen, Request

class AI_Model:
    @abstractmethod
    def generate(self, prompt: str, options: dict = {}):
        pass

class OllamaModel(AI_Model):
    def __init__(self, model_name: str = "gemma4:e2b"):
        self.model_name = model_name

    def generate(self, prompt: str, options: dict = {}):
        payload = {
            "model": self.model_name,
            "prompt": prompt,
            "system": options.get("system", ""),
            "stream": True,
            "think": options.get("think", False),
        }

        with urlopen(Request(
            "http://localhost:11434/api/generate",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )) as response:
            for line in response:
                result = json.loads(line)
                if result.get("response"):
                    yield result["response"]
                if result.get("done"):
                    break