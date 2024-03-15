import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const { connection } = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MONGO_DB CONNECTED SUCCESSFULLY! DB_HOST:${connection.host}`);
  } catch (error) {
    console.log(`FAILED TO CONNECT TO DB, ${error}`);
    process.exit(1);
  }
};

export default connectDB;
