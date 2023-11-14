import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

// Cors Middelware
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);

// Json Middelware
app.use(express.json({ limit: "16kb" }));

// Get Request Middelware
app.use(express.urlencoded({ extended: true, limit: "16kb" }));

// Static Middelware
app.use(express.static("public"));

// Cookies Middlware
app.use(cookieParser());

export { app };
