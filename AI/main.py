from fastapi import FastAPI

print("Starting FastAPI application...")

def startup_event():
    print("Starting up...")

app = FastAPI(on_startup=[startup_event])

@app.get("/")
def read_root():
    return {"Hello": "World"}


@app.get("/items/{item_id}")
def read_item(item_id: int, q: str | None = None):
    return {"item_id": item_id, "q": q}