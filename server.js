import express from "express";
import cors from "cors";
import { createClient } from "@libsql/client";

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Conexión a Turso
const db = createClient({
  url: "libsql://logs-eze-ramoss.aws-us-west-2.turso.io",
  authToken: "", // deja vacío si no configuraste auth token
});

// Crear tabla si no existe
(async () => {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS visits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL,
      ip TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log("✅ Tabla visits lista");
})();

// Endpoint para registrar visitas
app.post("/track", async (req, res) => {
  try {
    const { path } = req.body;
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    await db.execute("INSERT INTO visits (path, ip) VALUES (?, ?)", [path, ip]);
    res.status(201).json({ success: true });
  } catch (error) {
    console.error("Error guardando visita:", error);
    res.status(500).json({ error: "Error guardando visita" });
  }
});

// Endpoint para obtener logs
app.get("/logs", async (req, res) => {
  try {
    const result = await db.execute("SELECT * FROM visits ORDER BY created_at DESC LIMIT 200");
    res.json(result.rows);
  } catch (error) {
    console.error("Error obteniendo logs:", error);
    res.status(500).json({ error: "Error obteniendo logs" });
  }
});

app.listen(port, () => console.log(`🚀 Backend corriendo en puerto ${port}`));
