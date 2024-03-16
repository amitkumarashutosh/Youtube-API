import "dotenv/config";
import express from "express";

const app = express();
const port = process.env.port || 5000;

//rest of the packages
import cookieParser from "cookie-parser";
import cors from "cors";

app.use(cors());
app.use(express.json({ limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

//routes
import userRouter from "./src/routes/user.route.js";

app.use("/api/v1/users", userRouter);

//not found
import notFound from "./src/utils/notFound.js";
app.use(notFound);

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
