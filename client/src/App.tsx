import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  ArrowDownLeft, ArrowUpRight, BarChart3, BriefcaseBusiness, CalendarDays, ChevronDown,
  CircleDollarSign, FileBarChart, Home, Landmark, LogOut, Menu, Plus, Settings, ShieldCheck,
  Sparkles, Sun, Moon, Trash2, TrendingUp, Wallet, X, Zap
} from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, postJson, Service, Transaction, User } from './api';

type Page = 'Dashboard' | 'Servicios' | 'Movimientos' | 'Reportes' | 'Configuracion' | 'TipoCambio';
type DashboardData = { exchangeRateCup: string | number; totals: { incomeUsd: string; expenseUsd: string; incomeCup: string; expenseCup: string; incomeCupToUsd: number; expenseCupToUsd: number; incomeUsdToCup: number; expenseUsdToCup: number; transactionCount: string }; monthly: { month: string; incomeUsd: string; expenseUsd: string; incomeCup: string; expenseCup: string }[]; yearly: { year: number; incomeUsd: string; expenseUsd: string; incomeCup: string; expenseCup: string }[]; recent: Transaction[]; serviceCount: number };
type AuthValue = { user: User | null; login: (token: string, user: User) => void; logout: () => void };
const AuthContext = createContext<AuthValue | undefined>(undefined);
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe utilizarse dentro de AuthContext');
  return context;
};

