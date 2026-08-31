import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { AuthProvider } from './components/auth-provider';
import { Shell } from './components/layout/shell';
import Login from './pages/login';
import Dashboard from './pages/dashboard';
import Ranking from './pages/ranking';
import Consultants from './pages/consultants';
import Sales from './pages/sales';
import Goals from './pages/goals';
import UsersPage from './pages/users';
import RootRedirect from './pages/index';
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Sem staleTime, cada montagem de tela e cada volta do foco refaziam a
      // mesma consulta: nos logs, os tres endpoints do painel apareciam
      // duplicados com segundos de diferenca. Trinta segundos nao atrasam a
      // venda nova, que chega pelo SSE e invalida o cache na hora.
      staleTime: 30_000,
      // Repetir um 401 tres vezes so multiplica a falha: o token expirou ou o
      // servidor reiniciou, e nenhuma das duas coisas melhora na segunda
      // tentativa. Erro de rede ainda merece uma repeticao.
      retry: (failureCount, error) => {
        const status = (error as { status?: number } | null)?.status;
        if (typeof status === "number" && status >= 400 && status < 500) return false;
        return failureCount < 1;
      },
    },
  },
});
function ProtectedRoute({ component: Component }: { component: React.ComponentType<any> }) {
  return (
    <Shell>
      <Component />
    </Shell>
  );
}
function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={RootRedirect} />
      <Route path="/dashboard"><ProtectedRoute component={Dashboard} /></Route>
      <Route path="/ranking"><ProtectedRoute component={Ranking} /></Route>
      <Route path="/consultants"><ProtectedRoute component={Consultants} /></Route>
      <Route path="/sales"><ProtectedRoute component={Sales} /></Route>
      <Route path="/goals"><ProtectedRoute component={Goals} /></Route>
      <Route path="/users"><ProtectedRoute component={UsersPage} /></Route>
      <Route>
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <h1 className="text-2xl font-bold">404 - Page Not Found</h1>
        </div>
      </Route>
    </Switch>
  );
}
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
export default App;
