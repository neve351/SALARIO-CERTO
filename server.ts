import express from "express";
import admin from "firebase-admin";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import twilio from 'twilio';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Store for verification sessions
let sessions: Record<string, any> = {};

// Lazy Twilio initialization helper
let twilioClient: twilio.Twilio | null = null;
function getTwilio() {
  if (!twilioClient) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) {
      throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required');
    }
    twilioClient = twilio(sid, token);
  }
  return twilioClient;
}

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
  app.use(express.urlencoded({ extended: true }));

  // API Route: Send Verification Code
  app.post("/api/send-code", async (req, res) => {
    const { email, telefone } = req.body;

    const codigo = Math.floor(100000 + Math.random() * 900000);
    const sessionId = uuidv4();

    sessions[sessionId] = {
      email,
      telefone,
      codigo,
      criado: Date.now()
    };

    console.log("Código:", codigo); // teste

    // Integração com Twilio (opcional, mantendo o que já tínhamos)
    try {
      const client = getTwilio();
      const from = process.env.TWILIO_PHONE_NUMBER || '+123456';
      const phone = telefone.startsWith('+') ? telefone : `+55${telefone}`;
      
      await client.messages.create({
        body: `Salário Certo: Seu código de acesso é ${codigo}`,
        from: from,
        to: phone
      });
    } catch (e) {
      console.warn("Aviso Twilio:", e.message);
    }

    res.json({ 
      sessionId, 
      code: process.env.NODE_ENV !== 'production' ? codigo : undefined 
    });
  });

  // API Route: Verify Code
  app.post("/api/verify-code", async (req, res) => {
    const { codigo, sessionId } = req.body;
    
    const session = sessions[sessionId];

    if (!session || session.codigo.toString() !== codigo.toString()) {
      return res.json({ ok: false });
    }

    const email = session.email;

    try {
      if (appInstance && db) {
        // cria usuário no Firebase Auth
        try {
          await admin.auth(appInstance).createUser({
            email,
            password: "123456"
          });
        } catch (authErr: any) {
          // Se o usuário já existir, apenas ignoramos o erro de criação e prosseguimos
          if (authErr.code !== 'auth/email-already-exists') {
            console.error("Erro ao criar usuário Auth:", authErr);
          }
        }

        // salva trial no Firestore
        await db.collection("usuarios").doc(email).set({
          plano: "trial",
          trial_inicio: Date.now(),
          ativo: true,
          email: email,
          telefone: session.telefone
        }, { merge: true });

        console.log("Usuário criado e trial ativado para:", email);
      }
      
      delete sessions[sessionId];
      res.json({ ok: true });
    } catch (error: any) {
      console.error("Erro na verificação/ativação:", error);
      res.status(500).json({ ok: false, error: "Erro interno no servidor" });
    }
  });

  // API Route: Hotmart Webhook (Payment integration)
  app.post("/api/webhook/hotmart", async (req, res) => {
    const data = req.body;
    
    // Log completo para depuração
    console.log("Webhook Hotmart recebido:", JSON.stringify(data, null, 2));

    try {
      // Padrão Hotmart: event === "PURCHASE_APPROVED" ou status === "APPROVED"
      // Note: Recomenda-se validar o hottok (token de segurança) para produção
      const isApproved = data.event === "PURCHASE_APPROVED" || data.status === "APPROVED";
      
      if (isApproved && db) {
        const email = data.data?.buyer?.email || data.email;

        if (email) {
          await db.collection("usuarios").doc(email).set({
            plano: "pro",
            origem: "hotmart",
            atualizado: Date.now(),
            ativo: true
          }, { merge: true });
          
          console.log(`Usuário ${email} atualizado para PRO via Hotmart`);
        }
      }
      
      res.status(200).json({ ok: true });
    } catch (error: any) {
      console.error("Erro no webhook Hotmart:", error.message);
      res.status(200).json({ ok: false, error: error.message });
    }
  });

  // API Route: Cakto Webhook (Payment integration)
  app.post("/api/webhook/cakto", async (req, res) => {
    const data = req.body;
    
    // Log completo para depuração conforme solicitado
    console.log("Webhook Cakto recebido:", JSON.stringify(data, null, 2));

    try {
      // Ajusta conforme o padrão da Cakto
      if (data.status === "paid" && db) {
        const email = data.customer?.email;

        if (email) {
          await db.collection("usuarios").doc(email).set({
            plano: "pro",
            origem: "cakto",
            atualizado: Date.now(),
            ativo: true 
          }, { merge: true });
          
          console.log(`Usuário ${email} atualizado para PRO via Cakto`);
        }
      }
      
      res.status(200).json({ ok: true });
    } catch (error: any) {
      console.error("Erro no webhook Cakto:", error.message);
      res.status(200).json({ ok: false, error: error.message });
    }
  });

  // API Route: Send SMS Code (Twilio - Legacy for compatibility)
  app.post("/api/send-sms", async (req, res) => {
    const { phone, code } = req.body;
    
    if (!phone || !code) {
      return res.status(400).json({ error: "Telefone e código são obrigatórios" });
    }

    try {
      const client = getTwilio();
      const from = process.env.TWILIO_PHONE_NUMBER || '+123456';
      
      const message = await client.messages.create({
        body: `Salário Certo: Seu código de acesso é ${code}`,
        from: from,
        to: phone
      });

      console.log("SMS enviado com sucesso:", message.sid);
      res.json({ success: true, messageSid: message.sid });
    } catch (error: any) {
      console.error("Erro ao enviar SMS:", error.message);
      // Return 200 with success:false if it's a config issue so the UI can fallback to alert/console
      res.status(200).json({ 
        success: false, 
        error: "Twilio não configurado ou erro no envio",
        message: error.message 
      });
    }
  });

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
