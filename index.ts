import { config } from "dotenv";
import express from "express";

config();

const app = express();

app.listen(3000, () => {
    console.log("Server is running on port 3000");
});