const usd = (value: string | number) => `$${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const cup = (value: string | number) => `${Number(value || 0).toLocaleString('es-CU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CUP`;
const dateLabel = (value: string) => new Date(`${value.split('T')[0]}T12:00:00`).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' });

function AuthPage({ onAuth }: { onAuth: (token: string, user: User) => void }) {
  const [register, setRegister] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', company: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setLoading(true);
    try {
      const data = await postJson<{ token: string; user: User }>(`/auth/${register ? 'register' : 'login'}`, form);
      onAuth(data.token, data.user);
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión.'); } finally { setLoading(false); }
  };
  return <main className="auth-page">
    <section className="auth-visual">
      <div className="brand"><span className="brand-mark"><Zap size={20} fill="currentColor" /></span> Horizon<span> Finanzas</span></div>
      <div className="visual-copy"><p className="eyebrow">CONTROL FINANCIERO INTELIGENTE</p><h1>Tu negocio,<br /><em>en equilibrio.</em></h1><p>Una vista clara de cada peso y cada dólar para tomar mejores decisiones.</p></div>
      <div className="visual-footer"><ShieldCheck size={16} /> Tus datos están protegidos con seguridad empresarial</div>
    </section>
    <section className="auth-form-wrap"><div className="auth-form">
      <div className="mobile-brand brand"><span className="brand-mark"><Zap size={18} fill="currentColor" /></span> Horizon<span> Finanzas</span></div>
      <p className="eyebrow">BIENVENIDO A HORIZON FINANZAS</p><h2>{register ? 'Crea tu cuenta' : 'Qué bueno verte'}</h2><p className="muted">{register ? 'Empieza a organizar tus finanzas hoy.' : 'Ingresa para continuar con tu gestión financiera.'}</p>
      {error && <div className="alert">{error}</div>}
      <form onSubmit={submit}>
        {register && <label>Nombre completo<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Tu nombre" /></label>}
        {register && <label>Empresa<input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} placeholder="Nombre de tu empresa" /></label>}
        <label>Correo electrónico<input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="nombre@empresa.com" /></label>
        <label>Contraseña<input type="password" required minLength={6} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 6 caracteres" /></label>
        <button className="primary-button full" disabled={loading}>{loading ? 'Procesando…' : register ? 'Crear cuenta' : 'Iniciar sesión'} <ArrowUpRight size={17} /></button>
      </form>
      <p className="switch-auth">{register ? '¿Ya tienes una cuenta?' : '¿Aún no tienes una cuenta?'} <button onClick={() => { setRegister(!register); setForm({ name: '', email: '', password: '', company: '' }); setError(''); }}> {register ? 'Inicia sesión' : 'Regístrate gratis'}</button></p>
    </div></section>
  </main>;
}

const navItems: { page: Page; icon: typeof Home; label: string }[] = [
  { page: 'Dashboard', icon: Home, label: 'Dashboard' }, { page: 'Servicios', icon: BriefcaseBusiness, label: 'Servicios' },
  { page: 'Movimientos', icon: ArrowUpRight, label: 'Movimientos' }, { page: 'Reportes', icon: FileBarChart, label: 'Reportes' }, { page: 'TipoCambio', icon: Landmark, label: 'Tasa USD / CUP' }, { page: 'Configuracion', icon: Settings, label: 'Configuración' }
];

function Layout({ user, page, setPage, onLogout, children }: { user: User; page: Page; setPage: (p: Page) => void; onLogout: () => void; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const companyName = user.company?.trim() || 'Finanzas';
  return <div className="app-shell">
    <aside className={open ? 'sidebar open' : 'sidebar'}><div className="sidebar-brand brand"><span className="brand-mark"><Zap size={19} fill="currentColor" /></span> Horizon<span> Finanzas</span></div>
      <p className="nav-label">MENÚ PRINCIPAL</p><nav>{navItems.map(item => { const Icon = item.icon; return <button key={item.page} className={page === item.page ? 'nav-item active' : 'nav-item'} onClick={() => { setPage(item.page); setOpen(false); }}><Icon size={18} />{item.label}{item.page === 'Movimientos' && <span className="nav-dot" />}</button>; })}</nav>
      <div className="sidebar-bottom"><div className="help-card"><Sparkles size={18} /><strong>Horizon insights</strong><span>Consejos para hacer crecer tu negocio.</span><button onClick={() => setPage('Reportes')}>Ver insights <ArrowUpRight size={14} /></button></div></div>
    </aside>
    <div className="main-area"><header className="topbar"><button className="mobile-menu" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button><div className="breadcrumb">{companyName} <span>/</span> <strong>{page}</strong></div><div className="top-actions"><div className="profile-menu"><button className="profile profile-trigger" aria-expanded={profileOpen} onClick={() => setProfileOpen(!profileOpen)}><div className="profile-avatar">{user.name.slice(0, 1).toUpperCase()}</div><div><strong>{user.name}</strong><small>Administrador</small></div><ChevronDown size={15} /></button>{profileOpen && <div className="profile-dropdown"><div className="profile-dropdown-info"><strong>{user.name}</strong><small>{user.email}</small></div><button className="dropdown-logout" onClick={() => { setProfileOpen(false); onLogout(); }}><LogOut size={16} />Cerrar sesión</button></div>}</div></div></header><main className="content">{children}</main></div>
  </div>;
}

function Dashboard({ data, loading, onAddMovement }: { data: DashboardData | null; loading: boolean; onAddMovement: () => void }) {
  const [period, setPeriod] = useState(6);
  if (loading || !data) return <Loading />;
  const totals = data.totals;
  const profitUsd = Number(totals.incomeUsd) - Number(totals.expenseUsd);
  const profitCup = Number(totals.incomeCup) - Number(totals.expenseCup);
  const chart = data.monthly.slice(-period).map(item => ({ ...item, incomeUsd: Number(item.incomeUsd), expenseUsd: Number(item.expenseUsd), incomeCup: Number(item.incomeCup), expenseCup: Number(item.expenseCup) }));
  return <><div className="page-heading"><div><p className="eyebrow">RESUMEN GENERAL</p><h1>Buenos días, revisemos tu negocio.</h1><p className="muted">Aquí tienes el pulso financiero de <strong>este periodo</strong>.</p></div><button className="primary-button" onClick={onAddMovement}><Plus size={17} /> Nuevo movimiento</button></div>
    <div className="stat-grid">
      <StatCard label="Ingresos totales" value={usd(totals.incomeUsd)} detail={`${cup(totals.incomeCup)} · ${usd(totals.incomeCupToUsd)} equivalentes`} icon={<TrendingUp />} tone="green" />
      <StatCard label="Gastos totales" value={usd(totals.expenseUsd)} detail={`${cup(totals.expenseCup)} · ${usd(totals.expenseCupToUsd)} equivalentes`} icon={<ArrowDownLeft />} tone="orange" />
      <StatCard label="Balance neto" value={usd(profitUsd)} detail={`${cup(profitCup)} · Tasa: 1 USD = ${cup(data.exchangeRateCup)}`} icon={<Wallet />} tone="blue" />
      <StatCard label="Movimientos" value={totals.transactionCount} detail={`${data.serviceCount} servicios activos`} icon={<BarChart3 />} tone="purple" />
    </div>
    <div className="dashboard-grid"><section className="panel chart-panel"><div className="panel-heading"><div><h3>Flujo de caja</h3><p className="muted">Ingresos y gastos en USD y CUP · periodo seleccionado</p></div><div className="period-select"><span>Periodo</span><select aria-label="Seleccionar periodo del flujo de caja" value={period} onChange={e => setPeriod(Number(e.target.value))}><option value="6">Últimos 6 meses</option><option value="12">Últimos 12 meses</option><option value="24">Últimos 24 meses</option></select><ChevronDown size={14} /></div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chart}><defs><linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#39c995" stopOpacity=".25" /><stop offset="100%" stopColor="#39c995" stopOpacity="0" /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f4" /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#8b96a8', fontSize: 12 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#8b96a8', fontSize: 12 }} tickFormatter={(v) => `$${v / 1000}k`} /><Tooltip formatter={(value, name) => name.toString().includes('CUP') ? cup(value as number) : usd(value as number)} /><Area type="monotone" dataKey="incomeUsd" stroke="#27b982" strokeWidth={2.5} fill="url(#incomeFill)" name="Ingresos USD" /><Area type="monotone" dataKey="expenseUsd" stroke="#f0a24b" strokeWidth={2.5} fill="none" name="Gastos USD" /><Area type="monotone" dataKey="incomeCup" stroke="#2476d8" strokeWidth={2} fill="none" name="Ingresos CUP" /><Area type="monotone" dataKey="expenseCup" stroke="#9b59b6" strokeWidth={2} fill="none" name="Gastos CUP" /></AreaChart></ResponsiveContainer></div><div className="legend"><span><i className="dot green" />Ingresos USD</span><span><i className="dot orange" />Gastos USD</span><span><i className="dot" style={{ background: '#2476d8' }} />Ingresos CUP</span><span><i className="dot" style={{ background: '#9b59b6' }} />Gastos CUP</span></div></section>
      <section className="panel recent-panel"><div className="panel-heading"><div><h3>Actividad reciente</h3><p className="muted">Últimos movimientos</p></div><button className="text-button" onClick={onAddMovement}>Ver todos <ArrowUpRight size={14} /></button></div>{data.recent.length ? <div className="activity-list">{data.recent.map(t => { const isUsd = t.amountUsd && Number(t.amountUsd) > 0; const original = isUsd ? usd(t.amountUsd) : cup(t.amountCup); const rate = Number(data.exchangeRateCup); const converted = rate > 0 ? (isUsd ? cup(Number(t.amountUsd) * rate) : usd(Number(t.amountCup) / rate)) : 'Tasa no configurada'; return <div className="activity" key={t.id}><div className={t.type === 'Ingreso' ? 'activity-icon income' : 'activity-icon expense'}>{t.type === 'Ingreso' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</div><div className="activity-info"><strong>{t.description}</strong><small>{dateLabel(t.transactionDate)} · {original} · {converted}</small></div><strong className={t.type === 'Ingreso' ? 'amount income-text' : 'amount expense-text'}>{t.type === 'Ingreso' ? '+' : '-'}{original}</strong></div>})}</div> : <EmptyState text="Aún no hay movimientos" />}</section>
    </div>
  </>;
}

function StatCard({ label, value, detail, icon, tone }: { label: string; value: string; detail: string; icon: ReactNode; tone: string }) { return <div className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong><small>{detail}</small></div>; }
function Loading() { return <div className="loading"><div className="spinner" />Cargando información…</div>; }
function EmptyState({ text }: { text: string }) { return <div className="empty"><CircleDollarSign size={30} /><p>{text}</p></div>; }

function ServicesPage({ services, reload }: { services: Service[]; reload: () => void }) {
  const [show, setShow] = useState(false); const [editing, setEditing] = useState<Service | null>(null);
  const [sortBy, setSortBy] = useState('name-asc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [form, setForm] = useState({ name: '', description: '', category: 'Consultoría', costUsd: '', costCup: '', status: 'Activo' }); const [error, setError] = useState('');
  // El ordenamiento es local para que cambiarlo sea inmediato y no modifique el catálogo guardado.
  const sortedServices = useMemo(() => {
    const [field, direction] = sortBy.split('-');
    const multiplier = direction === 'desc' ? -1 : 1;
    return [...services].sort((a, b) => {
      if (field === 'name') return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }) * multiplier;
      const first = Number(field === 'usd' ? a.costUsd : a.costCup);
      const second = Number(field === 'usd' ? b.costUsd : b.costCup);
      return (first - second) * multiplier;
    });
  }, [services, sortBy]);
  const pageCount = Math.ceil(sortedServices.length / pageSize);
  const visibleServices = sortedServices.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const openForm = (service?: Service) => { setEditing(service || null); setForm(service ? { name: service.name, description: service.description || '', category: service.category, costUsd: String(service.costUsd), costCup: String(service.costCup), status: service.status } : { name: '', description: '', category: 'Consultoría', costUsd: '', costCup: '', status: 'Activo' }); setError(''); setShow(true); };
  const save = async (e: FormEvent) => { e.preventDefault(); try { await api(`/services${editing ? `/${editing.id}` : ''}`, { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(form) }); setShow(false); if (!editing) setCurrentPage(1); reload(); } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo guardar.'); } };
  return <><div className="page-heading"><div><p className="eyebrow">CATÁLOGO</p><h1>Servicios</h1><p className="muted">Define y controla los servicios que ofrece tu negocio.</p></div><button className="primary-button" onClick={() => openForm()}><Plus size={17} /> Nuevo servicio</button></div>
    <section className="panel table-panel">
      <div className="panel-heading">
        <div><h3>Todos los servicios</h3><p className="muted">{services.length} servicios registrados</p></div>
        <div className="period-select service-sort">
          <span>Ordenar por</span>
          <select aria-label="Ordenar catálogo de servicios" value={sortBy} onChange={e => { setSortBy(e.target.value); setCurrentPage(1); }}>
            <option value="name-asc">Nombre A-Z</option><option value="name-desc">Nombre Z-A</option>
            <option value="usd-asc">Costo USD menor</option><option value="usd-desc">Costo USD mayor</option>
            <option value="cup-asc">Costo CUP menor</option><option value="cup-desc">Costo CUP mayor</option>
          </select>
          <ChevronDown size={14} />
        </div>
      </div>
      {services.length ? <>
        <div className="table-scroll"><table><thead><tr><th>Servicio</th><th>Categoría</th><th>Costo USD</th><th>Costo CUP</th><th>Estado</th><th /></tr></thead>
          <tbody>{visibleServices.map(s => <tr key={s.id}><td><strong>{s.name}</strong><small>{s.description || 'Sin descripción'}</small></td><td>{s.category}</td><td>{usd(s.costUsd)}</td><td>{cup(s.costCup)}</td><td><span className={`status ${s.status === 'Activo' ? 'active' : 'inactive'}`}><i />{s.status}</span></td><td><button className="row-action" onClick={() => openForm(s)}>Editar</button></td></tr>)}</tbody>
        </table></div>
        {pageCount > 1 && <nav className="pagination" aria-label="Paginación de servicios">
          <span>Mostrando {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, services.length)} de {services.length}</span>
          <div className="pagination-controls">
            <button type="button" onClick={() => setCurrentPage(page => Math.max(1, page - 1))} disabled={currentPage === 1} aria-label="Página anterior">Anterior</button>
            <span>Página {currentPage} de {pageCount}</span>
            <button type="button" onClick={() => setCurrentPage(page => Math.min(pageCount, page + 1))} disabled={currentPage === pageCount} aria-label="Página siguiente">Siguiente</button>
          </div>
        </nav>}
      </> : <EmptyState text="Crea tu primer servicio para comenzar" />}
    </section>
    {show && <Modal title={editing ? 'Editar servicio' : 'Nuevo servicio'} close={() => setShow(false)}><form className="modal-form" onSubmit={save}>{error && <div className="alert">{error}</div>}<label>Nombre del servicio<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ej. Soporte técnico" /></label><label>Descripción<textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Describe brevemente este servicio" /></label><div className="form-row"><label>Categoría<select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}><option>Consultoría</option><option>Desarrollo</option><option>Soporte técnico</option><option>Infraestructura</option><option>Seguridad</option></select></label><label>Estado<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option>Activo</option><option>Inactivo</option></select></label></div><div className="form-row"><label>Costo USD<input type="number" min="0" step=".01" value={form.costUsd} onChange={e => setForm({ ...form, costUsd: e.target.value })} placeholder="0.00" /></label><label>Costo CUP<input type="number" min="0" step=".01" value={form.costCup} onChange={e => setForm({ ...form, costCup: e.target.value })} placeholder="0.00" /></label></div><button className="primary-button full">Guardar servicio</button></form></Modal>}
  </>;
}

function TransactionsPage({ transactions, services, reload }: { transactions: Transaction[]; services: Service[]; reload: () => void }) {
  const [show, setShow] = useState(false); const [editing, setEditing] = useState<Transaction | null>(null); const [error, setError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  // Cada movimiento usa una única moneda; la otra se envía como cero.
  const [form, setForm] = useState({ type: 'Ingreso', description: '', currency: 'USD', amount: '', transactionDate: new Date().toISOString().slice(0, 10), serviceId: '', notes: '' });
  const visibleTransactions = useMemo(() => selectedMonth
    ? transactions.filter(transaction => transaction.transactionDate.slice(0, 7) === selectedMonth)
    : transactions, [transactions, selectedMonth]);
  const pageCount = Math.ceil(visibleTransactions.length / pageSize);
  const paginatedTransactions = visibleTransactions.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  useEffect(() => {
    if (pageCount > 0 && currentPage > pageCount) setCurrentPage(pageCount);
  }, [currentPage, pageCount]);
  const openForm = (transaction?: Transaction) => {
    setEditing(transaction || null);
    setForm(transaction ? { type: transaction.type, description: transaction.description, currency: Number(transaction.amountCup) > 0 ? 'CUP' : 'USD', amount: String(Number(transaction.amountCup) > 0 ? transaction.amountCup : transaction.amountUsd), transactionDate: transaction.transactionDate.slice(0, 10), serviceId: transaction.type === 'Ingreso' && transaction.serviceId ? String(transaction.serviceId) : '', notes: transaction.notes || '' } : { type: 'Ingreso', description: '', currency: 'USD', amount: '', transactionDate: new Date().toISOString().slice(0, 10), serviceId: '', notes: '' });
    setError(''); setShow(true);
  };
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const payload = { ...form, amountUsd: form.currency === 'USD' ? form.amount : 0, amountCup: form.currency === 'CUP' ? form.amount : 0, serviceId: form.type === 'Ingreso' && form.serviceId ? form.serviceId : null };
      await api(`/transactions${editing ? `/${editing.id}` : ''}`, { method: editing ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
      setShow(false); setEditing(null); if (!editing) setCurrentPage(1); reload();
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo guardar.'); }
  };
  const removeTransaction = async (transaction: Transaction) => {
    if (!window.confirm(`¿Eliminar el movimiento "${transaction.description}"? Esta acción no se puede deshacer.`)) return;
    setDeleteError('');
    setDeletingId(transaction.id);
    try {
      await api(`/transactions/${transaction.id}`, { method: 'DELETE' });
      reload();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'No se pudo eliminar el movimiento.');
    } finally {
      setDeletingId(null);
    }
  };
  return <><div className="page-heading"><div><p className="eyebrow">LIBRO MAYOR</p><h1>Movimientos</h1><p className="muted">Registra y consulta ingresos y gastos de tu operación.</p></div><button className="primary-button" onClick={() => setShow(true)}><Plus size={17} /> Nuevo movimiento</button></div>
    <section className="panel table-panel"><div className="panel-heading"><div><h3>Historial de movimientos</h3><p className="muted">{visibleTransactions.length} movimientos encontrados</p></div><div className="month-filter"><CalendarDays size={14} /><label htmlFor="movement-month">Mes</label><input id="movement-month" type="month" value={selectedMonth} onChange={e => { setSelectedMonth(e.target.value); setCurrentPage(1); }} /><button type="button" className="clear-filter" onClick={() => { setSelectedMonth(''); setCurrentPage(1); }} disabled={!selectedMonth}>Todos</button></div></div>{deleteError && <div className="alert" role="alert">{deleteError}</div>}{visibleTransactions.length ? <>
      <div className="table-scroll"><table><thead><tr><th>Descripción</th><th>Notas</th><th>Tipo</th><th>Fecha</th><th>USD</th><th>CUP</th><th>Acciones</th></tr></thead><tbody>{paginatedTransactions.map(t => <tr key={t.id}><td><strong>{t.description}</strong><small>{t.serviceName || 'Movimiento general'}</small></td><td className="movement-notes">{t.notes?.trim() || '—'}</td><td><span className={`type-pill ${t.type === 'Ingreso' ? 'income' : 'expense'}`}>{t.type}</span></td><td>{dateLabel(t.transactionDate)}</td><td className={t.type === 'Ingreso' ? 'income-text' : 'expense-text'}>{t.type === 'Ingreso' ? '+' : '-'}{usd(t.amountUsd)}</td><td>{cup(t.amountCup)}</td><td><div className="movement-actions"><button className="row-action" onClick={() => openForm(t)}>Editar</button><button className="row-action delete-action" onClick={() => removeTransaction(t)} disabled={deletingId !== null} aria-label={`Eliminar movimiento ${t.description}`} title="Eliminar movimiento">{deletingId === t.id ? 'Eliminando…' : <Trash2 size={15} />}</button></div></td></tr>)}</tbody></table></div>
      {pageCount > 1 && <nav className="pagination" aria-label="Paginación de movimientos">
        <span>Mostrando {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, visibleTransactions.length)} de {visibleTransactions.length}</span>
        <div className="pagination-controls">
          <button type="button" onClick={() => setCurrentPage(page => Math.max(1, page - 1))} disabled={currentPage === 1} aria-label="Página anterior">Anterior</button>
          <span>Página {currentPage} de {pageCount}</span>
          <button type="button" onClick={() => setCurrentPage(page => Math.min(pageCount, page + 1))} disabled={currentPage === pageCount} aria-label="Página siguiente">Siguiente</button>
        </div>
      </nav>}
    </> : <EmptyState text={selectedMonth ? 'No hay movimientos en este mes' : 'Registra tu primer movimiento'} />}</section>
    {show && <Modal title={editing ? 'Editar movimiento' : 'Nuevo movimiento'} close={() => { setShow(false); setEditing(null); }}><form className="modal-form" onSubmit={save}>{error && <div className="alert">{error}</div>}<div className="toggle-row"><button type="button" className={form.type === 'Ingreso' ? 'selected income' : ''} onClick={() => setForm({ ...form, type: 'Ingreso' })}><ArrowDownLeft size={15} /> Ingreso</button><button type="button" className={form.type === 'Gasto' ? 'selected expense' : ''} onClick={() => setForm({ ...form, type: 'Gasto', serviceId: '' })}><ArrowUpRight size={15} /> Gasto</button></div><label>Descripción<input required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Ej. Pago de cliente" /></label><div className="form-row"><label>Moneda cobrada<select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}><option value="USD">USD - Dólar estadounidense</option><option value="CUP">CUP - Peso cubano</option></select></label><label>Monto {form.currency}<input required type="number" min="0.01" step=".01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" /></label></div><div className="form-row"><label>Fecha<input type="date" required value={form.transactionDate} onChange={e => setForm({ ...form, transactionDate: e.target.value })} /></label><label>Servicio<select value={form.serviceId} disabled={form.type === 'Gasto'} onChange={e => setForm({ ...form, serviceId: e.target.value })}><option value="">General</option>{services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label></div><label>Notas<textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Información adicional (opcional)" /></label><button className="primary-button full">{editing ? 'Actualizar movimiento' : 'Guardar movimiento'}</button></form></Modal>}
  </>;
}

function ReportsPage({ data }: { data: DashboardData | null }) {
  const yearly = (data?.yearly || []).map(item => ({ ...item, incomeUsd: Number(item.incomeUsd), expenseUsd: Number(item.expenseUsd), incomeCup: Number(item.incomeCup), expenseCup: Number(item.expenseCup) }));
  const pieUsd = data ? [{ name: 'Ingresos USD', value: Number(data.totals.incomeUsd), color: '#39c995' }, { name: 'Gastos USD', value: Number(data.totals.expenseUsd), color: '#f0a24b' }] : [];
  const pieCup = data ? [{ name: 'Ingresos CUP', value: Number(data.totals.incomeCup), color: '#2476d8' }, { name: 'Gastos CUP', value: Number(data.totals.expenseCup), color: '#9b59b6' }] : [];
  const distribution = (items: typeof pieUsd, formatter: (value: number) => string) => <div className="pie-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={items} dataKey="value" innerRadius={55} outerRadius={88} paddingAngle={4}>{items.map(item => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip formatter={(v) => formatter(v as number)} /></PieChart></ResponsiveContainer><div className="pie-center"><strong>{formatter(items[0]?.value || 0)}</strong><span>Ingresos</span></div></div>;
  const printReport = () => window.print();
  return <><div className="page-heading report-heading"><div><p className="eyebrow">ANÁLISIS</p><h1>Reportes</h1><p className="muted">Entiende el rendimiento de tu negocio con datos claros en USD y CUP.</p></div><button className="secondary-button no-print" onClick={printReport}><FileBarChart size={16} /> Imprimir / guardar PDF</button></div>{data && <section className="conversion-summary"><div><span>Ingresos convertidos a USD</span><strong>{usd(Number(data.totals.incomeUsd) + data.totals.incomeCupToUsd)}</strong><small>USD registrados + CUP equivalentes</small></div><div><span>Gastos convertidos a USD</span><strong>{usd(Number(data.totals.expenseUsd) + data.totals.expenseCupToUsd)}</strong><small>USD registrados + CUP equivalentes</small></div><div><span>Ingresos convertidos a CUP</span><strong>{cup(Number(data.totals.incomeCup) + data.totals.incomeUsdToCup)}</strong><small>CUP registrados + USD equivalentes</small></div><div><span>Gastos convertidos a CUP</span><strong>{cup(Number(data.totals.expenseCup) + data.totals.expenseUsdToCup)}</strong><small>CUP registrados + USD equivalentes</small></div></section>}<div className="reports-grid"><section className="panel chart-panel"><div className="panel-heading"><div><h3>Rendimiento anual</h3><p className="muted">Comparativa anual por moneda</p></div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={yearly}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f4" /><XAxis dataKey="year" axisLine={false} tickLine={false} /><YAxis axisLine={false} tickLine={false} /><Tooltip formatter={(v, name) => name.toString().includes('CUP') ? cup(v as number) : usd(v as number)} /><Bar dataKey="incomeUsd" fill="#39c995" radius={[5, 5, 0, 0]} name="Ingresos USD" /><Bar dataKey="expenseUsd" fill="#f0a24b" radius={[5, 5, 0, 0]} name="Gastos USD" /><Bar dataKey="incomeCup" fill="#2476d8" radius={[5, 5, 0, 0]} name="Ingresos CUP" /><Bar dataKey="expenseCup" fill="#9b59b6" radius={[5, 5, 0, 0]} name="Gastos CUP" /></BarChart></ResponsiveContainer></div></section><section className="panel chart-panel"><div className="panel-heading"><div><h3>Distribución financiera</h3><p className="muted">Ingresos vs gastos acumulados por moneda</p></div></div><div className="distribution-pies"><div><strong className="currency-heading">USD</strong>{distribution(pieUsd, usd)}<div className="legend centered">{pieUsd.map(item => <span key={item.name}><i className="dot" style={{ background: item.color }} />{item.name}</span>)}</div></div><div><strong className="currency-heading">CUP</strong>{distribution(pieCup, cup)}<div className="legend centered">{pieCup.map(item => <span key={item.name}><i className="dot" style={{ background: item.color }} />{item.name}</span>)}</div></div></div></section></div></>;
}

function ExchangeRatePage() {
  const [rate, setRate] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    api<{ exchangeRateCup: string | number }>('/auth/exchange-rate')
      .then(result => setRate(String(result.exchangeRateCup || '')))
      .catch(err => setError(err instanceof Error ? err.message : 'No se pudo cargar la tasa.'))
      .finally(() => setLoading(false));
  }, []);
  const save = async (event: FormEvent) => {
    event.preventDefault(); setMessage(''); setError(''); setSaving(true);
    try {
      const result = await api<{ exchangeRateCup: string | number; message: string }>('/auth/exchange-rate', { method: 'PATCH', body: JSON.stringify({ exchangeRateCup: rate }) });
      setRate(String(result.exchangeRateCup)); setMessage(result.message);
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo guardar la tasa.'); } finally { setSaving(false); }
  };
  return <><div className="page-heading"><div><p className="eyebrow">VALOR DE REFERENCIA</p><h1>Tasa USD / CUP</h1><p className="muted">Define el valor actual de un dólar estadounidense en pesos cubanos.</p></div></div><section className="panel exchange-panel"><div className="exchange-icon"><Landmark size={24} /></div><h2>¿Cuánto vale 1 USD?</h2><p className="muted">Esta tasa queda guardada en tu cuenta para consultarla cuando registres tus operaciones.</p>{message && <div className="success-alert">{message}</div>}{error && <div className="alert">{error}</div>}<form className="exchange-form" onSubmit={save}><label>Valor actual de 1 USD en CUP<div className="rate-input"><span>1 USD =</span><input type="number" required min="0.01" step=".01" value={rate} onChange={e => setRate(e.target.value)} placeholder="Ej. 24.00" disabled={loading} /><strong>CUP</strong></div></label><button className="primary-button" disabled={loading || saving}>{saving ? 'Guardando…' : 'Guardar tasa'}</button></form></section></>;
}

