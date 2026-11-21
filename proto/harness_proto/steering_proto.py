import torch
from transformers import AutoProcessor, AutoModelForConditionalGeneration

device = "cuda" if torch.cuda.is_available() else "cpu"
model_id = "google/gemma-4-E2B-it"

processor = AutoProcessor.from_pretrained(model_id)
model = AutoModelForConditionalGeneration.from_pretrained(
    model_id, 
    torch_dtype=torch.bfloat16
).to(device)

def get_target_layer(model, layer_idx: int):
    """Safely retrieves the decoder layer across Gemma 4 configurations."""
    if hasattr(model, "language_model"):
        return model.language_model.model.layers[layer_idx]
    elif hasattr(model, "model"):
        return model.model.layers[layer_idx]
    else:
        raise AttributeError("Could not locate language layers. Print model structure using `print(model)`.")

def extract_activation(model, processor, prompt: str, layer_idx: int):
    activations = []

    def hook_fn(module, input, output):
        # Extract tensor safely handling tuple wrapper
        tensor = output[0] if isinstance(output, tuple) else output

        # Process 3D (batch, seq, hidden) vs 2D (batch, hidden)
        if tensor.dim() == 3:
            activations.append(tensor[:, -1, :].detach())
        elif tensor.dim() == 2:
            activations.append(tensor.detach())

    target_layer = get_target_layer(model, layer_idx)
    handle = target_layer.register_forward_hook(hook_fn)

    inputs = processor(text=prompt, return_tensors="pt").to(device)
    with torch.no_grad():
        model(**inputs)

    handle.remove()
    return activations[0]

# Extract activation for Gemma 4 (e.g., layer 12)
layer_idx = 12
pos_act = extract_activation(model, processor, "I love technology.", layer_idx)
neg_act = extract_activation(model, processor, "I hate technology.", layer_idx)

# Compute steering vector
steering_vector = pos_act - neg_act

class SteeringHook:
    def __init__(self, steering_vector: torch.Tensor, multiplier: float = 1.0):
        self.steering_vector = steering_vector
        self.multiplier = multiplier

    def __call__(self, module, input, output):
        if isinstance(output, tuple):
            hidden_states = output[0]
            modified = hidden_states + (self.multiplier * self.steering_vector)
            return (modified,) + output[1:]
        else:
            return output + (self.multiplier * self.steering_vector)

def generate_steered(model, processor, prompt: str, layer_idx: int, steering_vector: torch.Tensor, multiplier: float = 1.0):
    target_layer = get_target_layer(model, layer_idx)
    
    hook = SteeringHook(steering_vector, multiplier=multiplier)
    handle = target_layer.register_forward_hook(hook)

    inputs = processor(text=prompt, return_tensors="pt").to(device)

    with torch.no_grad():
        outputs = model.generate(**inputs, max_new_tokens=40)

    handle.remove()
    return processor.decode(outputs[0], skip_special_tokens=True)

# Test steered generation
print(generate_steered(model, processor, "The future of AI is", layer_idx, steering_vector, multiplier=2.0))