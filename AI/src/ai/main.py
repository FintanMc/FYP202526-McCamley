from ai.AI_models.AI_Model import OllamaModel
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def read_root():
    return {"Hello": "World"}

llm = OllamaModel(model_name="gemma4:e2b")

@app.post("/generate/")
async def generate():
    for chunk in llm.generate(prompt="Count to 10"):
        yield chunk