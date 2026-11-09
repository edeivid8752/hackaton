package mx.uadeo.linceguard;

import java.util.Locale;

/** Evita que un código QR mantenido frente a la cámara cambie entrada/salida. */
public final class ScanGate {
    private final long releaseAfterMs;
    private String held = null;
    private long lastSeenMs = 0L;

    public ScanGate(long releaseAfterMs) {
        if (releaseAfterMs <= 0) throw new IllegalArgumentException("releaseAfterMs debe ser positivo");
        this.releaseAfterMs = releaseAfterMs;
    }

    /** Devuelve un código únicamente en la primera lectura de su presentación. */
    public synchronized String observe(String rawCode, long monotonicNowMs) {
        if (rawCode == null || rawCode.trim().isEmpty()) {
            if (held != null && monotonicNowMs - lastSeenMs >= releaseAfterMs) held = null;
            return null;
        }
        String code = rawCode.trim().toUpperCase(Locale.ROOT);
        if (code.equals(held)) {
            lastSeenMs = monotonicNowMs;
            return null;
        }
        held = code;
        lastSeenMs = monotonicNowMs;
        return code;
    }

    public synchronized void reset() {
        held = null;
        lastSeenMs = 0L;
    }
}
