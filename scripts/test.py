import spacy

model_path = "ner_model" 
print(f"Loading the trained model from {model_path}...")
nlp = spacy.load(model_path)
print("Model loaded successfully.\n")


test_text = "DO you have a fry recipe using Paneer and Tomato?"
print(f"Testing the model on: \"{test_text}\"\n")

print(nlp.pipe_names)


doc = nlp(test_text)


print("Entities:")
if doc.ents:
    for ent in doc.ents:
        print(f"Entity: {ent.text}, Label: {ent.label_}, Start: {ent.start_char}, End: {ent.end_char}")
else:
    print("No entities found. :(\n")

print("\nTokens:")
for token in doc:
    print(f"Token: {token.text}, Tag: {token.ent_type_}")
