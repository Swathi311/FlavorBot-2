import firebase_admin
from firebase_admin import credentials, firestore
import json
import os
from sklearn.feature_extraction.text import TfidfVectorizer
import numpy as np
import pickle  

CACHE_FILE = "cached_recipes.json"
TFIDF_CACHE_FILE = "tfidf_data.pkl"

# Function to fetch and cache data from Firebase
def fetch_recipes():
    """Fetch recipes from Firebase in batches and cache them, avoiding duplicate storage."""
    
    # Load from cache if it exists
    if os.path.exists(CACHE_FILE): 
        print("Loading cached data instead of fetching from Firebase...")
        with open(CACHE_FILE, "r") as f:
            cached_data = json.load(f)
        return cached_data["recipes"], cached_data.get("ingredient_index", {})

    print("Fetching data from Firebase...")

    # Initialize Firebase if not already initialized
    if not firebase_admin._apps:
        cred = credentials.Certificate("backend/serviceAccountKey.json")
        firebase_admin.initialize_app(cred)

    db = firestore.client()
    BATCH_SIZE = 50
    recipes = []  # Stores unique recipes
    ingredient_index = {}  # Maps ingredients to recipe IDs
    recipe_ids = {}  # Maps recipe names to unique IDs
    last_doc = None
    recipe_counter = 1  # Unique recipe ID generator

    while True:
        try:
            query = db.collection("recipes").order_by("name").limit(BATCH_SIZE)
            if last_doc:
                query = query.start_after(last_doc)

            recipe_docs = query.stream()
            batch_data = list(recipe_docs)

            if not batch_data:
                break 

            for doc in batch_data:
                data = doc.to_dict()
                recipe_name = data.get("name")
                recipe_ingredients = data.get("ingredients", [])

                # Assign a unique ID to each recipe (avoid duplication)
                if recipe_name in recipe_ids:
                    recipe_id = recipe_ids[recipe_name]
                else:
                    recipe_id = recipe_counter
                    recipe_counter += 1
                    recipe_ids[recipe_name] = recipe_id

                    # Store unique recipe
                    recipes.append({
                        "id": recipe_id,
                        "name": recipe_name,
                        "description": data.get("description", ""),
                        "ingredients": recipe_ingredients,
                        "instructions": data.get("instructions", []),
                        "prep_time": data.get("prep_time", "Unknown"),
                        "cook_time": data.get("cook_time", "Unknown"),
                        "image_url": data.get("image_url", "")
                    })

                # Build ingredient index (ingredient → recipe IDs)
                for ingredient in recipe_ingredients:
                    ingredient = ingredient.lower()
                    if ingredient not in ingredient_index:
                        ingredient_index[ingredient] = []
                    if recipe_id not in ingredient_index[ingredient]:
                        ingredient_index[ingredient].append(recipe_id)

            last_doc = batch_data[-1]
            print(f"Fetched {len(batch_data)} recipes...")

        except firebase_admin.exceptions.FirebaseError as e:
            print(f"Error fetching data: {e}")
            break

    # Store cache with recipe IDs and ingredient index
    with open(CACHE_FILE, "w") as f:
        json.dump({"recipes": recipes, "ingredient_index": ingredient_index}, f)

    print("Data fetching complete and cached.")
    return recipes, ingredient_index


# Function to compute TF-IDF vectors for recipes
def compute_tfidf_vectors(recipes):
    """Precompute TF-IDF vectors for unique recipes and cache them."""
    
    if os.path.exists(TFIDF_CACHE_FILE):
        print("Loading precomputed TF-IDF vectors...")
        with open(TFIDF_CACHE_FILE, "rb") as f:
            vectorizer, recipe_vectors = pickle.load(f)
        return vectorizer, recipe_vectors

    print("Computing TF-IDF vectors...")
    vectorizer = TfidfVectorizer(stop_words='english')

    print(f"DEBUG: Number of unique recipes -> {len(recipes)}")

    recipe_texts = []

    for recipe in recipes:
        if isinstance(recipe, dict):  # Ensure it's a dictionary
            text = recipe.get("description", "") + " " + " ".join(recipe.get("ingredients", []))
            recipe_texts.append(text)

    print(f"DEBUG: Number of processed recipe texts -> {len(recipe_texts)}")
    
    # If empty, handle error before vectorization
    if not recipe_texts:
        raise ValueError("No valid recipe texts found for TF-IDF vectorization.")

    # Compute TF-IDF vectors
    recipe_vectors = vectorizer.fit_transform(recipe_texts)

    # Cache TF-IDF data
    with open(TFIDF_CACHE_FILE, "wb") as f:
        pickle.dump((vectorizer, recipe_vectors), f)

    print("TF-IDF vectors computed and cached.")
    return vectorizer, recipe_vectors


# Fetch data and process
recipes, ingredient_index = fetch_recipes()
vectorizer, recipe_vectors = compute_tfidf_vectors(recipes)