function SettingsPage({ user, theme, setTheme, onAccountUpdated }: { user: User; theme: 'light' | 'dark'; setTheme: (theme: 'light' | 'dark') => void; onAccountUpdated: (token: string, user: User) => void }) {
  const [accountForm, setAccountForm] = useState({ name: user.name, email: user.email, company: user.company || '', currentPassword: '' });
  const [accountMessage, setAccountMessage] = useState('');
  const [accountError, setAccountError] = useState('');
  const [savingAccount, setSavingAccount] = useState(false);
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [message, setMessage] = useState(''); const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  const saveAccount = async (event: FormEvent) => {
    event.preventDefault(); setAccountMessage(''); setAccountError(''); setSavingAccount(true);
    try {
      const result = await api<{ token: string; user: User; message: string }>('/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify(accountForm)
      });
      onAccountUpdated(result.token, result.user);
      setAccountForm({ name: result.user.name, email: result.user.email, company: result.user.company || '', currentPassword: '' });
      setAccountMessage(result.message);
    } catch (err) {
      setAccountError(err instanceof Error ? err.message : 'No se pudo actualizar la información de la cuenta.');
    } finally {
      setSavingAccount(false);
    }
  };
  const savePassword = async (event: FormEvent) => {
    event.preventDefault(); setMessage(''); setError('');
    if (form.newPassword !== form.confirmPassword) { setError('Las nuevas contraseñas no coinciden.'); return; }
    setSaving(true);
    try {
      const result = await api<{ message: string }>('/auth/password', { method: 'PATCH', body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }) });
      setMessage(result.message); setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo actualizar la contraseña.'); } finally { setSaving(false); }
  };
  return <><div className="page-heading"><div><p className="eyebrow">PREFERENCIAS</p><h1>Configuración</h1><p className="muted">Administra los datos de tu cuenta y empresa.</p></div></div><div className="settings-grid"><section className="panel settings-panel"><div className="settings-title"><div className="large-avatar">{user.name.slice(0, 1).toUpperCase()}</div><div><h3>Perfil de administrador</h3><p className="muted">Información personal de tu cuenta</p></div></div>{accountMessage && <div className="success-alert" role="status">{accountMessage}</div>}{accountError && <div className="alert" role="alert">{accountError}</div>}<form className="settings-form password-form" onSubmit={saveAccount}><label>Nombre completo<input required minLength={2} maxLength={120} value={accountForm.name} onChange={e => setAccountForm({ ...accountForm, name: e.target.value })} /></label><label>Correo electrónico<input type="email" required value={accountForm.email} onChange={e => setAccountForm({ ...accountForm, email: e.target.value })} /></label><label>Empresa<input maxLength={180} value={accountForm.company} onChange={e => setAccountForm({ ...accountForm, company: e.target.value })} /></label><label>Contraseña actual para confirmar<input type="password" required value={accountForm.currentPassword} onChange={e => setAccountForm({ ...accountForm, currentPassword: e.target.value })} autoComplete="current-password" /></label><button className="primary-button" disabled={savingAccount}>{savingAccount ? 'Guardando…' : 'Confirmar cambios de cuenta'}</button></form><div className="settings-note"><ShieldCheck size={18} /><div><strong>Cuenta segura</strong><p>Para guardar cambios de perfil debes confirmar tu contraseña actual.</p></div></div></section><section className="panel settings-panel"><div className="settings-title"><div className="settings-icon"><Sun size={18} /></div><div><h3>Apariencia</h3><p className="muted">Elige cómo quieres ver la plataforma.</p></div></div><div className="theme-options"><button className={theme === 'light' ? 'theme-option selected' : 'theme-option'} onClick={() => setTheme('light')}><Sun size={17} /><span>Tema claro</span></button><button className={theme === 'dark' ? 'theme-option selected' : 'theme-option'} onClick={() => setTheme('dark')}><Moon size={17} /><span>Tema oscuro</span></button></div></section><section className="panel settings-panel"><div className="settings-title"><div className="settings-icon"><ShieldCheck size={18} /></div><div><h3>Cambiar contraseña</h3><p className="muted">Actualiza la clave de acceso a tu cuenta.</p></div></div>{message && <div className="success-alert">{message}</div>}{error && <div className="alert">{error}</div>}<form className="settings-form password-form" onSubmit={savePassword}><label>Contraseña actual<input type="password" required value={form.currentPassword} onChange={e => setForm({ ...form, currentPassword: e.target.value })} /></label><label>Nueva contraseña<input type="password" required minLength={6} value={form.newPassword} onChange={e => setForm({ ...form, newPassword: e.target.value })} placeholder="Mínimo 6 caracteres" /></label><label>Confirmar nueva contraseña<input type="password" required minLength={6} value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })} /></label><button className="primary-button" disabled={saving}>{saving ? 'Guardando…' : 'Actualizar contraseña'}</button></form></section></div></>; }
