import spacy
from spacy.training import offsets_to_biluo_tags

def debug_biluo_tags():
    # Example texts and corrected offsets for both cases
    text1 = "Paneer Makhana curry is delicious."
    entities1 = [(0, 6, "INGREDIENT"), (7, 14, "INGREDIENT")]  # Separate ingredients

    text2 = "Paneer mousse recipe is easy to make."
    entities2 = [(0, 6, "INGREDIENT")]  # Single ingredient

    # Convert to BILUO tags for both examples
    nlp = spacy.blank("en")  # Create a blank English model

    # Example 1: "Paneer Makhana curry"
    doc1 = nlp.make_doc(text1)
    tags1 = offsets_to_biluo_tags(doc1, entities1)
    print(f"Text: {text1}")
    print(f"BILUO tags: {tags1}")
    
    # Example 2: "Paneer mousse recipe"
    doc2 = nlp.make_doc(text2)
    tags2 = offsets_to_biluo_tags(doc2, entities2)
    print(f"Text: {text2}")
    print(f"BILUO tags: {tags2}")

if __name__ == "__main__":
    debug_biluo_tags()
