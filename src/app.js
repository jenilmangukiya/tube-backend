import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

// Cors Middleware
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);

// Json Middleware
app.use(express.json({ limit: "16kb" }));

// Get Request Middleware
app.use(express.urlencoded({ extended: true, limit: "16kb" }));

// Static Middleware
app.use(express.static("public"));

// Cookies Middleware
app.use(cookieParser());

export { app };
