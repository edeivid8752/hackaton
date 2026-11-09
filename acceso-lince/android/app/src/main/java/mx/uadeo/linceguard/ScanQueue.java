package mx.uadeo.linceguard;

import java.util.ArrayDeque;
import java.util.Locale;

/** Fila acotada: no repetir un código mientras se espera respuesta del servidor. */
public final class ScanQueue {
    private final int maxWaiting;
    private final ArrayDeque<String> waiting = new ArrayDeque<>();
    private String current;

    public ScanQueue(int maxWaiting) {
        if (maxWaiting < 1) throw new IllegalArgumentException("maxWaiting debe ser positivo");
        this.maxWaiting = maxWaiting;
    }

    /** Regresa un codigo que se debe enviar ya, o null si ya esta en curso/en espera. */
    public synchronized String offer(String raw) {
        if (raw == null || raw.trim().isEmpty()) return null;
        String code = raw.trim().toUpperCase(Locale.ROOT);
        if (current == null) { current=code; return code; }
        if (current.equals(code) || waiting.contains(code) || waiting.size()>=maxWaiting) return null;
        waiting.addLast(code);
        return null;
    }

    /** Marca la respuesta de red como recibida, inicia el siguiente escaneo pendiente. */
    public synchronized String complete() {
        current=waiting.pollFirst();
        return current;
    }

    public synchronized int pendingCount() { return waiting.size(); }
    public synchronized boolean isFull() { return waiting.size()>=maxWaiting; }
    public synchronized void clear() { current=null; waiting.clear(); }
}
