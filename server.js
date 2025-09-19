

/* import express from "express";
import cors from "cors";
import { createClient } from "@libsql/client"; */
const express = require("express");
const cors = require("cors");
const { createClient } = require("@libsql/client");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Conexión a Turso
const db = createClient({
  url: "libsql://logs-eze-ramoss.aws-us-west-2.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NTgyMjUyMjIsImlkIjoiMzkxMDgxYTYtNDYyNS00MGZjLWExZGMtMDQwYTUxYzA0ZGY2IiwicmlkIjoiYTQ1NjFjYWMtNjY2Yy00MzRiLWJjNzEtOGVkZWNkZGI3NGI5In0.A_6mWVdyAp0_qKZypBm_5jlOvLZh8SMaN3bESVPqBgubiwIgYdTsItrVkvqzsrZh8q31dmI1_yKLSS2OkyxFCQ",
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

// -------------------- Cola de visitas --------------------
const queue = [];
const BATCH_SIZE = 50; // cuántos inserts por vez
const INTERVAL = 200;  // cada cuántos ms se procesan

setInterval(async () => {
  if (queue.length === 0) return;

  const batch = queue.splice(0, BATCH_SIZE); // toma un batch
  const queries = batch.map(item =>
    db.execute("INSERT INTO visits (path, ip) VALUES (?, ?)", [item.path, item.ip])
  );

  try {
    await Promise.all(queries);
    console.log(`[COLA] Insertadas ${batch.length} visitas`);
  } catch (err) {
    console.error("Error insertando batch:", err);
    queue.unshift(...batch); // vuelve a poner batch al inicio si falla
  }
}, INTERVAL);

// -------------------- Endpoints --------------------

// Recibe visitas
app.post("/track", (req, res) => {
  const { path } = req.body;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  // En vez de insertar directamente, lo agregamos a la cola
  queue.push({ path, ip });

  console.log(`[QUEUE] ${path} - ${ip} (cola: ${queue.length})`);
  res.status(201).json({ success: true });
});




app.get("/track", (req, res) => {
  const path = req.query.path; // <-- obtenemos el parámetro ?path=
  if (!path) return res.status(400).json({ error: "Falta parámetro path" });

  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  // En vez de insertar directamente, lo agregamos a la cola
  queue.push({ path, ip });

  console.log(`[QUEUE] ${path} - ${ip} (cola: ${queue.length})`);
   res.send(`<h1>Aguante River! Estás en /${path}</h1>`);
});


// Obtener logs
app.get("/logs", async (req, res) => {
  try {
    const result = await db.execute("SELECT * FROM visits ORDER BY created_at DESC LIMIT 200");
    res.json(result.rows);
  } catch (error) {
    console.error("Error obteniendo logs:", error);
    res.status(500).json({ error: "Error obteniendo logs" });
  }
});

app.post("/clear-logs", async (req, res) => {
  try {
    await db.execute("DELETE FROM visits"); // Borra todos los registros
    console.log("🗑️ Todos los logs han sido eliminados");
    res.json({ success: true, message: "Todos los logs eliminados" });
  } catch (error) {
    console.error("Error eliminando logs:", error);
    res.status(500).json({ success: false, error: "Error eliminando logs" });
  }
});

app.listen(port, () => console.log(`🚀 Backend corriendo en puerto ${port}`));
