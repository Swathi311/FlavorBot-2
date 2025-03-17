import spacy
from spacy.training.example import Example
import json
import os
import random

MODEL_PATH = "./ner_model"

# Load query formats from training_data.json
with open("backend/training_data.json", "r") as f:
    QUERY_FORMATS = json.load(f)

# Load unique ingredients from cached_recipes.json
with open("cached_recipes.json", "r") as f:
    cached_data = json.load(f)

# Extract unique ingredients from recipes
unique_ingredients = set()
for recipe in cached_data["recipes"]:
    unique_ingredients.update(recipe["ingredients"])

unique_ingredients = list(unique_ingredients)  # Convert set to list

# Dynamically generate TRAIN_DATA
TRAIN_DATA = []
for ingredient in unique_ingredients:
    for query in QUERY_FORMATS:
        text = query["text"].format(ingredient)  # Insert ingredient into query

        start = text.find(ingredient)  # Find actual position
        if start == -1:
            continue  # Skip if ingredient is not found (shouldn't happen)

        end = start + len(ingredient)
        
        TRAIN_DATA.append((text, {"entities": [(start, end, "INGREDIENT")]}))

# Print sample training data
print("Generated Training Data Sample:")
for sample in TRAIN_DATA[:5]:  
    print(sample)

# Load existing model if available, else create a new one
if os.path.exists(MODEL_PATH):
    print(f"Loading existing model from {MODEL_PATH}")
    nlp = spacy.load(MODEL_PATH)
    optimizer = nlp.resume_training()  # Resume training
else:
    print("Creating a new blank model...")
    nlp = spacy.blank("en")
    ner = nlp.add_pipe("ner", last=True)  # Ensure NER pipeline exists

# Ensure NER pipeline is available
if "ner" not in nlp.pipe_names:
    ner = nlp.add_pipe("ner", last=True)
else:
    ner = nlp.get_pipe("ner")

# Add labels dynamically
for _, annotations in TRAIN_DATA:
    for ent in annotations["entities"]:
        ner.add_label(ent[2])

# Train model
n_iter = 10  # Reduce iterations for efficiency

for itn in range(n_iter):
    print(f"Iteration {itn + 1}/{n_iter}")
    losses = {}

    random.shuffle(TRAIN_DATA)  # Shuffle for better learning

    for text, annotations in TRAIN_DATA:
        doc = nlp.make_doc(text)
        example = Example.from_dict(doc, annotations)

        try:
            nlp.update([example], losses=losses, drop=0.3)
        except Exception as e:
            print(f"Error during training: {e}")
    
    print(f"Iteration {itn + 1} Losses: {losses}")

# Save updated model
nlp.to_disk(MODEL_PATH)
print(f"Model updated and saved to {MODEL_PATH}")
