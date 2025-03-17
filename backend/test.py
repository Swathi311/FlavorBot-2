import json

with open("cached_recipes.json", "r") as f:
    data = json.load(f)

print(json.dumps(data["recipes"][:5], indent=2))  # Print first 5 recipes for debugging
