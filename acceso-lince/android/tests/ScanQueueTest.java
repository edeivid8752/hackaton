import mx.uadeo.linceguard.ScanQueue;

public final class ScanQueueTest {
  private static int passed=0;
  static void eq(Object want, Object got, String test) {
    if(!java.util.Objects.equals(want,got))throw new AssertionError(test+" wanted="+want+" got="+got);
    passed++;
  }
  public static void main(String[] args){
    ScanQueue q=new ScanQueue(2);
    eq("LIN-1001",q.offer("lin-1001"),"envio inmediato");
    eq(null,q.offer("LIN-1001"),"no dup actual");
    eq(null,q.offer("lin-1002"),"cola codigo 2");
    eq(1,q.pendingCount(),"una espera");
    eq(null,q.offer("LIN-1002"),"no dup espera");
    eq(null,q.offer("LIN-1003"),"cola codigo 3");
    eq(true,q.isFull(),"cola llena");
    eq(null,q.offer("LIN-1004"),"rechaza excedente");
    eq("LIN-1002",q.complete(),"siguiente 2");
    eq("LIN-1003",q.complete(),"siguiente 3");
    eq(null,q.complete(),"sin pendiente");
    eq("VIS-1234",q.offer("vis-1234"),"volvio libre");
    q.clear();
    eq(0,q.pendingCount(),"cola limpiada");
    eq("LIN-1001",q.offer("LIN-1001"),"admite nuevo tras limpiar");
    System.out.println("OK: "+passed+" pruebas ScanQueue Java superadas.");
  }
}
