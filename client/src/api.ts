const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export type User = { id: number; name: string; email: string; company: string };
export type Service = { id: number; name: string; description: string; category: string; costUsd: string | number; costCup: string | number; status: string; createdAt?: string };
export type Transaction = { id: number; type: 'Ingreso' | 'Gasto'; description: string; amountUsd: string | number; amountCup: string | number; transactionDate: string; notes?: string; serviceId?: number | null; serviceName?: string };

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('horizon_token');
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'No se pudo completar la solicitud.');
  return data;
}

export const postJson = <T,>(path: string, body: unknown) => api<T>(path, { method: 'POST', body: JSON.stringify(body) });
