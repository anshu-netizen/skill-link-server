import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.routes";
import bookingRoutes from "./routes/booking.routes";
import userRoutes from "./routes/user.routes";
import { errorHandler, notFound } from "./middleware/error.middleware";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: 'http://localhost:3001',
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.send("SkillLink backend is running 🚀");
});

app.use("/api/auth", authRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/users", userRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;