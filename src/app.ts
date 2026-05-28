import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes";
import bookingRoutes from "./routes/booking.routes";
import userRoutes from "./routes/user.routes";
import reviewRoutes from "./routes/review.routes";
import { errorHandler, notFound } from "./middleware/error.middleware";

const app = express();

app.use(
  cors({
    origin: "http://localhost:3001",
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.get("/", (_req, res) => {
  res.send("SkillLink backend is running 🚀");
});

app.use("/api/auth", authRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/users", userRoutes);
app.use("/api/reviews", reviewRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;