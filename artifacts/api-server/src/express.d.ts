// ensureAuth (routes/auth.ts) anexa o id do usuario autenticado na request.
// Sem esta declaracao o acesso a req.userId em rotas tipadas nao compila.
declare global {
  namespace Express {
    interface Request {
      userId?: number;
    }
  }
}

export {};
