import express from "express";
import admin from "firebase-admin";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize Firebase Admin
  let serviceAccount;
  try {
    serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) 
      : undefined;
  } catch (e) {
    console.error("Critical error parsing FIREBASE_SERVICE_ACCOUNT. Please check if the variable is a valid JSON string.");
    serviceAccount = undefined;
  }

  let appInstance: admin.app.App | undefined;

  if (serviceAccount) {
    try {
      appInstance = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log("Firebase Admin successfully initialized.");
    } catch (e) {
      console.error("Failed to initialize Firebase Admin:", e);
    }
  } else {
    console.warn("FIREBASE_SERVICE_ACCOUNT not found or invalid. Webhook user creation will be disabled.");
  }

  const db = (serviceAccount && appInstance) ? admin.firestore(appInstance) : null;
  
  if (db && serviceAccount) {
    // Select specific database ID after init
    // Note: firebase-admin v11+ supports choosing DB this way if needed, 
    // but usually setting it in the app config works better for standard setups.
    // For this specific environment, we'll keep the appInstance logic.
  }

  app.use(express.json());

  // API Route: Webhook
  app.post("/api/webhook", async (req, res) => {
    const data = req.body;

    if (data.status === "APPROVED" && serviceAccount && db && appInstance) {
      const email = data.buyer?.email;
      if (!email) {
        return res.status(400).send("Email not found in payload");
      }

      try {
        // Generate random 8-character password
        const senha = Math.random().toString(36).slice(-8);

        try {
          // Attempt to create user in Firebase Auth
          await admin.auth(appInstance).createUser({
            email: email,
            password: senha
          });
          console.log("Usuário criado no Auth:", email, senha);
        } catch (authError: any) {
          if (authError.code === 'auth/email-already-exists') {
            console.log("Usuário já existe no Auth, pulando criação:", email);
          } else {
            throw authError;
          }
        }

        // Activate user in Firestore
        await db.collection("usuarios").doc(email).set({
          ativo: true,
          criado_em: new Date()
        });

        console.log("Usuário ativado no Firestore:", email);
        res.status(200).json({ status: "ok", message: "User processed successfully" });
      } catch (error) {
        console.error("Error in webhook processing:", error);
        res.status(500).json({ error: "Firebase error during processing" });
      }
    } else {
      res.send("ok");
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
