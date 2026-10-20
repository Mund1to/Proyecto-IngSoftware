import { Component, type ReactNode } from "react";

// Evita la pantalla en blanco: si una vista falla al renderizar se muestra un
// aviso con la opción de volver al inicio.
export default class ErrorBoundary extends Component<{ children: ReactNode; onReset: () => void }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("Screen crashed:", error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="min-h-screen flex items-center justify-center bg-[var(--bg)] p-6">
        <div className="bg-white rounded-[8px] border border-[var(--border)] shadow-sm p-8 max-w-md text-center" role="alert">
          <h1 className="text-lg font-bold text-[var(--primary-dark)] mb-2">Algo salió mal al mostrar esta pantalla</h1>
          <p className="text-sm text-[var(--muted)] mb-6">Puedes volver al inicio e intentarlo de nuevo.</p>
          <button className="button primary" onClick={() => { this.setState({ error: null }); this.props.onReset(); }}>
            Volver al inicio
          </button>
        </div>
      </main>
    );
  }
}
