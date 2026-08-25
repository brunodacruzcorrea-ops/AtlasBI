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
import CartasContempladas from './pages/cartas-contempladas';
import RootRedirect from './pages/index';
const queryClient = new QueryClient();
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
      <Route path="/cartas-contempladas"><ProtectedRoute component={CartasContempladas} /></Route>
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
