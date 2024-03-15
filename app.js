import "dotenv/config";
import express from "express";

const app = express();
const port = process.env.port || 5000;

app.get("/", (req, res) => {
  res.send("connect to db successfully");
});

//database
import connectDB from "./src/db/index.js";

connectDB()
  .then(() => {
    app.listen(port, () => {
      console.log(`app listening on port ${port}`);
    });
  })
  .catch(() => {
    console.log("Connection Failed");
  });
