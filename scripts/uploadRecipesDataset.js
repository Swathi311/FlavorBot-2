const admin = require("firebase-admin");
const csv = require("csv-parser");
const fs = require("fs");


const serviceAccount = require("../src/firebase/flavorbot-8ace7-firebase-adminsdk-w09ei-2f34c6342d.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const uploadData = async () => {
  const recipesCollection = db.collection("recipes");

  fs.createReadStream("Food_Recipe.csv")
    .pipe(csv())
    .on("data", async (row) => {
      try {
        // Construct the document using the updated column names
        const recipeData = {
          name: row["name"], // Recipe name
          description: row["description"] || "No description provided", // Optional field
          cuisine: row["cuisine"] ? row["cuisine"].toLowerCase() : "unknown", // Cuisine type
          course: row["course"] || "unknown", // Course type
          diet: row["diet"] || "unknown", // Diet type
          ingredients: row["ingredients_name"]
            ? row["ingredients_name"].split(",").map((ing) => ing.trim().toLowerCase())
            : [], // Ingredients array
          ingredients_quantity: row["ingredients_quantity"]
            ? row["ingredients_quantity"].split(",").map((qty) => qty.trim())
            : [], // Quantities array
          prep_time: parseInt(row["prep_time (in mins)"], 10) || 0, // Preparation time
          cook_time: parseInt(row["cook_time (in mins)"], 10) || 0, // Cooking time
          instructions: row["instructions"]
            ? row["instructions"].split(".").map((step) => step.trim())
            : [], // Split instructions into steps
          image_url: row["image_url"] || "", // Image URL
        };

        // Add the document to Firestore
        await recipesCollection.add(recipeData);
        console.log("Uploaded:", recipeData.name);
      } catch (error) {
        console.error("Error uploading row:", row, error);
      }
    })
    .on("end", () => {
      console.log("Upload completed!");
    });
};

uploadData();
