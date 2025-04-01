from flask import Flask, request, jsonify
from flask_cors import CORS
import spacy
import json
import os
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from rapidfuzz import process
import pickle
import requests
import subprocess


app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "http://localhost:3000"}})

import json

def get_ollama_response(prompt):
    try:
        command = ["ollama", "run", "llama3.2", prompt]
        result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

        if result.returncode == 0:
          
            return result.stdout.strip()
        else:
          
            print(f"Error: {result.stderr}")
            return "Error processing your request"
    except Exception as e:
        print(f"Exception: {str(e)}")
        return "Error processing your request"

# Load trained spaCy model
MODEL_PATH = "./ner_model"
if os.path.exists(MODEL_PATH):
    print("Loading trained spaCy model...")
    try:
        nlp = spacy.load(MODEL_PATH)
    except Exception as e:
        print(f"Error loading spaCy model: {e}")
        nlp = None
else:
    print("Model not found! Make sure to train it first.")
    nlp = None  # Prevents crashes if model is missing

# Load cached recipes and ingredient index
CACHE_FILE = "./cached_recipes.json"
TFIDF_CACHE_FILE = "./tfidf_data.pkl"
SUBSTITUTES_FILE = "./substituents.json"

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
        recipes = cached_data.get("recipes", [])  # Now a list
        ingredient_index = cached_data.get("ingredient_index", {})  # Maps ingredient -> recipe IDs
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
    vectorizer, recipe_vectors = None, None  # Prevents crashes


# Function to extract ingredients using spaCy NER
def extract_ingredients(user_input):
    if not nlp:
        print("Warning: NLP model is missing. No ingredients will be detected.")
        return []

    doc = nlp(user_input)
    ingredients = [ent.text.lower() for ent in doc.ents if ent.label_ == "INGREDIENT"]
    return ingredients

# Function to find recipes by extracted ingredients
def find_recipes_by_ingredients(detected_ingredients):
    """Retrieve recipes based on detected ingredients using the ingredient index."""
    if not detected_ingredients:
        return []

    recipe_ids = set()  # Avoid duplicate recipes
    for ingredient in detected_ingredients:
        recipe_ids.update(ingredient_index.get(ingredient, []))  # Fetch recipe IDs

    # Convert IDs to actual recipes
    return [recipe for recipe in recipes if recipe["id"] in recipe_ids]

# Function to find best recipes using TF-IDF similarity
def find_best_recipes(user_input):
    if not vectorizer or recipe_vectors is None or recipe_vectors.shape[0] == 0:
        print("Warning: TF-IDF data is missing or empty. No recommendations will be made.")
        return []

    # Convert user input to a TF-IDF vector
    user_vector = vectorizer.transform([user_input])

    # Compute cosine similarity
    similarities = cosine_similarity(user_vector, recipe_vectors).flatten()
    top_indices = similarities.argsort()[-3:][::-1]  # Highest to lowest similarity

    # Filter out low-similarity matches
    valid_indices = [i for i in top_indices if similarities[i] > 0.1]

    if not valid_indices:
        print("No relevant recipes found.")
        return []

    return [recipes[i] for i in valid_indices if i < len(recipes)] 


from transformers import pipeline

# Load Hugging Face zero-shot classifier
classifier = pipeline("zero-shot-classification", model="facebook/bart-large-mnli")

def classify_intent(query):
    labels = ["recipe", "greeting"]
    result = classifier(query, labels)

    intent = result["labels"][0]  # Get top predicted intent
    confidence = result["scores"][0]

    print(f"Intent Classification -> Query: {query}, Intent: {intent}, Confidence: {confidence}")
    return intent

@app.route("/process", methods=["POST"])
def process_query():
    try:
        data = request.json
        user_input = data.get("text", "").strip()

        if not user_input:
            return jsonify({"error": "Empty input"}), 400

        print(f"User Query: {user_input}")

        # Classify user intent
        intent = classify_intent(user_input)

        if intent == "greeting":
            response = get_ollama_response(user_input)
            return jsonify({"message": response})

        # If not greeting, process as a recipe-related query
        detected_ingredients = extract_ingredients(user_input)
        print(f"Detected Ingredients: {detected_ingredients}")

        ingredient_based_recipes = find_recipes_by_ingredients(detected_ingredients)
        best_recipes = find_best_recipes(user_input)

        # Combine recipes and remove duplicates
        all_recipes = {r["id"]: r for r in ingredient_based_recipes + best_recipes}.values()

        if not all_recipes:
            print("No matching recipes found.")
            return jsonify({"recipes": {}, "message": "No matching recipes found."})

        # Format response
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
                "image_url": recipe.get("image_url", "")
            })
            return jsonify({"recipes": response_recipes})

    except Exception as e:
        print(f"ERROR: {e}")
        return jsonify({"error": "SORRY, there was an error processing your request."}), 500


@app.route("/get_substitutes", methods=["POST"])
def get_substitutes():
    try:
        data = request.json
        
        ingredients = data.get("ingredients", [])

        if not ingredients:
            return jsonify({"error": "No ingredients provided"}), 400

        if not isinstance(ingredients, list):
            ingredients = [ingredients] if ingredients else []
    
        substitutes = []
        threshold=80
        for ingredient in ingredients:
            matches = process.extract(ingredient, SUBSTITUTES.keys(), score_cutoff=threshold)
            if matches:
                best_match = matches[0][0]  # Get the best match (highest score)
                substitutes.extend(SUBSTITUTES.get(best_match, []))

        return jsonify({"substitutes": substitutes})

    except Exception as e:
        print(f"ERROR in /get_substitutes: {e}")
        return jsonify({"error": "SORRY, there was an error processing your request."}), 500



if __name__ == "__main__":
    app.run(debug=True, port=8000)
