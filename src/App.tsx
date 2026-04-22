import { motion, AnimatePresence } from "motion/react";
import { 
  CheckCircle2, ShieldCheck, Zap, Code, Terminal, LogIn, Lock, Mail, LayoutDashboard, 
  LogOut, Calculator, PieChart as PieChartIcon, TrendingUp, Sparkles, ArrowLeft,
  FileUp, Edit3, Save, Loader2, X
} from "lucide-react";
import { useState, useMemo, useEffect, useCallback, type ReactNode, type ChangeEvent } from "react";
import { BrowserRouter as Router, Routes, Route, useNavigate, Navigate, Link } from "react-router-dom";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, type User } from "firebase/auth";
import { doc, getDoc, setDoc, collection, addDoc, query, orderBy, onSnapshot, limit, serverTimestamp, type Timestamp } from "firebase/firestore";
import { auth, db } from "./lib/firebase";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid, AreaChart, Area } from "recharts";
import { GoogleGenAI, Type } from "@google/genai";

// --- Gemini Setup ---
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

interface HistoryItem {
  id?: string;
  grossSalary: number;
  netSalary: number;
  extra: number;
  night: number;
  date: any;
}

function FeatureCard({ icon, title, description }: { icon: ReactNode, title: string, description: string }) {
  return (
    <motion.div 
      whileHover={{ y: -8, scale: 1.02 }}
      className="p-6 sm:p-8 rounded-[32px] bg-slate-900/40 border border-white/5 hover:border-purple-500/30 transition-all duration-300 relative overflow-hidden group backdrop-blur-sm"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-purple-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="mb-4 sm:mb-5 relative z-10 p-2.5 sm:p-3 bg-white/5 rounded-2xl inline-block group-hover:bg-purple-500/10 transition-colors">
        {icon}
      </div>
      <h3 className="text-lg sm:text-xl font-bold text-white mb-2 sm:mb-3 relative z-10">{title}</h3>
      <p className="text-slate-400 leading-relaxed text-xs sm:text-sm relative z-10">{description}</p>
    </motion.div>
  );
}

function Step({ number, title, description }: { number: string, title: string, description: ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-sm">
        {number}
      </div>
      <div>
        <h4 className="text-white font-medium mb-1">{title}</h4>
        <div className="text-slate-400 text-sm leading-relaxed">{description}</div>
      </div>
    </div>
  );
}

// --- Calculation Logic ---

const calculateINSS = (gross: number) => {
  if (gross <= 1412) return gross * 0.075;
  if (gross <= 2666.68) return (1412 * 0.075) + (gross - 1412) * 0.09;
  if (gross <= 4000.03) return 105.9 + 112.92 + (gross - 2666.68) * 0.12;
  if (gross <= 7786.02) return 105.9 + 112.92 + 160 + (gross - 4000.03) * 0.14;
  return 908.85; 
};

const calculateIRPF = (base: number) => {
  if (base <= 2259.20) return 0;
  if (base <= 2826.65) return base * 0.075 - 169.44;
  if (base <= 3751.05) return base * 0.15 - 381.44;
  if (base <= 4664.68) return base * 0.225 - 662.77;
  return base * 0.275 - 896;
};

// --- Pages ---

function LoginPage() {
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [password, setPassword] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSendCode = async (e?: any) => {
    if (e) e.preventDefault();
    if (!email) {
      setError("Por favor, preencha seu e-mail.");
      return;
    }
    
    setLoading(true);
    setError("");
    
    try {
      const res = await fetch("/api/send-code", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ email })
      });

      if (!res.ok) {
        throw new Error(`Erro no servidor: ${res.status}`);
      }

      const data = await res.json();
      
      if (data.sessionId) {
        setSessionId(data.sessionId);
        
        // Alerta inteligente: Se o email falhou ou não existe SMTP, mostramos o código no alerta para não travar
        if (data.code) {
          if (!data.emailSent) {
            alert("🛠️ Modo Desenvolvedor: Como o E-mail não foi configurado nos Segredos, use este código para entrar: " + data.code);
          } else {
            alert("Código enviado para o seu e-mail!");
          }
        } else {
          alert("Código enviado! Verifique sua caixa de entrada.");
        }

        setIsCodeSent(true);
      } else {
        throw new Error(data.error || "Erro ao gerar sessão");
      }
    } catch (err: any) {
      console.error("Erro no envio:", err);
      setError(`Erro: ${err.message || "Tente novamente"}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e?: any) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError("");
    
    try {
      const res = await fetch("/api/verify-code", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ codigo: password, sessionId })
      });

      const data = await res.json();

      if (data.ok) {
        alert("Acesso liberado!");
        // Autenticação técnica interna
        await signInWithEmailAndPassword(auth, email, "123456");
        navigate("/app");
      } else {
        alert("Código inválido");
        setError("Código inválido");
      }
    } catch (err) {
      console.error(err);
      setError("Erro ao validar código.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-sans text-white">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[20%] left-[10%] w-[30%] h-[30%] bg-purple-600/10 blur-[100px] rounded-full" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
          <div className="bg-white text-slate-950 p-6 sm:p-8 rounded-[32px] shadow-2xl relative overflow-hidden">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-purple-700 rounded-2xl flex items-center justify-center text-white mx-auto shadow-xl shadow-purple-900/20 mb-4 relative">
                <Zap className="w-8 h-8 fill-current" />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">
                {isCodeSent ? "Verificar Código" : "Ativar Teste Grátis"}
              </h1>
              <p className="text-slate-500 text-sm">
                {isCodeSent ? `Digite o código enviado para seu E-mail` : "Acesso imediato por 7 dias"}
              </p>
            </div>

          {!isCodeSent ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Seu E-mail</label>
                <input 
                  id="email" 
                  type="email" 
                  placeholder="Seu email principal" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:outline-none focus:border-purple-600 transition-colors"
                  required
                />
              </div>

              <button 
                onClick={handleSendCode}
                disabled={loading}
                className="bg-purple-700 w-full p-4 rounded-2xl font-black text-white hover:bg-purple-600 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-purple-900/20 disabled:opacity-50"
              >
                {loading ? "Processando..." : "Receber código"}
              </button>

              <p className="text-center text-slate-400 text-[10px] sm:text-xs italic">
                O código de ativação será enviado via E-mail.
              </p>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1 text-center block">Código de Ativação</label>
                <input 
                  id="codigo"
                  type="text" 
                  placeholder="Digite o código" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-4 text-slate-900 mt-2 bg-slate-100 border border-slate-200 rounded-2xl focus:outline-none font-black text-center tracking-widest text-2xl"
                  required
                />
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="bg-green-500 w-full p-4 mt-2 rounded-2xl font-black text-white hover:bg-green-400 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-green-500/20 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Ativar acesso"}
              </button>

              <button 
                type="button"
                onClick={() => setIsCodeSent(false)}
                className="w-full text-slate-400 text-[10px] font-bold uppercase tracking-widest hover:text-slate-600 transition-colors"
              >
                ← Voltar para E-mail
              </button>
            </form>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 rounded-xl border border-red-100">
              <p className="text-red-500 text-xs text-center font-bold uppercase tracking-widest">
                {error}
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// --- Internal Shared Layout ---

function InternalLayout({ children, activeTab }: { children: ReactNode, activeTab: string }) {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [checkingAcesso, setCheckingAcesso] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        
        // Verificar Acesso no Firestore
        try {
          if (user.email) {
            const userRef = doc(db, "usuarios", user.email);
            const userSnap = await getDoc(userRef);
            
            if (!userSnap.exists() || !userSnap.data().ativo) {
              await signOut(auth);
              navigate("/login");
            } else {
              setCheckingAcesso(false);
            }
          } else {
            await signOut(auth);
            navigate("/login");
          }
        } catch (error) {
          console.error("Erro ao verificar acesso:", error);
          setCheckingAcesso(false);
        }
      } else {
        setCurrentUser(null);
        setCheckingAcesso(false);
        // Só navega para login se não for a página inicial
        if (window.location.pathname !== "/" && window.location.pathname !== "/login") {
          navigate("/login");
        }
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  if (checkingAcesso) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 font-bold text-sm animate-pulse uppercase tracking-widest">Verificando Acesso...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans selection:bg-purple-200">
      {/* Mobile Top Bar */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-30">
        <div 
          onClick={() => navigate("/")}
          className="flex items-center gap-2 font-bold text-slate-900 cursor-pointer"
        >
          <motion.div 
            initial={{ rotate: -10 }} 
            animate={{ rotate: 0 }}
            className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-purple-500/20"
          >
            <Zap className="w-5 h-5 fill-current" />
          </motion.div>
          Salário Certo
        </div>
        
        {currentUser ? (
          <button 
            onClick={handleLogout}
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
          >
            <LogOut className="w-5 h-5" />
          </button>
        ) : (
          <button 
            onClick={() => navigate("/login")}
            className="text-xs font-bold text-purple-600 px-4 py-2 hover:bg-purple-50 rounded-full transition-all"
          >
            Acessar Conta
          </button>
        )}
      </header>

      <main className="max-w-md mx-auto relative">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-lg border-t border-slate-200 px-6 py-3 pb-8 md:pb-3 flex justify-around items-center">
        <button 
          onClick={() => navigate("/dashboard")}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'dashboard' ? 'text-purple-600' : 'text-slate-400'}`}
        >
          <LayoutDashboard className={`w-6 h-6 ${activeTab === 'dashboard' ? 'fill-purple-600/10' : ''}`} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Início</span>
        </button>
        <button 
          onClick={() => navigate("/calculator")}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'calculator' ? 'text-purple-600' : 'text-slate-400'}`}
        >
          <Calculator className={`w-6 h-6 ${activeTab === 'calculator' ? 'fill-purple-600/10' : ''}`} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Simular</span>
        </button>
        <button 
          onClick={() => navigate("/evolucao")}
          className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'evolucao' ? 'text-purple-600' : 'text-slate-400'}`}
        >
          <TrendingUp className={`w-6 h-6 ${activeTab === 'evolucao' ? 'fill-purple-600/10' : ''}`} />
          <span className="text-[10px] font-bold uppercase tracking-wider">Evolução</span>
        </button>
      </nav>
    </div>
  );
}

