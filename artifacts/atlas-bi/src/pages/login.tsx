import { useState } from "react";
import { useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { Map, ArrowRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [errorMsg, setErrorMsg] = useState("");

  const loginMutation = useLogin();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    loginMutation.mutate(
      { data: { email, password } },
      {
        onSuccess: (data) => {
          localStorage.setItem("atlas_token", data.token);
          queryClient.invalidateQueries();
          setLocation("/dashboard");
        },
        onError: (err: any) => {
          setErrorMsg(err.message || "Usuário ou senha inválidos");
        }
      }
    );
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-sidebar relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary rounded-full blur-[100px]" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-accent rounded-full blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md p-8 bg-sidebar-border/30 backdrop-blur-xl border border-sidebar-border rounded-2xl shadow-2xl z-10"
      >
        <div className="flex flex-col items-center justify-center mb-10">
          <div className="flex items-center gap-3 text-4xl font-black tracking-wider text-sidebar-foreground mb-2">
            <span className="text-sidebar-primary"><Map className="w-10 h-10" /></span>
            <span>ATLAS <span className="text-sidebar-primary">BI</span></span>
          </div>
          <span className="text-sm font-semibold tracking-[0.3em] text-sidebar-foreground/50">
            <span className="text-sm font-semibold tracking-[0.3em] text-sidebar-foreground/50">
              CENTRAL DE COMANDO NIADCON
            </span>

            <p className="text-xs text-sidebar-foreground/40 mt-2 text-center">
              Faça login para acessar o painel de gestão comercial.
            </p>
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/70">
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-sidebar-border/50 border border-sidebar-border text-sidebar-foreground px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-sidebar-primary focus:border-transparent transition-all placeholder:text-sidebar-foreground/30"
              placeholder="usuario@niadcon.com.br"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/70">
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-sidebar-border/50 border border-sidebar-border text-sidebar-foreground px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-sidebar-primary focus:border-transparent transition-all placeholder:text-sidebar-foreground/30"
              placeholder="••••••••"
            />
          </div>

          {errorMsg && (
            <div className="p-3 bg-destructive/20 border border-destructive/50 rounded-lg text-sm text-destructive-foreground font-medium text-center">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="w-full bg-sidebar-primary hover:bg-sidebar-primary/90 text-sidebar-primary-foreground font-bold px-4 py-3.5 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed group mt-4 shadow-[0_0_20px_rgba(244,121,32,0.3)] hover:shadow-[0_0_25px_rgba(244,121,32,0.5)]"
          >
            {loginMutation.isPending ? "AUTENTICANDO..." : "ENTRAR NO SISTEMA"}
            {!loginMutation.isPending && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
