from flask import Flask, request, jsonify
from flask_cors import CORS
import spacy
import json
import os
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from rapidfuzz import process
import pickle
import re

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "http://localhost:3000"}})

# Load trained spaCy model
MODEL_PATH = "ner_model"
if os.path.exists(MODEL_PATH):
    try:
        print("Loading trained spaCy model...")
        nlp = spacy.load(MODEL_PATH)
    except Exception as e:
        print(f"Error loading spaCy model: {e}")
        nlp = None
else:
    print("Model not found! Make sure to train it first.")
    nlp = None

# Load cached recipes and ingredient index
CACHE_FILE = "cached_recipes.json"
TFIDF_CACHE_FILE = "tfidf_data.pkl"
SUBSTITUTES_FILE = "substituents.json"

if os.path.exists(SUBSTITUTES_FILE):
    try:
        with open(SUBSTITUTES_FILE, "r") as f:
            SUBSTITUTES = json.load(f)
        print(f"Loaded {len(SUBSTITUTES)} ingredient substitutes.")
    except Exception as e:
        print(f"Error loading substitutes file: {e}")
        SUBSTITUTES = {}
else:
    print("Substitutes file not found! Please provide substituents.json.")
    SUBSTITUTES = {}

if os.path.exists(CACHE_FILE):
    try:
        with open(CACHE_FILE, "r") as f:
            cached_data = json.load(f)
        recipes = cached_data.get("recipes", [])
        ingredient_index = cached_data.get("ingredient_index", {})
        print(f"Loaded {len(recipes)} unique recipes and {len(ingredient_index)} indexed ingredients.")
    except Exception as e:
        print(f"Error loading recipe cache: {e}")
        recipes, ingredient_index = [], {}
else:
    print("Recipe cache not found! Run fetch_training_data.py first.")
    recipes, ingredient_index = [], {}

# Load TF-IDF vectors
if os.path.exists(TFIDF_CACHE_FILE):
    try:
        with open(TFIDF_CACHE_FILE, "rb") as f:
            vectorizer, recipe_vectors = pickle.load(f)
        print(f"Loaded TF-IDF vectors with shape {recipe_vectors.shape}.")
    except Exception as e:
        print(f"Error loading TF-IDF data: {e}")
        vectorizer, recipe_vectors = None, None
else:
    print("TF-IDF cache not found! Run fetch_training_data.py first.")
    vectorizer, recipe_vectors = None, None

# Extract ingredients using spaCy NER
def extract_ingredients(user_input):
    if not nlp:
        print("Warning: NLP model is missing. No ingredients will be detected.")
        return []
    doc = nlp(user_input)
    return [ent.text.lower() for ent in doc.ents if ent.label_ == "INGREDIENT"]

# Find recipes by matching extracted ingredients
def find_recipes_by_ingredients(detected_ingredients):
    recipe_ids = set()
    for ingredient in detected_ingredients:
        # Fuzzy match ingredient name
        matches = process.extract(ingredient, ingredient_index.keys(), score_cutoff=80)
        for match, _ in matches:
            recipe_ids.update(ingredient_index.get(match, []))
    return [recipe for recipe in recipes if recipe["id"] in recipe_ids]

# Extract cuisine and cook time from the query
def extract_cuisine_and_time(user_input):
    cuisine_keywords = ["italian", "indian", "mexican", "chinese", "french", "thai", "greek"]
    extracted_cuisine, extracted_time = None, None

    for word in user_input.lower().split():
        if word in cuisine_keywords:
            extracted_cuisine = word.capitalize()
            break

    time_match = re.search(r"(\d+)\s*(minutes|min|mins)", user_input, re.IGNORECASE)
    if time_match:
        extracted_time = int(time_match.group(1))

    return extracted_cuisine, extracted_time

# Find the best recipes using TF-IDF
def find_best_recipes(user_input):
    if not vectorizer or recipe_vectors is None or recipe_vectors.shape[0] == 0:
        print("Warning: TF-IDF data is missing or empty. No recommendations will be made.")
        return []

    extracted_cuisine, extracted_time = extract_cuisine_and_time(user_input)
    print(f"Extracted Cuisine: {extracted_cuisine}, Extracted Time: {extracted_time}")

    user_vector = vectorizer.transform([user_input])
    similarities = cosine_similarity(user_vector, recipe_vectors).flatten()
    top_indices = similarities.argsort()[-10:][::-1]  # Get top 10 initially

    filtered_recipes = []
    for idx in top_indices:
        recipe = recipes[idx]
        if extracted_cuisine and recipe.get("cuisine", "").lower() != extracted_cuisine.lower():
            continue
        if extracted_time:
            recipe_time = recipe.get("cook_time", 0)
            if not (recipe_time >= extracted_time - 5 and recipe_time <= extracted_time + 5):
                continue
        filtered_recipes.append(recipe)

    if not filtered_recipes:
        filtered_recipes = [recipes[i] for i in top_indices if i < len(recipes)]
    
    return filtered_recipes[:3]

# Process user query
@app.route("/process", methods=["POST"])
def process_query():
    try:
        data = request.json
        user_input = data.get("text", "").strip()
        if not user_input:
            return jsonify({"error": "Empty input"}), 400

        print(f"User Query: {user_input}")

        detected_ingredients = extract_ingredients(user_input)
        print(f"Detected Ingredients: {detected_ingredients}")

        ingredient_based_recipes = find_recipes_by_ingredients(detected_ingredients)
        best_recipes = find_best_recipes(user_input)

        all_recipes = {r["id"]: r for r in ingredient_based_recipes + best_recipes}.values()

        if not all_recipes:
            return jsonify({"recipes": {}, "message": "No matching recipes found."})

        response_recipes = {}
        key_ingredient = detected_ingredients[0] if detected_ingredients else "General"

        for recipe in all_recipes:
            response_recipes.setdefault(key_ingredient, []).append({
                "name": recipe["name"],
                "description": recipe["description"],
                "ingredients": recipe["ingredients"],
                "instructions": recipe["instructions"],
                "prep_time": recipe["prep_time"],
                "cook_time": recipe["cook_time"],
                "cuisine": recipe.get("cuisine", "Unknown"),
                "diet": recipe.get("diet", "Unknown"),
                "image_url": recipe.get("image_url", "")
            })

        return jsonify({"recipes": response_recipes})

    except Exception as e:
        print(f"ERROR: {e}")
        return jsonify({"error": "SORRY, there was an error processing your request."}), 500

# Get ingredient substitutes
@app.route("/get_substitutes", methods=["POST"])
def get_substitutes():
    try:
        data = request.json
        ingredients = data.get("ingredients", [])

        if not isinstance(ingredients, list):
            ingredients = [ingredients]

        substitutes = []
        for ingredient in ingredients:
            matches = process.extract(ingredient, SUBSTITUTES.keys(), score_cutoff=80)
            if matches:
                substitutes.extend(SUBSTITUTES.get(matches[0][0], []))

        return jsonify({"substitutes": substitutes})

    except Exception as e:
        print(f"ERROR in /get_substitutes: {e}")
        return jsonify({"error": "SORRY, there was an error processing your request."}), 500

if __name__ == "__main__":
    app.run(debug=True, port=8000)
