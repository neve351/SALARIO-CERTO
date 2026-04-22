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

  // API Route: List Users (Admin only - simplified for now)
  app.get("/api/users", async (req, res) => {
    if (!serviceAccount || !db) {
      return res.status(500).json({ error: "Serviço de banco de dados não configurado" });
    }
    
    try {
      const dbInstance = admin.firestore(appInstance);
      const snapshot = await dbInstance.collection("usuarios").get();
      
      let users: any[] = [];
      snapshot.forEach(doc => {
        users.push(doc.data());
      });

      res.status(200).json(users);
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
      res.status(500).json({ error: "Erro ao buscar lista de usuários" });
    }
  });

  // API Route: Webhook
  app.post("/api/webhook", async (req, res) => {
    const data = req.body;

    if (data.status === "APPROVED" && serviceAccount && db && appInstance) {
        const email = data.buyer?.email;
        if (!email) {
          return res.status(400).send("Email não encontrado no payload");
        }

        try {
          // Attempt to create user in Firebase Auth with the requested default password
          try {
            await admin.auth(appInstance).createUser({
              email: email,
              password: "123456"
            });
            console.log("Usuário criado no Auth:", email);
          } catch (authError: any) {
            if (authError.code === 'auth/email-already-exists') {
              console.log("Usuário já existe no Auth, atualizando status no Firestore:", email);
            } else {
              throw authError;
            }
          }

          // Register/Update User in Firestore as requested
          await db.collection("usuarios").doc(email).set({
            ativo: true,
            plano: "pro",
            renovacao: Date.now(),
            atualizado_em: new Date()
          }, { merge: true });

          console.log("Usuário promovido a PRO no Firestore:", email);
          res.status(200).json({ status: "success", message: "Acesso PRO liberado" });
        } catch (error) {
          console.error("Erro no processamento do webhook:", error);
          res.status(500).json({ error: "Erro interno ao processar acesso" });
        }
      } else {
        res.status(200).send("Status não é APPROVED, nenhuma ação tomada.");
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
