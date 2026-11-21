from abc import abstractmethod
import json
from collections.abc import Iterator
import time
from urllib.request import Request, urlopen

class AIModel:
    @abstractmethod
    def generate(self, prompt: str) -> Iterator[str]:
        pass

    def system(self, system_prompt: str) -> "AIModel":
        self.system = system_prompt
        return self


class OllamaModel(AIModel):
    def __init__(self, model_name: str = "gemma4:e2b"):
        self.model_name = model_name

    def generate(self, prompt: str) -> Iterator[str]:
        payload = json.dumps(
            {
                "model": self.model_name,
                "prompt": prompt,
                "system": self.system,
                "stream": True,
                "think": False,
            }
        ).encode("utf-8")

        request = Request(
            "http://localhost:11434/api/generate",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        with urlopen(request) as response:
            for line in response:
                result = json.loads(line)
                if result.get("response"):
                    yield result["response"]
                if result.get("done"):
                    break


class QuizGenerator:
    def __init__(self, model: AIModel):
        self.model = model.system(
          """
          Do not use markdown formatting in your response. 
          Give your response in the following JSONL format: 
          {\"question\": \"<question>\", \"answers\": \"[<answers>]\", \"correct_answer\": \"<correct_answer>\"}
          """
        )

    def generate_quiz(self, prompt: str) -> Iterator[dict]:
        running_string = ""
        for chunk in self.model.generate(prompt):
            running_string += chunk
            if running_string.endswith("\n"):
                yield json.loads(running_string.strip())
                running_string = ""
        if running_string:
            yield json.loads(running_string.strip())

    def start_quiz(self):
        quiz = self.generate_quiz("Generate 5 general knowledge quiz questions with answers.")
        score = 0

        for question in quiz:
            print(f"{question['question']}")

            for answer in question['answers']:
                print(f"- {answer}")

            print("Enter your answer (or type 'exit' to quit): ", end="")

            user_answer = input().lower()
            if user_answer == 'exit':
                break

            if(user_answer.strip() == question['correct_answer'].lower()):
                print("Correct!")
                score += 1
            else:
                print(f"Incorrect. The correct answer is: {question['correct_answer']}")

            time.sleep(1)
            print()

        print(f"Quiz finished! Your score: {score}/{5}")

if __name__ == "__main__":
    quiz_generator = QuizGenerator(OllamaModel("gemma4:e2b"))
    quiz_generator.start_quiz()