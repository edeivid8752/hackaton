import mx.uadeo.linceguard.ScanGate;

public class ScanGateTest {
    static int count = 0;
    static void eq(String expected, String actual, String text) {
        if(expected==null ? actual!=null : !expected.equals(actual))
            throw new AssertionError(text + " esperado=" + expected + " recibido=" + actual);
        count++;
    }
    public static void main(String[] args) {
        ScanGate gate = new ScanGate(1100L);
        eq("LIN-1001", gate.observe("lin-1001",1000L),"primera lectura");
        eq(null,gate.observe("LIN-1001",2100L),"sostenido en cámara");
        eq(null,gate.observe(null,2600L),"pérdida corta");
        eq(null,gate.observe("LIN-1001",3000L),"reaparece rápido");
        eq(null,gate.observe("LIN-1001",30000L),"sostenido durante mucho tiempo");
        eq(null,gate.observe(null,30500L),"no rearmar aún");
        eq(null,gate.observe("LIN-1001",30700L),"reaparición rápida");
        eq(null,gate.observe(null,30800L),"primer cuadro en blanco");
        eq(null,gate.observe(null,31900L),"rearmar por desaparición");
        eq("LIN-1001",gate.observe("LIN-1001",32000L),"volver a leer QR tras quitarlo");
        eq("LIN-2001",gate.observe("LIN-2001",32200L),"otra credencial nueva");
        gate.reset();
        eq("LIN-1001",gate.observe("LIN-1001",32300L),"reiniciar al pausar cámara");
        System.out.println("OK: " + count + " pruebas ScanGate Java superadas.");
    }
}