function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  const { user } = useAuth();
  const companyName = user?.company?.trim() || 'Finanzas';
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}><div className="modal"><div className="modal-header"><div><p className="eyebrow">{companyName}</p><h2>{title}</h2></div><button className="icon-button" onClick={close}><X size={18} /></button></div>{children}</div></div>;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null); const [page, setPage] = useState<Page>('Dashboard'); const [data, setData] = useState<DashboardData | null>(null); const [services, setServices] = useState<Service[]>([]); const [transactions, setTransactions] = useState<Transaction[]>([]); const [loading, setLoading] = useState(true);
  const [theme, setThemeState] = useState<'light' | 'dark'>(() => localStorage.getItem('horizon_theme') === 'dark' ? 'dark' : 'light');
  const setTheme = (nextTheme: 'light' | 'dark') => { setThemeState(nextTheme); localStorage.setItem('horizon_theme', nextTheme); };
  useEffect(() => { const saved = localStorage.getItem('horizon_user'); const token = localStorage.getItem('horizon_token'); if (saved && token) setUser(JSON.parse(saved)); else setLoading(false); }, []);
  const load = async () => { if (!user) return; setLoading(true); try { const [dashboard, serviceData, transactionData] = await Promise.all([api<DashboardData>('/dashboard'), api<{ services: Service[] }>('/services'), api<{ transactions: Transaction[] }>('/transactions')]); setData(dashboard); setServices(serviceData.services); setTransactions(transactionData.transactions); } catch { localStorage.removeItem('horizon_token'); localStorage.removeItem('horizon_user'); setUser(null); } finally { setLoading(false); } };
  useEffect(() => { load(); }, [user]); // Carga los datos protegidos cada vez que cambia la sesión.
  const login = (token: string, nextUser: User) => { localStorage.setItem('horizon_token', token); localStorage.setItem('horizon_user', JSON.stringify(nextUser)); setUser(nextUser); };
  const logout = () => { localStorage.removeItem('horizon_token'); localStorage.removeItem('horizon_user'); setUser(null); setData(null); };
  const content = useMemo(() => {
    if (page === 'Dashboard') return <Dashboard data={data} loading={loading} onAddMovement={() => setPage('Movimientos')} />;
    if (page === 'Servicios') return <ServicesPage services={services} reload={load} />;
    if (page === 'Movimientos') return <TransactionsPage transactions={transactions} services={services} reload={load} />;
    if (page === 'Reportes') return <ReportsPage data={data} />;
    if (page === 'TipoCambio') return <ExchangeRatePage />;
    return <SettingsPage user={user!} theme={theme} setTheme={setTheme} onAccountUpdated={login} />;
  }, [page, data, loading, services, transactions, user, theme]);
  if (!user) return <AuthPage onAuth={login} />;
  return <AuthContext.Provider value={{ user, login, logout }}><div className={`theme-${theme}`}><Layout user={user} page={page} setPage={setPage} onLogout={logout}>{content}</Layout></div></AuthContext.Provider>;
}