// --- Pages ---

function SalaryCalculatorPage({ 
  grossSalary, setGrossSalary, 
  he70Hours, setHe70Hours, 
  he100Hours, setHe100Hours, 
  nightHours, setNightHours, 
  vtCost, setVtCost, 
  vaCost, setVaCost, 
  vrCost, setVrCost, 
  monthsWorked, setMonthsWorked,
  results,
  isSimpleMode, setIsSimpleMode,
  simpleExtra, setSimpleExtra,
  simpleNight, setSimpleNight
}: any) {
  const [aiTip, setAiTip] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const navigate = useNavigate();

  const getAiTip = async () => {
    setIsGenerating(true);
    try {
      const response = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analise este demonstrativo: Vencimentos R$ ${results.totalEarnings.toFixed(2)}, Líquido R$ ${results.netSalary.toFixed(2)}. 
        Dê uma dica financeira curta e profissional sobre FGTS ou planejamento de rescisão.`,
      });
      setAiTip(response.text || "Mantenha o foco em seus objetivos financeiros.");
    } catch (err) {
      setAiTip("Reserve o FGTS para emergências ou investimentos imobiliários.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <InternalLayout activeTab="calculator">
      <div className="p-4 sm:p-6 pb-20 space-y-6 sm:space-y-8">
        <motion.div 
          initial={{ opacity: 0, y: 10 }} 
          animate={{ opacity: 1, y: 0 }}
          className="px-2"
        >
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Simulador PRO</h2>
          <p className="text-slate-500 text-xs sm:text-sm italic">Cálculos automáticos baseados na CLT 2026.</p>
        </motion.div>

        <div className="flex bg-slate-200/50 p-1 rounded-2xl border border-slate-200 mb-6 sm:mb-8 mx-2 sm:mx-0">
          <button 
            onClick={() => setIsSimpleMode(false)}
            className={`flex-1 py-3 sm:py-4 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${!isSimpleMode ? 'bg-white text-purple-600 shadow-lg' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <ShieldCheck className="w-4 h-4" /> CLT Completo
          </button>
          <button 
            onClick={() => setIsSimpleMode(true)}
            className={`flex-1 py-3 sm:py-4 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${isSimpleMode ? 'bg-white text-purple-600 shadow-lg' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Zap className="w-4 h-4" /> Calculadora Rápida
          </button>
        </div>

        {/* Resultado Principal Card */}
        <div className="bg-slate-950 text-white p-6 sm:p-8 rounded-[32px] sm:rounded-[40px] shadow-2xl relative overflow-hidden group border border-white/5 mx-2 sm:mx-0">
          <div className="absolute top-0 right-0 p-4 sm:p-6 opacity-10">
            <Zap className="w-16 h-16 sm:w-20 sm:h-20 text-purple-400 fill-current" />
          </div>
          <p className="text-slate-400 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest mb-1">Líquido a Receber</p>
          <h3 className="text-3xl sm:text-4xl font-black mb-4 sm:mb-6 text-transparent bg-clip-text bg-gradient-to-r from-white to-purple-200">
            R$ {results.netSalary.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h3>
          
          <div className="grid grid-cols-2 gap-3 sm:gap-4 pt-5 sm:pt-6 border-t border-white/10">
            <div>
              <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase block">Proventos</span>
              <span className="text-xs sm:text-sm font-bold text-emerald-400">+ R$ {results.totalEarnings.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="text-right">
              <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase block">Descontos</span>
              <span className="text-xs sm:text-sm font-bold text-red-400">- R$ {(results.totalEarnings - results.netSalary).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {/* Seção de Entradas */}
        <section className="space-y-4 sm:space-y-6 px-2 sm:px-0">
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
            <div>
              <label className="block text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase mb-2 sm:mb-3 tracking-widest">Salário Base (Bruto)</label>
              <div className="flex items-baseline gap-1 mb-3 sm:mb-4">
                <span className="text-base sm:text-lg font-bold text-slate-400">R$</span>
                <input 
                  type="number" 
                  step="0.01"
                  value={grossSalary}
                  onChange={(e) => setGrossSalary(Number(e.target.value))}
                  className="w-full text-2xl sm:text-3xl font-black text-slate-900 focus:outline-none bg-transparent"
                />
              </div>
              <input 
                type="range" 
                min="1412" 
                max="20000" 
                step="0.01" 
                value={grossSalary}
                onChange={(e) => setGrossSalary(Number(e.target.value))}
                className="w-full h-1.5 sm:h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
            </div>

            {isSimpleMode ? (
              <div className="space-y-4 pt-4 border-t border-slate-50">
                <div className="space-y-1.5">
                  <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono italic">💰 Horas Extra 70% (EM REAIS)</label>
                  <input 
                    type="number" 
                    value={simpleExtra}
                    onChange={(e) => setSimpleExtra(Number(e.target.value))}
                    className="w-full p-2.5 sm:p-3 bg-purple-50 rounded-xl border border-purple-100 font-bold focus:border-purple-300 outline-none text-sm sm:text-base text-purple-900"
                    placeholder="R$ 0,00"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono italic">🌙 Adicional Noturno (EM REAIS)</label>
                  <input 
                    type="number" 
                    value={simpleNight}
                    onChange={(e) => setSimpleNight(Number(e.target.value))}
                    className="w-full p-2.5 sm:p-3 bg-purple-50 rounded-xl border border-purple-100 font-bold focus:border-purple-300 outline-none text-sm sm:text-base text-purple-900"
                    placeholder="R$ 0,00"
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 sm:gap-4 pt-4 border-t border-slate-50">
                  <div className="space-y-1.5">
                    <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Extras 70%</label>
                    <input 
                      type="number" 
                      value={he70Hours}
                      onChange={(e) => setHe70Hours(Number(e.target.value))}
                      className="w-full p-2.5 sm:p-3 bg-slate-50 rounded-xl border border-slate-100 font-bold focus:border-purple-300 outline-none text-sm sm:text-base"
                      placeholder="Hrs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Extras 100%</label>
                    <input 
                      type="number" 
                      value={he100Hours}
                      onChange={(e) => setHe100Hours(Number(e.target.value))}
                      className="w-full p-2.5 sm:p-3 bg-slate-50 rounded-xl border border-slate-100 font-bold focus:border-purple-300 outline-none text-sm sm:text-base"
                      placeholder="Hrs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Adicional Noturno (Hrs)</label>
                    <input 
                      type="number" 
                      value={nightHours}
                      onChange={(e) => setNightHours(Number(e.target.value))}
                      className="w-full p-2.5 sm:p-3 bg-slate-50 rounded-xl border border-slate-100 font-bold focus:border-purple-300 outline-none text-sm sm:text-base"
                    />
                </div>
              </>
            )}
          </div>

          {/* Descontos de Benefícios (Smart Mode) */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <h4 className="text-xs font-black text-slate-900 border-b pb-2 mb-4">DESCONTOS DE BENEFÍCIOS (SMART)</h4>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase">Custo VT Mensal (Empresa)</label>
                <input 
                  type="number" 
                  value={vtCost}
                  onChange={(e) => setVtCost(Number(e.target.value))}
                  className="w-full p-2 bg-slate-50 rounded-lg text-xs font-bold border border-slate-100"
                  placeholder="Ex: 400"
                />
                <p className="text-[8px] text-purple-600 font-bold italic">Auto-desc: R$ {results.vtCalcDiscount.toLocaleString("pt-BR")} (Limite 6%)</p>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase">Vale Alim./Ref. (Dedução)</label>
                <input 
                  type="number" 
                  value={vaCost}
                  onChange={(e) => setVaCost(Number(e.target.value))}
                  className="w-full p-2 bg-slate-50 rounded-lg text-xs font-bold border border-slate-100"
                  placeholder="Ex: 250,44"
                />
                <p className="text-[8px] text-slate-400 italic">Valor total descontado em folha.</p>
              </div>
            </div>
          </div>

          {/* FGTS Automático */}
          <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-6 relative overflow-hidden group">
            <TrendingUp className="absolute top-2 right-2 w-10 h-10 text-emerald-200 opacity-50" />
            <p className="text-emerald-700 text-[10px] font-black uppercase tracking-widest mb-4">Projeção FGTS Acumulado</p>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-1">
                <span className="text-[9px] text-emerald-600 block">Meses Trabalhados</span>
                <input 
                  type="number"
                  value={monthsWorked}
                  onChange={(e) => setMonthsWorked(Number(e.target.value))}
                  className="w-full bg-transparent text-xl font-black text-emerald-900 focus:outline-none"
                />
              </div>
              <div className="text-right">
                <span className="text-[9px] text-emerald-600 block">Total Est.</span>
                <span className="text-xl font-black text-emerald-900">R$ {results.accruedFGTS.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
            <div className="bg-emerald-900/5 p-3 rounded-xl flex justify-between items-center">
              <span className="text-[10px] font-bold text-emerald-800">Depósito Mensal</span>
              <span className="text-sm font-bold text-emerald-600 tracking-tight">R$ {results.monthlyFGTS.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* Projeção de Rescisão */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <LogOut className="w-4 h-4 text-slate-400" />
              <h4 className="text-xs font-black text-slate-900">PROJEÇÃO DE ACERTO (SAÍDA)</h4>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Aviso Prévio Est.</span>
                <span className="font-mono font-bold text-slate-900 uppercase tracking-tighter">R$ {results.avisoPrevio.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">13º Salário Prop.</span>
                <span className="font-mono font-bold text-slate-900 uppercase tracking-tighter">R$ {results.decimoTerceiroProp.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Férias Prop. + 1/3</span>
                <span className="font-mono font-bold text-slate-900 uppercase tracking-tighter">R$ {results.feriasProp.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="pt-3 border-t border-slate-50 flex justify-between items-center">
                <span className="text-sm font-black text-slate-900">Total Previsto</span>
                <span className="text-lg font-black text-purple-600 transition-all">
                  R$ {(results.avisoPrevio + results.decimoTerceiroProp + results.feriasProp).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </section>

        <button 
          onClick={getAiTip}
          disabled={isGenerating}
          className="w-full py-5 bg-white border-2 border-slate-200 text-slate-900 rounded-[24px] font-bold flex items-center justify-center gap-3 hover:bg-slate-50 transition-all hover:border-purple-200 group disabled:opacity-50"
        >
          {isGenerating ? "Processando planejamento..." : (
            <>
              <Sparkles className="w-5 h-5 text-purple-600 fill-purple-100 group-hover:scale-110 transition-transform" />
              Planejar meu Financeiro
            </>
          )}
        </button>

        <AnimatePresence>
          {aiTip && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-6 bg-purple-50 border border-purple-100 rounded-3xl"
            >
              <div className="flex gap-4">
                <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center flex-shrink-0">
                  <PieChartIcon className="w-5 h-5 text-purple-600" />
                </div>
                <p className="text-purple-900 text-sm leading-relaxed font-medium">
                  "{aiTip}"
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </InternalLayout>
  );
}

function evolucaoChartData() {
  return [
    { month: 'Set', value: 1034 },
    { month: 'Out', value: 1034 },
    { month: 'Nov', value: 1150 },
    { month: 'Dez', value: 1600 }, // 13o
    { month: 'Jan', value: 1200 },
    { month: 'Fev', value: 1250 },
  ];
}

function EvolucaoPage({ results, user }: { results: any, user: User | null }) {
  const navigate = useNavigate();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, `users/${user.uid}/history`),
      orderBy("date", "asc"),
      limit(10)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as HistoryItem[];
      setHistory(items);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  const chartData = useMemo(() => {
    if (history.length === 0) return [];
    return history.map(item => ({
      date: item.date?.toDate().toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' }) || '...',
      valor: item.netSalary
    }));
  }, [history]);

  const stats = useMemo(() => {
    if (history.length === 0) return { avg: 0, record: 0 };
    const values = history.map(h => h.netSalary);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const record = Math.max(...values);
    return { avg, record };
  }, [history]);

  return (
    <InternalLayout activeTab="evolucao">
      <div className="p-4 sm:p-6 space-y-6 sm:space-y-8 pb-20">
        <motion.div 
          initial={{ opacity: 0, y: 10 }} 
          animate={{ opacity: 1, y: 0 }}
          className="px-2"
        >
          <div className="flex justify-between items-end">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Evolução Salarial</h2>
              <p className="text-slate-500 text-xs sm:text-sm">Seu progresso real baseado em cálculos salvos.</p>
            </div>
            <div className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-100 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> CLT Ativo
            </div>
          </div>
        </motion.div>

        <div className="bg-white p-5 sm:p-8 rounded-[36px] shadow-xl shadow-slate-200/50 border border-slate-100 mx-2 sm:mx-0 overflow-hidden relative">
           <div className="h-56 sm:h-72 w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 'bold' }}
                />
                <YAxis 
                  hide={true}
                  domain={['dataMin - 100', 'dataMax + 100']}
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                  formatter={(value: number) => `R$ ${value.toLocaleString("pt-BR")}`}
                />
                <Area 
                  type="monotone" 
                  dataKey="valor" 
                  stroke="#6366f1" 
                  strokeWidth={4} 
                  fillOpacity={1} 
                  fill="url(#colorVal)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          
          <div className="flex justify-between items-center mt-6 sm:mt-8 px-2">
            <div className="text-center flex-1">
              <span className="text-[9px] sm:text-[10px] font-sans font-bold text-slate-400 block uppercase tracking-widest mb-1">Ganho Médio</span>
              <span className="font-black text-slate-900 text-sm sm:text-lg">R$ {stats.avg.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="w-px h-8 bg-slate-100 mx-2 sm:mx-4" />
            <div className="text-center flex-1">
              <span className="text-[9px] sm:text-[10px] font-sans font-bold text-slate-400 block uppercase tracking-widest mb-1">Maior Recebido</span>
              <span className="font-black text-indigo-600 text-sm sm:text-lg">R$ {stats.record.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        <section className="space-y-4 px-2 sm:px-0">
          <div className="flex justify-between items-center px-2">
            <h3 className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-widest">Registros de Holerite</h3>
            <span className="text-[10px] font-black text-indigo-500">{history.length} salvos</span>
          </div>
          
          <div className="space-y-3">
            {history.slice().reverse().map((item, idx) => (
              <motion.div 
                key={item.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-white p-4 rounded-3xl border border-slate-100 flex justify-between items-center group hover:bg-slate-50 hover:border-indigo-200 transition-all cursor-default"
              >
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 bg-slate-50 group-hover:bg-indigo-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-all duration-300">
                    <Calculator className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-black text-slate-800 text-sm">{item.date?.toDate().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) || 'Calculado'}</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Bruto: R$ {item.grossSalary.toLocaleString('pt-BR')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-black text-indigo-600 text-sm sm:text-base">R$ {item.netSalary.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                  <p className="text-[9px] font-bold text-slate-300 uppercase">Líquido</p>
                </div>
              </motion.div>
            ))}

            {history.length === 0 && !loading && (
              <div className="py-20 text-center opacity-40">
                <PieChartIcon className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p className="text-xs font-black uppercase tracking-widest text-slate-500">Comece a salvar seus cálculos para ver aqui.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </InternalLayout>
  );
}

function DashboardPage({ 
  results, 
  grossSalary, setGrossSalary,
  he70Hours, setHe70Hours,
  he100Hours, setHe100Hours,
  nightHours, setNightHours,
  vtCost, setVtCost,
  vaCost, setVaCost,
  vrCost, setVrCost,
  nightTotal, he70Total, he100Total 
}: any) {
  const [user, setUser] = useState<User | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        navigate("/login");
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const [isSaving, setIsSaving] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, `users/${user.uid}/history`),
      orderBy("date", "desc"),
      limit(5)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as HistoryItem[];
      setHistory(items);
    });
    return () => unsubscribe();
  }, [user]);

  const saveHistory = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await addDoc(collection(db, `users/${user.uid}/history`), {
        grossSalary,
        netSalary: results.netSalary,
        extra: he70Total + he100Total,
        night: nightTotal,
        date: serverTimestamp()
      });
      // Also update overall stats (simplified for now)
      await setDoc(doc(db, "users", user.uid), {
        email: user.email,
        lastUpdated: serverTimestamp(),
        currentSalary: results.netSalary
      }, { merge: true });
    } catch (error) {
      console.error("Erro ao salvar:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => {
          const base = reader.result as string;
          resolve(base.split(',')[1]);
        };
      });
      reader.readAsDataURL(file);
      const base64Data = await base64Promise;

      const response = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              { text: "Analise este holerite (pay stub) e extraia os seguintes valores em JSON. Use apenas números. Se não encontrar, use 0. Campos: grossSalary (Salário Base/Bruto), he70Hours (quantidade de horas extras 70%), he100Hours (quantidade de horas extras 100%), nightHours (quantidade de horas adicional noturno), vtCost (valor Vale Transporte), vaCost (valor Vale Alimentação), vrCost (valor Vale Refeição)." },
              { inlineData: { data: base64Data, mimeType: file.type } }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              grossSalary: { type: Type.NUMBER },
              he70Hours: { type: Type.NUMBER },
              he100Hours: { type: Type.NUMBER },
              nightHours: { type: Type.NUMBER },
              vtCost: { type: Type.NUMBER },
              vaCost: { type: Type.NUMBER },
              vrCost: { type: Type.NUMBER },
            }
          }
        }
      });

      const data = JSON.parse(response.text);
      if (data.grossSalary) setGrossSalary(data.grossSalary);
      if (data.he70Hours !== undefined) setHe70Hours(data.he70Hours);
      if (data.he100Hours !== undefined) setHe100Hours(data.he100Hours);
      if (data.nightHours !== undefined) setNightHours(data.nightHours);
      if (data.vtCost !== undefined) setVtCost(data.vtCost);
      if (data.vaCost !== undefined) setVaCost(data.vaCost);
      if (data.vrCost !== undefined) setVrCost(data.vrCost);
      
      alert("Dados extraídos com sucesso do seu holerite!");
    } catch (error) {
      console.error("Erro no upload:", error);
      alert("Não conseguimos ler este arquivo. Verifique se é um holerite válido.");
    } finally {
      setIsUploading(false);
    }
  };

  if (!user) return null;

  const salario_liquido = results.netSalary;

  const dashboardChartData = [
    { name: "Salário Base", value: grossSalary, color: "#6366f1" },
    { name: "Horas Extras", value: he70Total + he100Total, color: "#8b5cf6" },
    { name: "Adc. Noturno", value: nightTotal, color: "#ec4899" },
  ];

  return (
    <InternalLayout activeTab="dashboard">
      <div className="pb-20">
        {/* Header with Gradient */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' }}
          className="m-4 sm:m-6 mt-4 p-6 sm:p-8 rounded-[36px] sm:rounded-[42px] shadow-2xl shadow-purple-600/30 relative overflow-hidden group"
        >
          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div className="flex gap-3 items-center">
                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-white/20 backdrop-blur-lg rounded-2xl flex items-center justify-center text-white border border-white/20">
                  <Sparkles className="w-5 h-5 fill-current" />
                </div>
                <div className="text-left">
                  <p className="text-white/70 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest">Acesso PRO</p>
                  <p className="text-white text-xs sm:text-sm font-bold truncate max-w-[140px]">{user.email?.split('@')[0]}</p>
                </div>
              </div>

              <div className="flex gap-2 w-full sm:w-auto">
                <label className="flex-1 sm:flex-none cursor-pointer">
                  <input type="file" accept=".pdf,image/*" onChange={handleFileUpload} className="hidden" />
                  <div className="bg-white/10 hover:bg-white/20 backdrop-blur-md px-3 py-2 rounded-xl text-white text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 border border-white/10 transition-all">
                    {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileUp className="w-3.5 h-3.5" />}
                    Importar Holerite
                  </div>
                </label>
                <button 
                  onClick={() => {
                    if (isEditing) {
                      saveHistory();
                      setIsEditing(false);
                    } else {
                      setIsEditing(true);
                    }
                  }}
                  className={`flex-1 sm:flex-none px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 border transition-all ${
                    isEditing 
                    ? 'bg-emerald-500 border-emerald-400 text-white' 
                    : 'bg-white/10 border-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {isEditing ? (isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />) : <Edit3 className="w-3.5 h-3.5" />}
                  {isEditing ? (isSaving ? 'Salvando...' : 'Salvar') : 'Editar'}
                </button>
              </div>
            </div>

            <p className="text-white/80 text-xs sm:text-sm font-medium mb-1">Seu Salário Líquido Mensal</p>
            <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-none mb-3 sm:mb-4">
              R$ {salario_liquido.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h1>
            <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-400/20 border border-emerald-400/20 rounded-full text-emerald-200 text-[9px] font-bold uppercase tracking-wider">
              <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {isEditing ? 'Calculando Tempo Real' : 'Monitoramento CLT'}
            </div>
          </div>
          <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        </motion.div>

        <main className="px-4 sm:px-6 space-y-6 sm:space-y-8">
          <section>
            <div className="flex justify-between items-center mb-3 sm:mb-4 px-1">
              <h3 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-2">
                <PieChartIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600" />
                Distribuição de Ganhos
              </h3>
            </div>
            <div className="bg-white p-6 sm:p-8 rounded-[36px] shadow-sm border border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-8 items-center">
              <div className="h-48 sm:h-56 w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dashboardChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={75}
                      paddingAngle={8}
                      dataKey="value"
                      stroke="none"
                    >
                      {dashboardChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        borderRadius: '16px', 
                        border: 'none', 
                        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }} 
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] uppercase font-black text-slate-400 tracking-tighter">Bruto</span>
                  <span className="text-sm font-black text-slate-900">R$ {results.totalEarnings.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</span>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {dashboardChartData.map(item => (
                  <div key={item.name} className="flex items-center gap-4 bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.name}</p>
                      <p className="text-sm sm:text-base font-black text-slate-800">R$ {item.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black text-slate-400">{((item.value / results.totalEarnings) * 100).toFixed(0)}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section>
            <div className="flex justify-between items-center mb-4 px-1">
              <h3 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                Histórico Recente
              </h3>
            </div>
            <div className="space-y-3">
              {history.length > 0 ? history.map((item) => (
                <div key={item.id} className="bg-white p-4 rounded-3xl border border-slate-100 flex justify-between items-center group hover:bg-slate-50 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500 group-hover:scale-110 transition-transform">
                      <Calculator className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Cálculo em {item.date?.toDate().toLocaleDateString('pt-BR') || 'Hoje'}</p>
                      <p className="text-sm font-black text-slate-800">R$ {item.netSalary.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] font-black py-1 px-2 bg-emerald-50 text-emerald-600 rounded-full inline-block uppercase">Processado</div>
                  </div>
                </div>
              )) : (
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 p-8 rounded-[36px] text-center">
                  <PieChartIcon className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-relaxed">Nenhum cálculo salvo ainda.<br/>Salve seus dados para ver a evolução.</p>
                </div>
              )}
            </div>
          </section>

          <section className="space-y-3 sm:space-y-4">
            <div className="flex justify-between items-center px-1">
              <h3 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-2">
                {isEditing && <div className="w-2 h-2 rounded-full bg-purple-500 animate-ping" />}
                Valores Base {isEditing ? '(Modo Edição)' : ''}
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <motion.div 
                whileHover={{ y: isEditing ? 0 : -4 }}
                className={`p-5 sm:p-6 rounded-[28px] sm:rounded-[32px] border shadow-sm flex flex-col gap-0.5 sm:gap-1 text-center border-b-4 transition-all ${
                  isEditing ? 'bg-purple-50 border-purple-200 border-b-purple-600' : 'bg-white border-slate-100 border-b-purple-500'
                }`}
              >
                <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Salário Base</span>
                {isEditing ? (
                  <input 
                    type="number" 
                    value={grossSalary} 
                    onChange={(e) => setGrossSalary(Number(e.target.value))}
                    className="w-full bg-transparent font-bold text-slate-900 text-base sm:text-lg text-center outline-none focus:ring-0"
                    autoFocus
                  />
                ) : (
                  <span className="font-bold text-slate-900 text-base sm:text-lg">R$ {grossSalary.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                )}
              </motion.div>
              <motion.div 
                whileHover={{ y: isEditing ? 0 : -4 }}
                className={`p-5 sm:p-6 rounded-[28px] sm:rounded-[32px] border shadow-sm flex flex-col gap-0.5 sm:gap-1 text-center border-b-4 transition-all ${
                  isEditing ? 'bg-blue-50 border-blue-200 border-b-blue-600' : 'bg-white border-slate-100 border-b-blue-400'
                }`}
              >
                <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Horas Noturnas</span>
                {isEditing ? (
                  <input 
                    type="number" 
                    value={nightHours} 
                    onChange={(e) => setNightHours(Number(e.target.value))}
                    className="w-full bg-transparent font-bold text-slate-900 text-base sm:text-lg text-center outline-none focus:ring-0"
                  />
                ) : (
                  <span className="font-bold text-slate-900 text-base sm:text-lg">{nightHours}h (R$ {nightTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })})</span>
                )}
              </motion.div>
              <motion.div 
                whileHover={{ y: isEditing ? 0 : -4 }}
                className={`p-5 sm:p-6 rounded-[28px] sm:rounded-[32px] border shadow-sm flex flex-col gap-0.5 sm:gap-1 text-center border-b-4 transition-all ${
                  isEditing ? 'bg-indigo-50 border-indigo-200 border-b-indigo-600' : 'bg-white border-slate-100 border-b-indigo-400'
                }`}
              >
                <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest">H.E. 70%</span>
                {isEditing ? (
                  <input 
                    type="number" 
                    value={he70Hours} 
                    onChange={(e) => setHe70Hours(Number(e.target.value))}
                    className="w-full bg-transparent font-bold text-slate-900 text-base sm:text-lg text-center outline-none focus:ring-0"
                  />
                ) : (
                  <span className="font-bold text-slate-900 text-base sm:text-lg">{he70Hours}h (R$ {he70Total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })})</span>
                )}
              </motion.div>
              <motion.div 
                whileHover={{ y: isEditing ? 0 : -4 }}
                className={`p-5 sm:p-6 rounded-[28px] sm:rounded-[32px] border shadow-sm flex flex-col gap-0.5 sm:gap-1 text-center border-b-4 transition-all ${
                  isEditing ? 'bg-pink-50 border-pink-200 border-b-pink-600' : 'bg-white border-slate-100 border-b-pink-400'
                }`}
              >
                <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest">H.E. 100%</span>
                {isEditing ? (
                  <input 
                    type="number" 
                    value={he100Hours} 
                    onChange={(e) => setHe100Hours(Number(e.target.value))}
                    className="w-full bg-transparent font-bold text-slate-900 text-base sm:text-lg text-center outline-none focus:ring-0"
                  />
                ) : (
                  <span className="font-bold text-slate-900 text-base sm:text-lg">{he100Hours}h (R$ {he100Total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })})</span>
                )}
              </motion.div>
            </div>

            {isEditing && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="grid grid-cols-3 gap-3 overflow-hidden p-1"
              >
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                   <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Vale Transp.</span>
                   <input type="number" value={vtCost} onChange={(e) => setVtCost(Number(e.target.value))} className="w-full bg-transparent font-bold text-slate-900 text-xs sm:text-sm outline-none" />
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                   <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Vale Alim.</span>
                   <input type="number" value={vaCost} onChange={(e) => setVaCost(Number(e.target.value))} className="w-full bg-transparent font-bold text-slate-900 text-xs sm:text-sm outline-none" />
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                   <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Vale Ref.</span>
                   <input type="number" value={vrCost} onChange={(e) => setVrCost(Number(e.target.value))} className="w-full bg-transparent font-bold text-slate-900 text-xs sm:text-sm outline-none" />
                </div>
              </motion.div>
            )}

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="bg-indigo-50 p-5 sm:p-6 rounded-3xl border border-indigo-100 flex justify-between items-center group">
                <div>
                  <p className="text-indigo-400 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest mb-0.5 sm:mb-1">Proventos</p>
                  <strong className="text-lg sm:text-xl text-indigo-600">R$ {results.totalEarnings.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                </div>
              </div>
              <div className="bg-red-50 p-5 sm:p-6 rounded-3xl border border-red-100 flex justify-between items-center group">
                <div>
                  <p className="text-red-400 text-[9px] sm:text-[10px] font-bold uppercase tracking-widest mb-0.5 sm:mb-1">Descontos</p>
                  <strong className="text-lg sm:text-xl text-red-600">- R$ {(results.totalEarnings - results.netSalary).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                </div>
              </div>
            </div>
          </section>

          <div className="bg-slate-900 p-5 sm:p-6 rounded-[28px] sm:rounded-[32px] text-white flex gap-4 sm:gap-5 items-center relative overflow-hidden ring-1 ring-white/5 shadow-2xl">
            <div className="relative z-10 flex-1 text-center sm:text-left">
              <p className="text-blue-400 text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.2em] mb-1.5 sm:mb-2 italic">Planejamento PRO</p>
              <h4 className="text-xs sm:text-sm font-bold mb-2 sm:mb-3 leading-tight tracking-tight">Sugestão: Invista R$ {(salario_liquido * 0.1).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} este mês.</h4>
              <div className="flex flex-col sm:flex-row gap-3">
                <button 
                  onClick={() => navigate("/evolucao")}
                  className="text-[9px] sm:text-[10px] font-black uppercase text-white/50 hover:text-white transition-colors flex items-center justify-center sm:justify-start gap-1"
                >
                  Ver Guia <TrendingUp className="w-2.5 h-2.5" />
                </button>
                <a 
                  href="https://pay.kiwify.com.br/HU0rEsK" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-purple-600 hover:bg-purple-500 text-white text-[9px] sm:text-[10px] font-black uppercase px-3 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  <Lock className="w-2.5 h-2.5" /> 💳 Liberar Acesso PRO
                </a>
              </div>
            </div>
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl hidden sm:flex items-center justify-center text-blue-400 border border-white/10 flex-shrink-0 animate-pulse">
              <Sparkles className="w-6 h-6 sm:w-8 sm:h-8" />
            </div>
          </div>
        </main>
      </div>
    </InternalLayout>
  );
}

function TrialCountdown({ daysRemaining }: { daysRemaining: number }) {
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      setOpacity((prev) => (prev === 1 ? 0.6 : 1));
    }, 800);
    return () => clearInterval(interval);
  }, []);

  const isLastDays = daysRemaining <= 2;

  return (
    <div className="space-y-3">
      <div 
        id="trialBox" 
        style={{ opacity, backgroundColor: isLastDays ? '#ef4444' : '#facc15', color: isLastDays ? 'white' : 'black' }}
        className={`p-3 rounded-xl mt-4 text-center font-bold text-xs sm:text-sm shadow-lg transition-all duration-300 ${isLastDays ? 'shadow-red-400/20' : 'shadow-yellow-400/20'}`}
      >
        {isLastDays ? (
          <>
            ⏳ Seu teste está acabando…<br />
            <span className="text-[10px] opacity-80 uppercase tracking-widest">Quer continuar usando?</span><br />
            👉 Apenas R$ 9,90/mês
          </>
        ) : (
          <>
            👷‍♂️ Você ganhou 7 dias grátis!<br />
            <span className="text-[10px] opacity-80 uppercase tracking-widest">Faltam {Math.ceil(daysRemaining)} dias</span>
          </>
        )}
      </div>

      {isLastDays && (
        <a 
          href="https://pay.kiwify.com.br/HU0rEsK" 
          target="_blank" 
          rel="noopener noreferrer"
          className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-4 rounded-xl block text-center font-black uppercase tracking-widest text-xs shadow-xl shadow-purple-600/20 transition-all transform active:scale-95"
        >
          💳 Liberar Acesso PRO
        </a>
      )}
    </div>
  );
}

function AdminPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch("/api/users");
        if (!res.ok) throw new Error("Falha ao carregar usuários");
        const data = await res.json();
        setUsers(data);

        // Stats calculation as requested
        let total = data.length;
        let pro = data.filter((u: any) => u.plano === "pro").length;
        console.log("Total:", total);
        console.log("Pagantes:", pro);

      } catch (err) {
        console.error(err);
        setError("Erro ao carregar lista de usuários. Verifique se você tem permissão.");
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const totalCount = users.length;
  const proCount = users.filter((u: any) => u.plano === "pro").length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-6 sm:p-10 font-sans">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-500/10 rounded-2xl border border-purple-500/20">
              <ShieldCheck className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">Painel Admin</h1>
              <p className="text-slate-400 text-sm">Gerenciamento de usuários e planos</p>
            </div>
          </div>
          <button 
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
        </div>

        {/* Stats Summary Section */}
        {!loading && !error && (
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-slate-900/50 border border-white/5 p-6 rounded-[28px] backdrop-blur-sm">
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-1">Total Usuários</p>
              <h2 className="text-3xl font-black text-white">{totalCount}</h2>
            </div>
            <div className="bg-purple-500/10 border border-purple-500/20 p-6 rounded-[28px] backdrop-blur-sm">
              <p className="text-purple-400/60 text-[10px] font-black uppercase tracking-widest mb-1">Assinantes PRO</p>
              <h2 className="text-3xl font-black text-purple-400">{proCount}</h2>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Carregando usuários...</p>
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-3xl text-center">
            <p className="text-red-400 font-bold">{error}</p>
          </div>
        ) : (
          <div className="bg-slate-900/50 border border-white/5 rounded-[32px] overflow-hidden backdrop-blur-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Usuário</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Plano</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, idx) => (
                    <motion.tr 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      key={u.id} 
                      className="border-b border-white/5 hover:bg-white/5 transition-colors group"
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400 group-hover:bg-purple-500 group-hover:text-white transition-all">
                            {u.email[0].toUpperCase()}
                          </div>
                          <span className="text-sm font-bold text-slate-200">{u.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          u.plano === 'pro' 
                          ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                          {u.plano || 'free'}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 text-emerald-500 rounded-lg text-[9px] font-black uppercase">
                          <CheckCircle2 className="w-3 h-3" /> {u.ativo ? 'Ativo' : 'Inativo'}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
            {users.length === 0 && (
              <div className="p-20 text-center">
                <p className="text-slate-500 font-bold italic">Nenhum usuário encontrado no sistema.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function HomePage({ user, userPlan, trialDays }: { user: User | null, userPlan: string | null, trialDays: number | null }) {
  const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/webhook` : "/api/webhook";
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-purple-500/30">
      {/* Dynamic Background Blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full" />
        <div className="absolute top-[20%] -right-[10%] w-[30%] h-[30%] bg-blue-600/10 blur-[120px] rounded-full" />
      </div>

      <nav className="relative z-20 max-w-7xl mx-auto px-6 py-6 flex justify-between items-center">
        <div className="flex items-center gap-2 font-bold text-xl text-white">
          <Zap className="w-6 h-6 text-purple-500 fill-current" />
          Salário Certo
        </div>
        <button 
          onClick={() => navigate("/login")}
          className="px-5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-purple-500/50 text-white text-sm font-medium transition-all shadow-lg shadow-purple-500/5"
        >
          Acessar Painel
        </button>
      </nav>

      <main className="relative z-10 max-w-4xl mx-auto px-6 py-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12 sm:mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs sm:text-sm font-medium mb-6 sm:mb-8">
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
            O Controle Total em Suas Mãos
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-white tracking-tight mb-4 sm:mb-6">
            💰 Descubra quanto você <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400 font-black">realmente ganha</span>
          </h1>
          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed px-4">
            A maioria dos trabalhadores recebe errado e nem sabe…
          </p>
          
          <div className="flex flex-col items-center justify-center gap-4 mb-10">
            <div className="flex -space-x-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-slate-950 bg-slate-800 flex items-center justify-center overflow-hidden">
                  <img src={`https://picsum.photos/seed/user${i}/100/100`} alt="User" referrerPolicy="no-referrer" />
                </div>
              ))}
            </div>
            <p className="text-sm sm:text-base text-green-400 font-bold">
              ✔ Mais de 1.000 trabalhadores já usaram
            </p>
          </div>

          <div className="bg-slate-900/80 border border-slate-700/50 p-6 sm:p-8 rounded-[36px] sm:rounded-[40px] max-w-lg mx-4 sm:mx-auto backdrop-blur-md shadow-2xl relative overflow-hidden group">
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-purple-600/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
            
            <div className="relative z-10 space-y-4">
              <button 
                onClick={async () => {
                  if (!user) {
                    navigate("/login");
                  } else {
                    const hasAcesso = userPlan === "pro" || (trialDays !== null && (trialDays as number) > 0);
                    if (hasAcesso) {
                      navigate("/calculator");
                    } else {
                      // Se logado mas sem acesso, desloga para permitir novo login/teste
                      await signOut(auth);
                      navigate("/login");
                    }
                  }
                }}
                className="w-full bg-white text-purple-900 font-black py-4 sm:py-5 rounded-xl flex items-center justify-center gap-3 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-xl text-sm sm:text-base outline-none"
              >
                Testar Simulador Grátis
              </button>

              <a 
                href="https://pay.kiwify.com.br/HU0rEsK"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-black py-4 sm:py-5 rounded-xl flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-purple-600/20 text-sm sm:text-base no-underline"
              >
                💳 Liberar Acesso PRO
              </a>

              <p className="text-center text-slate-500 text-[10px] sm:text-xs font-medium italic">
                Sem necessidade de cadastro para o teste.
              </p>

              {user && userPlan === "free" && trialDays !== null && trialDays > 0 && (
                <TrialCountdown daysRemaining={trialDays} />
              )}
              
              {!user && (
                <div id="trialBox" className="bg-yellow-400 text-black p-3 rounded-xl mt-4 text-center font-bold text-xs sm:text-sm shadow-lg shadow-yellow-400/20">
                  👷‍♂️ Ganhe 7 dias grátis no Salário Certo!<br />
                  <span className="text-[10px] uppercase opacity-70">Liberação imediata pós-cadastro</span>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Pricing Section */}
        <section className="mb-20 text-center">
          <h2 className="text-2xl font-bold text-white mb-8">Escolha sua Tranquilidade</h2>
          <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <div className="p-8 rounded-[32px] bg-slate-900/40 border border-white/5">
              <h3 className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mb-4">Teste Grátis</h3>
              <div className="text-4xl font-black text-white mb-2">R$ 0</div>
              <p className="text-slate-500 text-sm mb-6">Explore o painel por 7 dias</p>
              <ul className="space-y-3 text-sm text-slate-300 mb-8">
                <li className="flex items-center gap-2 justify-center">✔ Cálculos CLT</li>
                <li className="flex items-center gap-2 justify-center">✔ Dashboard Visual</li>
              </ul>
              <button 
                onClick={() => navigate("/login")}
                className="w-full py-3 rounded-xl bg-slate-800 text-white font-bold hover:bg-slate-700 transition-colors"
              >
                Ativar Trial
              </button>
            </div>
            <div className="p-8 rounded-[32px] bg-purple-500/10 border border-purple-500/20 relative overflow-hidden group">
              <div className="absolute top-4 right-4 px-2 py-1 bg-purple-500 text-white text-[8px] font-black uppercase rounded-lg">Popular</div>
              <h3 className="text-purple-400 font-bold uppercase tracking-widest text-[10px] mb-4">Plano PRO</h3>
              <div className="text-4xl font-black text-white mb-2">R$ 9,90<span className="text-sm font-medium text-slate-500">/mês</span></div>
              <p className="text-slate-400 text-sm mb-6">Seu controle total garantido</p>
              <ul className="space-y-3 text-sm text-slate-200 mb-8">
                <li className="flex items-center gap-2 justify-center font-bold">📈 Histórico e Evolução</li>
                <li className="flex items-center gap-2 justify-center font-bold">🤖 IA Corretora de Salário</li>
              </ul>
              <a 
                href="https://pay.kiwify.com.br/HU0rEsK"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-4 rounded-xl bg-purple-500 text-white font-black hover:bg-purple-400 transition-all shadow-lg shadow-purple-500/20 no-underline"
              >
                💳 Liberar Agora
              </a>
            </div>
          </div>
        </section>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
          <FeatureCard 
            icon={<LayoutDashboard className="w-6 h-6 text-purple-400" />}
            title="Dashboard Visual"
            description="Gráficos interativos que mostram exatamente como seu salário é distribuído."
          />
          <FeatureCard 
            icon={<Calculator className="w-6 h-6 text-blue-400" />}
            title="Cálculos Precisos"
            description="Baseado nas regras da CLT 2026, incluindo INSS, IRPF e Horas Extras."
          />
          <FeatureCard 
            icon={<Sparkles className="w-6 h-6 text-yellow-400" />}
            title="Evolução Salarial"
            description="Visão clara do seu progresso e projeções para os próximos meses."
          />
        </div>
      </main>

      <footer className="max-w-4xl mx-auto px-6 py-12 border-t border-slate-900/50 text-center text-slate-500 text-sm">
        Salário Certo &copy; 2026 • Gestão Salarial e Planejamento Financeiro
      </footer>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userPlan, setUserPlan] = useState<string | null>(null);
  const [trialDays, setTrialDays] = useState<number | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser && currentUser.email) {
        try {
          const userDoc = await getDoc(doc(db, "usuarios", currentUser.email));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUserPlan(data?.plano || "free");
            
            // Trial Logic as requested: uses trial_inicio from DB if available
            const trialStart = data?.trial_inicio 
              ? (data.trial_inicio.toDate ? data.trial_inicio.toDate().getTime() : data.trial_inicio)
              : new Date(currentUser.metadata.creationTime || new Date()).getTime();

            const now = Date.now();
            const diasDecorridos = (now - trialStart) / (1000 * 60 * 60 * 24);
            const restantes = 7 - diasDecorridos;
            
            setTrialDays(Math.max(0, restantes));

          } else {
            setUserPlan("free");
            setTrialDays(7); // Default trial for new signups not in DB yet
          }
        } catch (error) {
          console.error("Erro ao carregar plano:", error);
          setUserPlan("free");
          setTrialDays(7);
        }
      } else {
        setUserPlan(null);
        setTrialDays(null);
      }
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const [grossSalary, setGrossSalary] = useState<number>(1000.00);
  const [he70Hours, setHe70Hours] = useState<number>(12);
  const [he100Hours, setHe100Hours] = useState<number>(0);
  const [nightHours, setNightHours] = useState<number>(0);
  
  // Benefit Costs (Benefit provided by company)
  const [vtCost, setVtCost] = useState<number>(5.49);
  const [vaCost, setVaCost] = useState<number>(0);
  const [vrCost, setVrCost] = useState<number>(0); // VR can be zero or part of VA

  const [monthsWorked, setMonthsWorked] = useState<number>(7);
  const [isSimpleMode, setIsSimpleMode] = useState(false);
  const [simpleExtra, setSimpleExtra] = useState<number>(0);
  const [simpleNight, setSimpleNight] = useState<number>(0);

  const results = useMemo(() => {
    if (isSimpleMode) {
      const bruto = grossSalary + simpleExtra + simpleNight;
      const totalEarnings = bruto;
      const inss = Math.round(bruto * 0.08 * 100) / 100; // Simplified 8% as per user snippet
      const irpf = 0;
      const totalBenefitsDiscount = 0;
      const netSalary = Math.round((bruto - inss) * 100) / 100;
      
      return {
        he70Total: simpleExtra, he100Total: 0, nightTotal: simpleNight, dsrTotal: 0, totalEarnings,
        inss, irpf, netSalary, monthlyFGTS: bruto * 0.08, accruedFGTS: (bruto * 0.08) * monthsWorked,
        avisoPrevio: bruto, decimoTerceiroProp: (bruto / 12) * (monthsWorked % 12 || 12), feriasProp: 0,
        vtCalcDiscount: 0, totalBenefitsDiscount: 0
      };
    }

    const hourlyRate = grossSalary / 220;
    const he70Total = Math.round(he70Hours * (hourlyRate * 1.7) * 100) / 100;
    const he100Total = Math.round(he100Hours * (hourlyRate * 2.0) * 100) / 100;
    const nightTotal = Math.round(nightHours * (hourlyRate * 0.20) * 100) / 100;
    const dsrTotal = Math.round(((he70Total + he100Total + nightTotal) / 25) * 5 * 100) / 100;
    
    // Proventos/Total Earnings
    const totalEarnings = Math.round((grossSalary + he70Total + he100Total + nightTotal + dsrTotal) * 100) / 100;
    
    // FGTS Base (Scaling with earnings) - maintaining the 0.46 diff logic if earnings was high, 
    // but typically it's just totalEarnings.
    const fgtsBase = Math.round((totalEarnings - 0.46) * 100) / 100;
    
    // Automatic VT Discount Calculation (CLT Rule: 6% of base salary, capped at benefit cost)
    const vtCalcDiscount = Math.round(Math.min(vtCost, grossSalary * 0.06) * 100) / 100;
    
    // VA/VR Discounts (Direct user provided costs for deduction simulation)
    const totalBenefitsDiscount = Math.round((vtCalcDiscount + vaCost + vrCost) * 100) / 100;

    const inss = Math.round(calculateINSS(totalEarnings) * 100) / 100;
    const irpfBase = totalEarnings - inss;
    const irpf = Math.round(calculateIRPF(Math.max(0, irpfBase)) * 100) / 100;
    
    const netSalary = Math.round((totalEarnings - inss - irpf - totalBenefitsDiscount) * 100) / 100;
    const monthlyFGTS = Math.round(fgtsBase * 0.08 * 100) / 100;
    const accruedFGTS = Math.round(monthlyFGTS * monthsWorked * 100) / 100;
    
    const avisoPrevio = fgtsBase; 
    const decimoTerceiroProp = Math.floor((fgtsBase / 12) * (monthsWorked % 12 || 12) * 100) / 100;
    const feriasProp = 2820.64;

    return {
      he70Total, he100Total, nightTotal, dsrTotal, totalEarnings,
      inss, irpf, netSalary, monthlyFGTS, accruedFGTS,
      avisoPrevio, decimoTerceiroProp, feriasProp,
      vtCalcDiscount, totalBenefitsDiscount
    };
  }, [grossSalary, he70Hours, he100Hours, nightHours, vtCost, vaCost, vrCost, monthsWorked, isSimpleMode, simpleExtra, simpleNight]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  const ProtectedRoute = ({ children, requirePro = false }: { children: ReactNode, requirePro?: boolean }) => {
    if (!user) return <Navigate to="/login" replace />;
    
    // Liberalize access: Allow PRO users OR users with remaining trial days
    const hasAcesso = userPlan === "pro" || (trialDays !== null && trialDays > 0);

    if (requirePro && !hasAcesso) {
      useEffect(() => {
        alert("Acesso expirado ou restrito ao Plano PRO.");
      }, []);
      return <Navigate to="/" replace />;
    }
    
    return <>{children}</>;
  };

  const hasAcesso = userPlan === "pro" || (trialDays !== null && (trialDays as number) > 0);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage user={user} userPlan={userPlan} trialDays={trialDays} />} />
        <Route path="/login" element={
          (user && hasAcesso) ? <Navigate to="/dashboard" replace /> : <LoginPage />
        } />
        <Route path="/dashboard" element={
          <ProtectedRoute requirePro>
            <DashboardPage 
              results={results} 
              grossSalary={grossSalary} setGrossSalary={setGrossSalary}
              he70Hours={he70Hours} setHe70Hours={setHe70Hours}
              he100Hours={he100Hours} setHe100Hours={setHe100Hours}
              nightHours={nightHours} setNightHours={setNightHours}
              vtCost={vtCost} setVtCost={setVtCost}
              vaCost={vaCost} setVaCost={setVaCost}
              vrCost={vrCost} setVrCost={setVrCost}
              nightTotal={results.nightTotal}
              he70Total={results.he70Total}
              he100Total={results.he100Total}
            />
          </ProtectedRoute>
        } />
        <Route path="/calculator" element={
          <ProtectedRoute requirePro>
            <SalaryCalculatorPage 
              grossSalary={grossSalary} setGrossSalary={setGrossSalary}
              he70Hours={he70Hours} setHe70Hours={setHe70Hours}
              he100Hours={he100Hours} setHe100Hours={setHe100Hours}
              nightHours={nightHours} setNightHours={setNightHours}
              vtCost={vtCost} setVtCost={setVtCost}
              vaCost={vaCost} setVaCost={setVaCost}
              vrCost={vrCost} setVrCost={setVrCost}
              monthsWorked={monthsWorked} setMonthsWorked={setMonthsWorked}
              results={results}
              isSimpleMode={isSimpleMode} setIsSimpleMode={setIsSimpleMode}
              simpleExtra={simpleExtra} setSimpleExtra={setSimpleExtra}
              simpleNight={simpleNight} setSimpleNight={setSimpleNight}
            />
          </ProtectedRoute>
        } />
        <Route path="/evolucao" element={
          <ProtectedRoute requirePro>
            <EvolucaoPage results={results} user={user} />
          </ProtectedRoute>
        } />
        <Route path="/admin" element={
          <ProtectedRoute>
            <AdminPage />
          </ProtectedRoute>
        } />
        <Route path="/historico.html" element={<Navigate to="/evolucao" replace />} />
        <Route path="/app" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
