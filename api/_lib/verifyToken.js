import jwt from "jsonwebtoken";

export function verifyToken(req) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) {
    throw new Error("No token");
  }
  const token = auth.replace("Bearer ", "");
  return jwt.verify(token, process.env.APP_JWT_SECRET);
}
