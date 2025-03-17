const admin = require("firebase-admin");
const fs = require("fs");

// Load Firebase credentials
const serviceAccount = require("../src/firebase/flavorbot-8ace7-firebase-adminsdk-w09ei-c8bc67f813.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Read the JSON file
const substituentsFile = "scripts/indian_substitutes.json";
const uploadSubstituents = async () => {
  try {
    const data = JSON.parse(fs.readFileSync(substituentsFile, "utf8"));
    const substituentsCollection = db.collection("substituents");

    for (const [ingredient, substitutes] of Object.entries(data)) {
      const docRef = substituentsCollection.doc(ingredient);

      // Check if the document already exists
      const doc = await docRef.get();
      if (doc.exists) {
        const existingData = doc.data();
        if (existingData.substitutes) {
          // Merge new substitutes while avoiding duplicates
          const updatedSubstitutes = [
            ...new Set([...existingData.substitutes, ...substitutes]),
          ];
          await docRef.set({ substitutes: updatedSubstitutes });
          console.log(`Updated ${ingredient}:`, updatedSubstitutes);
        } else {
          await docRef.set({ substitutes });
          console.log(`Added ${ingredient}:`, substitutes);
        }
      } else {
        await docRef.set({ substitutes });
        console.log(`Added ${ingredient}:`, substitutes);
      }
    }

    console.log("Substituents upload completed!");
  } catch (error) {
    console.error("Error uploading substituents:", error);
  }
};

// Run the upload function
uploadSubstituents();
