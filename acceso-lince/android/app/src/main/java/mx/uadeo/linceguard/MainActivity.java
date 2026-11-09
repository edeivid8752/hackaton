package mx.uadeo.linceguard;

import android.Manifest;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.net.Uri;
import android.os.Bundle;
import android.os.SystemClock;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.DocumentsContract;
import android.speech.tts.TextToSpeech;
import android.text.InputType;
import android.util.Base64;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.CheckBox;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.ImageAnalysis;
import androidx.camera.core.ImageCapture;
import androidx.camera.core.ImageCaptureException;
import androidx.camera.core.Preview;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.view.PreviewView;
import androidx.core.content.ContextCompat;

import com.google.common.util.concurrent.ListenableFuture;
import com.google.mlkit.vision.barcode.common.Barcode;
import com.google.mlkit.vision.barcode.BarcodeScanner;
import com.google.mlkit.vision.barcode.BarcodeScannerOptions;
import com.google.mlkit.vision.barcode.BarcodeScanning;
import com.google.mlkit.vision.common.InputImage;

import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** ACCESO LINCE VIGILANCIA 0.5: aplicación nativa, varias puertas y guardias; QR de gafete sin PIN.
 *  Prototipo local para pruebas ficticias. La foto de un gafete puede ser copiada. */
public final class MainActivity extends AppCompatActivity implements TextToSpeech.OnInitListener {
    // Paleta institucional predeterminada copiada de appearance-themes.css de ACCESO LINCE.
    private static final int WINE=0xFF702C43, DEEP=0xFF351520, GOLD=0xFFDFC397, CREAM=0xFF481D2B;
    private static final int GREEN=0xFF16794D, RED=0xFFAF3046, MUTED=0xFF62444A;
    private static final int INK=0xFF38232B, LIGHT=0xFFF0DEB8, CONTROL=0xFFEAD1A5;
    private static final int CAMERA_REQUEST=140, EXPORT_BADGE=514;
    private enum Mode {PAIR,SIGNIN,SCAN,EXPRESS,SHIFTS,PROFILE}
    private final ExecutorService cameraThread=Executors.newSingleThreadExecutor();
    private final ExecutorService networkThread=Executors.newSingleThreadExecutor();
    private final ScanGate gate=new ScanGate(1100L);
    private final ScanQueue scanQueue=new ScanQueue(4);
    private SecureDeviceStore secure;
    private ApiClient api;
    private BarcodeScanner scanner;
    private TextToSpeech tts;
    private ToneGenerator tones;
    private ScrollView scroll;
    private LinearLayout root;
    private PreviewView cameraView;
    private ProcessCameraProvider cameraProvider;
    private ImageCapture imageCapture;
    private TextView statusText,summaryText,statsText,expressHelp;
    private EditText serverInput,pairInput,manualInput;
    private ImageView capturedPreview;
    private CheckBox documentConfirmed,noticeConfirmed;
    private Button submitPhotoButton;
    private String expressKind="visitante",expressData=null,expressRequest=null,guardLogin="";
    private JSONObject profile;
    private Mode mode=Mode.PAIR;
    private boolean authenticated=false,cameraRunning=false,loginPending=false,ttsReady=false,photoSending=false;
    private long lastStatsAt=0;

    @Override public void onCreate(Bundle state){
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        secure=new SecureDeviceStore(this);
        api=new ApiClient(secure.server(),secure.deviceToken());
        BarcodeScannerOptions options=new BarcodeScannerOptions.Builder().setBarcodeFormats(
            Barcode.FORMAT_QR_CODE,Barcode.FORMAT_CODE_128,Barcode.FORMAT_CODE_39,
            Barcode.FORMAT_EAN_13,Barcode.FORMAT_PDF417,Barcode.FORMAT_AZTEC).build();
        scanner=BarcodeScanning.getClient(options);
        tones=new ToneGenerator(AudioManager.STREAM_NOTIFICATION,75);
        tts=new TextToSpeech(this,this);
        scroll=new ScrollView(this);scroll.setFillViewport(true);scroll.setBackground(new GradientDrawable(GradientDrawable.Orientation.TL_BR,new int[]{CREAM,0xFF592438,DEEP}));
        root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(15),dp(15),dp(15),dp(28));scroll.addView(root);
        setContentView(scroll);
        go(api.getToken()==null?Mode.PAIR:Mode.SIGNIN);
    }
    @Override public void onInit(int status){if(status==TextToSpeech.SUCCESS&&tts!=null)
        ttsReady=tts.setLanguage(new Locale("es","MX"))>=TextToSpeech.LANG_AVAILABLE;}
    private int dp(float n){return (int)(n*getResources().getDisplayMetrics().density+0.5f);}
    private GradientDrawable rounded(int bg,int stroke){
        GradientDrawable d=new GradientDrawable();d.setColor(bg);d.setCornerRadius(dp(15));
        if(stroke!=0)d.setStroke(dp(1),stroke);return d;
    }
    private TextView text(String message,int size,int color,boolean bold){
        TextView t=new TextView(this);t.setText(message);t.setTextColor(color);t.setTextSize(size);
        if(bold)t.setTypeface(Typeface.DEFAULT,Typeface.BOLD);return t;
    }
    private void add(LinearLayout l,View v){LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.bottomMargin=dp(11);l.addView(v,p);}
    private void addToRow(LinearLayout l,View v,float weight){
        LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(0,-2,weight);p.setMargins(dp(3),0,dp(3),0);l.addView(v,p);
    }
    private LinearLayout column(){LinearLayout v=new LinearLayout(this);v.setOrientation(LinearLayout.VERTICAL);return v;}
    private LinearLayout row(){LinearLayout v=new LinearLayout(this);v.setOrientation(LinearLayout.HORIZONTAL);v.setGravity(Gravity.CENTER_VERTICAL);return v;}
    private LinearLayout card(){
        LinearLayout c=column();c.setPadding(dp(17),dp(18),dp(17),dp(15));
        GradientDrawable surface=new GradientDrawable(GradientDrawable.Orientation.TL_BR,new int[]{0xFFEFD9AF,GOLD,0xFFD9B780});
        surface.setCornerRadius(dp(18));surface.setStroke(dp(1),0xFFC69D68);
        c.setBackground(surface);c.setElevation(dp(4));return c;
    }
    private Button btn(String label,int bg){
        Button b=new Button(this);b.setAllCaps(false);b.setText(label);b.setTextColor(bg==GOLD?DEEP:Color.WHITE);
        b.setTextSize(14);b.setTypeface(Typeface.DEFAULT,Typeface.BOLD);b.setMinHeight(dp(52));b.setBackground(rounded(bg,0));return b;
    }
    private EditText input(String hint,String initial){
        EditText e=new EditText(this);e.setTextSize(16);e.setSingleLine(true);e.setHint(hint);e.setText(initial);
        e.setPadding(dp(13),dp(13),dp(13),dp(13));e.setTextColor(INK);e.setHintTextColor(0xFF816652);e.setBackground(rounded(0xFFFFF8E9,0xFFAA876B));return e;
    }
    private void title(LinearLayout parent,String caption){add(parent,text(caption,18,WINE,true));}
    private void message(String msg){Toast.makeText(this,msg,Toast.LENGTH_LONG).show();}
    private void header(){
        LinearLayout box=row();box.setPadding(dp(10),dp(11),dp(11),dp(11));
        box.setBackground(rounded(DEEP,0xFF8B5461));
        ImageView logo=new ImageView(this);logo.setImageResource(R.drawable.logotipo_uadeo);
        logo.setScaleType(ImageView.ScaleType.FIT_CENTER);logo.setPadding(dp(8),dp(6),dp(8),dp(6));
        logo.setBackground(rounded(GOLD,0));
        LinearLayout.LayoutParams logoParams=new LinearLayout.LayoutParams(dp(75),dp(82));
        logoParams.setMargins(0,0,dp(12),0);box.addView(logo,logoParams);
        LinearLayout words=column();
        add(words,text("ACCESO LINCE",21,LIGHT,true));
        add(words,text("VIGILANCIA",17,GOLD,true));
        add(words,text("Plataforma institucional",11,0xFFDFC7BA,false));
        box.addView(words,new LinearLayout.LayoutParams(0,-2,1));
        add(root,box);
        TextView caption=text(authenticated?"Vigilante: "+guardLogin+" · sesión activa":"Control de acceso · dispositivo institucional",12,LIGHT,false);
        add(root,caption);
    }
    private void tabs(){
        String[] labels={"ESCÁNER","VISITANTES Y PROVEEDORES","MIS TURNOS","MI GAFETE"};
        Mode[] modes={Mode.SCAN,Mode.EXPRESS,Mode.SHIFTS,Mode.PROFILE};
        for(int j=0;j<2;j++){
            LinearLayout r=row();
            for(int k=0;k<2;k++){
                int i=j*2+k;final Mode target=modes[i];
                Button b=btn(labels[i],mode==target?GOLD:WINE);
                b.setTextSize(11);b.setTextColor(mode==target?INK:Color.WHITE);
                b.setOnClickListener(v->go(target));addToRow(r,b,1);
            }
            add(root,r);
        }
        Button logout=btn("CERRAR SESIÓN · CAMBIAR VIGILANTE",DEEP);
        logout.setOnClickListener(v->logout());add(root,logout);
    }
    private void go(Mode next){
        stopCamera();gate.reset();scanQueue.clear();loginPending=false;
        mode=next;statusText=null;summaryText=null;statsText=null;cameraView=null;imageCapture=null;
        root.removeAllViews();header();
        if(authenticated&&next!=Mode.PAIR&&next!=Mode.SIGNIN)tabs();
        switch(next){
            case PAIR:renderPair();break;
            case SIGNIN:renderSignIn();break;
            case SCAN:renderScan();break;
            case EXPRESS:renderExpress();break;
            case SHIFTS:renderShifts();break;
            case PROFILE:renderProfile();break;
        }
        scroll.post(()->scroll.smoothScrollTo(0,0));
        if(needsCamera())scroll.post(this::beginCamera);
    }
    private boolean needsCamera(){return mode==Mode.SIGNIN||mode==Mode.SCAN||mode==Mode.EXPRESS;}
    private void renderPair(){
        LinearLayout c=card();title(c,"1 · Autorizar este dispositivo");
        add(c,text("Dirección o Administración debe abrir «Dispositivos Android» en ACCESO LINCE, crear un código de vinculación y proporcionarlo aquí.",14,MUTED,false));
        add(c,text("SERVIDOR DE LA LAPTOP",12,WINE,true));
        serverInput=input("http://192.168.137.1:3000",secure.server());add(c,serverInput);
        add(c,text("CÓDIGO DE VINCULACIÓN (16 CARACTERES)",12,WINE,true));
        pairInput=input("Ej. A1B2C3D4E5F60708","");
        pairInput.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS);
        add(c,pairInput);
        Button b=btn("VINCULAR ANDROID",WINE);add(c,b);
        b.setOnClickListener(v->pairDevice(b));
        add(c,text("El código vence a los 10 minutos. El dispositivo permanecerá vinculado hasta que Administración lo revoque. Solo red privada y datos ficticios.",12,MUTED,false));
        add(root,c);
    }
    private void pairDevice(Button b){
        String server=serverInput.getText().toString().trim().replaceAll("/+$","");
        String code=pairInput.getText().toString().trim().toUpperCase(Locale.ROOT);
        if(!ApiClient.allowedPrivateUrl(server)){message("Escribe la IP local correcta de la laptop.");return;}
        if(!code.matches("[A-F0-9]{16}")){message("El código debe tener 16 caracteres hexadecimales.");return;}
        api.setBaseUrl(server);b.setEnabled(false);b.setText("VINCULANDO...");
        networkThread.execute(()->{
            try{
                JSONObject result=api.post("/api/devices/enroll",new JSONObject().put("pair_code",code));
                String token=result.getString("device_token");
                secure.saveDeviceToken(token);secure.saveServer(server);api.setToken(token);
                runOnUiThread(()->{message("Equipo vinculado. ¡Escanea el gafete de un vigilante!");go(Mode.SIGNIN);});
            }catch(Exception e){runOnUiThread(()->message("Vinculación: "+e.getMessage()));}
            finally{runOnUiThread(()->{b.setEnabled(true);b.setText("VINCULAR ANDROID");});}
        });
    }
    private void cameraFrame(LinearLayout panel,String heading){
        add(panel,text(heading,15,WINE,true));
        statusText=text("Preparando cámara…",13,MUTED,true);statusText.setGravity(Gravity.CENTER);add(panel,statusText);
        cameraView=new PreviewView(this);cameraView.setImplementationMode(PreviewView.ImplementationMode.COMPATIBLE);
        cameraView.setScaleType(PreviewView.ScaleType.FILL_CENTER);cameraView.setBackground(rounded(DEEP,0));
        LinearLayout.LayoutParams viewLp=new LinearLayout.LayoutParams(-1,dp(295));viewLp.bottomMargin=dp(12);
        panel.addView(cameraView,viewLp);
    }
    private void renderSignIn(){
        LinearLayout c=card();title(c,"Ingresar con mi gafete QR");
        add(c,text("Acerca tu gafete de VIGILANTE a la cámara. No hay PIN ni usuario que escribir. Solamente se aceptan vigilantes activos y este Android debe estar vinculado.",14,MUTED,false));
        cameraFrame(c,"ENFOCA TU GAFETE");
        summaryText=text("Esperando gafete de vigilante…",15,WINE,true);summaryText.setGravity(Gravity.CENTER);add(c,summaryText);
        Button pair=btn("CAMBIAR VINCULACIÓN DEL ANDROID",DEEP);add(c,pair);
        pair.setOnClickListener(v->new AlertDialog.Builder(this).setTitle("¿Eliminar autorización local?")
            .setMessage("Solo si se revocó o reemplazó este teléfono. Necesitarás otro código de Administración.")
            .setNegativeButton("Cancelar",(d,w)->{})
            .setPositiveButton("Reconfigurar",(d,w)->{secure.clearDeviceToken();api.setToken(null);api.clearSession();go(Mode.PAIR);}).show());
        add(root,c);
    }
    private void renderScan(){
        LinearLayout c=card();title(c,"Control de entradas y salidas");
        add(c,text("Apunta a un QR de alumno, personal, visitante o guardia. La cámara no se cierra entre lecturas.",14,MUTED,false));
        cameraFrame(c,"● ESCÁNER LISTO");
        summaryText=text("SIN MOVIMIENTOS · CÁMARA PREPARADA",18,WINE,true);summaryText.setGravity(Gravity.CENTER);add(c,summaryText);
        statsText=text("AFORO: consultando…",15,WINE,true);statsText.setGravity(Gravity.CENTER);add(c,statsText);
        add(c,text("RESPALDO · CÓDIGO MANUAL",12,WINE,true));
        LinearLayout row=row();manualInput=input("Ej. LIN-1001","");
        manualInput.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_FLAG_CAP_CHARACTERS);
        addToRow(row,manualInput,2.2f);Button send=btn("VALIDAR",GOLD);addToRow(row,send,1);add(c,row);
        send.setOnClickListener(v->{String code=manualInput.getText().toString().trim().toUpperCase(Locale.ROOT);
            if(!code.isEmpty()){manualInput.setText("");enqueueScan(code);}});
        add(root,c);refreshStats();
    }
    private void renderExpress(){
        expressKind="visitante";expressData=null;expressRequest=null;
        LinearLayout c=card();title(c,"Ingreso exprés · Visitantes y proveedores");
        add(c,text("Para pruebas utiliza documentos FICTICIOS. Revisa el documento original y solicita permiso para fotografiarlo. La aplicación no verifica automáticamente su autenticidad.",13,MUTED,false));
        LinearLayout kinds=row();Button visitor=btn("VISITANTE · INE",WINE),supplier=btn("PROVEEDOR · GAFETE",DEEP);
        visitor.setTextSize(12);supplier.setTextSize(12);addToRow(kinds,visitor,1);addToRow(kinds,supplier,1);add(c,kinds);
        expressHelp=text("Fotografía una INE de prueba. No guardes documentos reales sin autorización institucional.",13,WINE,true);add(c,expressHelp);
        visitor.setOnClickListener(v->{expressKind="visitante";visitor.setBackground(rounded(WINE,0));supplier.setBackground(rounded(DEEP,0));clearExpressPhoto();expressHelp.setText("Fotografía una INE de prueba.");});
        supplier.setOnClickListener(v->{expressKind="proveedor";supplier.setBackground(rounded(WINE,0));visitor.setBackground(rounded(DEEP,0));clearExpressPhoto();expressHelp.setText("Fotografía el gafete de un proveedor de prueba.");});
        cameraFrame(c,"CÁMARA · CAPTURA FOTOGRÁFICA");
        Button photo=btn("TOMAR FOTOGRAFÍA",GOLD);add(c,photo);photo.setOnClickListener(v->capturePhoto(photo));
        capturedPreview=new ImageView(this);capturedPreview.setAdjustViewBounds(true);capturedPreview.setMaxHeight(dp(190));capturedPreview.setVisibility(View.GONE);add(c,capturedPreview);
        documentConfirmed=new CheckBox(this);documentConfirmed.setText("Revisé el documento ORIGINAL antes de registrar");documentConfirmed.setTextSize(13);add(c,documentConfirmed);
        noticeConfirmed=new CheckBox(this);noticeConfirmed.setText("Informé del uso temporal de la foto y confirmé autorización");noticeConfirmed.setTextSize(13);add(c,noticeConfirmed);
        submitPhotoButton=btn("CONFIRMAR Y REGISTRAR ENTRADA",WINE);add(c,submitPhotoButton);
        submitPhotoButton.setOnClickListener(v->submitExpress());
        add(c,text("La foto se cifra en el servidor y se elimina después de 24 horas. El registro del acceso permanece. La captura por sí sola no verifica identidad ni autoriza un ingreso.",12,MUTED,false));
        add(root,c);
    }
    private void clearExpressPhoto(){expressData=null;expressRequest=null;if(capturedPreview!=null){capturedPreview.setImageDrawable(null);capturedPreview.setVisibility(View.GONE);}if(documentConfirmed!=null)documentConfirmed.setChecked(false);if(noticeConfirmed!=null)noticeConfirmed.setChecked(false);}
    private void capturePhoto(Button button){
        if(imageCapture==null){message("La cámara aún no está lista.");return;}
        button.setEnabled(false);
        try{
            File temp=File.createTempFile("lince_capture_",".jpg",getCacheDir());
            ImageCapture.OutputFileOptions opts=new ImageCapture.OutputFileOptions.Builder(temp).build();
            imageCapture.takePicture(opts,cameraThread,new ImageCapture.OnImageSavedCallback(){
                @Override public void onImageSaved(@NonNull ImageCapture.OutputFileResults output){
                    try{
                        String compressed=compressedPhoto(temp);
                        BitmapFactory.Options op=new BitmapFactory.Options();op.inSampleSize=3;
                        Bitmap image=BitmapFactory.decodeFile(temp.getAbsolutePath(),op);
                        runOnUiThread(()->{
                            expressData=compressed;expressRequest=UUID.randomUUID().toString().replace("-","");
                            capturedPreview.setImageBitmap(image);capturedPreview.setVisibility(View.VISIBLE);
                            message("Imagen lista. Confirma las dos verificaciones antes de registrar.");
                        });
                    }catch(Exception e){runOnUiThread(()->message("Foto: "+e.getMessage()));}
                    finally{temp.delete();runOnUiThread(()->button.setEnabled(true));}
                }
                @Override public void onError(@NonNull ImageCaptureException error){
                    runOnUiThread(()->{button.setEnabled(true);message("Error de cámara: "+error.getMessage());});
                    temp.delete();
                }
            });
        }catch(Exception e){button.setEnabled(true);message("No se pudo abrir cámara: "+e.getMessage());}
    }
    /** Compress in app-private cache; server accepts 2 KB to 900 KB. */
    private static String compressedPhoto(File photo)throws Exception{
        BitmapFactory.Options op=new BitmapFactory.Options();op.inJustDecodeBounds=true;BitmapFactory.decodeFile(photo.getAbsolutePath(),op);
        int max=Math.max(op.outWidth,op.outHeight),sample=1;while(max/sample>1500)sample*=2;
        op.inJustDecodeBounds=false;op.inSampleSize=sample;
        Bitmap bmp=BitmapFactory.decodeFile(photo.getAbsolutePath(),op);if(bmp==null)throw new Exception("No se pudo leer la imagen.");
        ByteArrayOutputStream out=new ByteArrayOutputStream();int quality=83;
        try{
            while(true){out.reset();bmp.compress(Bitmap.CompressFormat.JPEG,quality,out);
                if(out.size()<=850*1024||quality<=40)break;quality-=12;}
            if(out.size()<2048||out.size()>900*1024)throw new Exception("Foto demasiado grande o ilegible.");
            return "data:image/jpeg;base64,"+Base64.encodeToString(out.toByteArray(),Base64.NO_WRAP);
        }finally{bmp.recycle();out.close();}
    }
    private void submitExpress(){
        if(photoSending)return;
        if(expressData==null||expressRequest==null){message("Primero toma una fotografía.");return;}
        if(!documentConfirmed.isChecked()||!noticeConfirmed.isChecked()){message("Confirma que revisaste el documento e informaste del uso de la imagen.");return;}
        photoSending=true;submitPhotoButton.setEnabled(false);submitPhotoButton.setText("REGISTRANDO…");
        final String photo=expressData,key=expressRequest,kind=expressKind;
        networkThread.execute(()->{
            try{
                JSONObject result=api.post("/api/express-entry",new JSONObject()
                    .put("kind",kind).put("photo_type",kind.equals("visitante")?"ine":"gafete")
                    .put("photo_data",photo).put("request_id",key)
                    .put("document_checked",true).put("notice_confirmed",true));
                runOnUiThread(()->{
                    clearExpressPhoto();notifyResult(result.optBoolean("duplicate",false)?"CAPTURA REPETIDA":"ENTRADA REGISTRADA",
                        "Código: "+result.optString("code","")+"\n"+result.optString("gate",""),true);
                });
            }catch(Exception e){runOnUiThread(()->{message("Error: "+e.getMessage()+". Puedes reintentar sin duplicar esta captura.");sessionExpired(e);});}
            finally{runOnUiThread(()->{photoSending=false;if(submitPhotoButton!=null){submitPhotoButton.setEnabled(true);submitPhotoButton.setText("CONFIRMAR Y REGISTRAR ENTRADA");}});}
        });
    }
    private void renderShifts(){
        LinearLayout c=card();title(c,"Mis turnos y relevos");
        add(c,text("El acceso físico al campus NO inicia automáticamente tu servicio. Confirma tu turno desde aquí. Puedes trabajar junto con otros guardias.",13,MUTED,false));
        Button refresh=btn("ACTUALIZAR TURNOS",GOLD);add(c,refresh);
        LinearLayout list=column();add(c,list);refresh.setOnClickListener(v->loadShifts(list));
        add(root,c);loadShifts(list);
    }
    private static String clock(String iso){
        try{return DateTimeFormatter.ofPattern("dd/MM HH:mm",new Locale("es","MX"))
            .withZone(ZoneId.systemDefault()).format(Instant.parse(iso));}
        catch(Exception e){return iso==null?"—":iso;}
    }
    private void loadShifts(LinearLayout target){
        target.removeAllViews();add(target,text("Consultando turnos...",14,MUTED,false));
        networkThread.execute(()->{
            try{JSONObject data=api.get("/api/shifts/mine");runOnUiThread(()->{if(mode==Mode.SHIFTS)showShifts(target,data);});}
            catch(Exception e){runOnUiThread(()->{if(mode==Mode.SHIFTS){target.removeAllViews();add(target,text("No se pudieron consultar los turnos: "+e.getMessage(),14,RED,false));}sessionExpired(e);});}
        });
    }
    private void showShifts(LinearLayout target,JSONObject data){
        target.removeAllViews();JSONArray shifts=data.optJSONArray("shifts"),handovers=data.optJSONArray("handovers");
        if(shifts==null||shifts.length()==0){add(target,text("No tienes turnos programados. Dirección o Administración puede asignártelos desde la web.",14,MUTED,false));return;}
        for(int i=0;i<shifts.length();i++){
            JSONObject item=shifts.optJSONObject(i);if(item==null)continue;
            final long id=item.optLong("id");String state=item.optString("status","programado");
            LinearLayout piece=card();
            add(piece,text("TURNO #"+id+" · "+state.toUpperCase(Locale.ROOT),15,WINE,true));
            add(piece,text(item.optString("location","")+"\n"+clock(item.optString("starts_at"))+"  →  "+clock(item.optString("ends_at")),13,MUTED,false));
            if(state.equals("relevo_pendiente")||state.equals("programado")||state.equals("sin_cobertura")){
                Button start=btn("INICIAR SERVICIO",GREEN);add(piece,start);
                start.setOnClickListener(v->shiftAction(id,"start",new JSONObject()));
            }
            if(state.equals("en_servicio")){
                Button offer=btn("OFRECER RELEVO A OTRO VIGILANTE",WINE);add(piece,offer);offer.setOnClickListener(v->offerHandover(id));
                Button finish=btn("FINALIZAR MI TURNO",DEEP);add(piece,finish);
                finish.setOnClickListener(v->new AlertDialog.Builder(this).setTitle("¿Finalizar turno?")
                    .setMessage("Si tienes relevo pendiente, finalizar cancelará esa oferta. Comprueba que el puesto esté cubierto.")
                    .setNegativeButton("Cancelar",(d,w)->{})
                    .setPositiveButton("Finalizar",(d,w)->shiftAction(id,"finish",new JSONObject())).show());
            }
            if(handovers!=null)for(int j=0;j<handovers.length();j++){
                JSONObject h=handovers.optJSONObject(j);
                if(h!=null&&h.optLong("to_shift_id")==id&&h.isNull("accepted_at")){
                    add(piece,text("Relevo ofrecido por: "+h.optString("from_name","Vigilante saliente"),13,MUTED,true));
                    Button accept=btn("RECIBIR RELEVO",GREEN);add(piece,accept);
                    accept.setOnClickListener(v->shiftAction(id,"accept",new JSONObject()));break;
                }
            }
            add(target,piece);
        }
    }
    private void shiftAction(long id,String action,JSONObject params){
        networkThread.execute(()->{
            try{
                JSONObject response=api.post("/api/shifts/"+id+"/"+action,params);
                runOnUiThread(()->{message("Operación de turno realizada correctamente");if(mode==Mode.SHIFTS)go(Mode.SHIFTS);});
            }catch(Exception e){runOnUiThread(()->{message("Turno: "+e.getMessage());sessionExpired(e);});}
        });
    }
    private void offerHandover(long shiftId){
        networkThread.execute(()->{
            try{
                JSONObject data=api.get("/api/shifts/available-replacements?from_shift_id="+shiftId);
                JSONArray options=data.optJSONArray("candidates");
                if(options==null||options.length()==0){runOnUiThread(()->message("No hay relevos disponibles. Pide a Administración que programe el siguiente turno."));return;}
                ArrayList<String> labels=new ArrayList<>();ArrayList<Long> ids=new ArrayList<>();
                for(int i=0;i<options.length();i++){
                    JSONObject x=options.optJSONObject(i);if(x==null)continue;
                    labels.add(x.optString("guard_name","")+" · "+clock(x.optString("starts_at")));
                    ids.add(x.optLong("id"));
                }
                runOnUiThread(()->new AlertDialog.Builder(this).setTitle("Elegir vigilante entrante")
                    .setItems(labels.toArray(new String[0]),(d,which)->{
                        try{shiftAction(shiftId,"offer",new JSONObject().put("to_shift_id",ids.get(which)));}
                        catch(Exception e){message(e.getMessage());}
                    }).setNegativeButton("Cancelar",(d,w)->{}).show());
            }catch(Exception e){runOnUiThread(()->{message("Relevos: "+e.getMessage());sessionExpired(e);});}
        });
    }
    private void renderProfile(){
        LinearLayout c=card();title(c,"Mi perfil y mi gafete digital");
        add(c,text("Tu QR sirve para registrar accesos físicos. No otorga permisos de administración por sí solo.",13,MUTED,false));
        LinearLayout body=column();add(c,body);add(root,c);
        add(body,text("Consultando perfil…",14,MUTED,false));
        networkThread.execute(()->{
            try{JSONObject data=api.get("/api/profile");JSONObject p=data.optJSONObject("profile");
                runOnUiThread(()->{if(mode==Mode.PROFILE)showProfile(body,p);});}
            catch(Exception e){runOnUiThread(()->{body.removeAllViews();add(body,text("Error: "+e.getMessage(),14,RED,false));sessionExpired(e);});}
        });
    }
    private void showProfile(LinearLayout body,JSONObject p){
        body.removeAllViews();profile=p;
        if(p==null){add(body,text("La cuenta no tiene un expediente vinculado.",14,RED,false));return;}
        Bitmap face=BadgePdf.photo(p.optString("photo_data", ""));
        if(face!=null){ImageView faceView=new ImageView(this);faceView.setImageBitmap(face);
            faceView.setAdjustViewBounds(true);faceView.setMaxHeight(dp(160));add(body,faceView);}
        add(body,text(p.optString("name","Sin nombre"),20,WINE,true));
        add(body,text("Identificación: "+p.optString("institutional_id","—"),14,MUTED,false));
        add(body,text("Cargo: "+p.optString("staff_role","Vigilante"),14,MUTED,false));
        add(body,text("Estado: "+p.optString("status","—"),14,MUTED,false));
        String code=p.optString("code","");
        if(!code.isEmpty()){
            try{
                Bitmap qr=BadgePdf.qr(code,320);ImageView qrImage=new ImageView(this);qrImage.setImageBitmap(qr);
                qrImage.setAdjustViewBounds(true);qrImage.setMaxWidth(dp(210));
                qrImage.setLayoutParams(new LinearLayout.LayoutParams(-1,dp(215)));add(body,qrImage);
                TextView codeLabel=text(code,14,WINE,true);codeLabel.setGravity(Gravity.CENTER);add(body,codeLabel);
                Button download=btn("DESCARGAR GAFETE EN PDF",GOLD);add(body,download);
                download.setOnClickListener(v->downloadBadge());
            }catch(Exception e){add(body,text("No se pudo generar QR: "+e.getMessage(),13,RED,false));}
        }
    }
    private void downloadBadge(){
        if(profile==null)return;
        Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.setType("application/pdf");intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.putExtra(Intent.EXTRA_TITLE,"ACCESO_LINCE_GAFETE_"+profile.optString("institutional_id","GUARDIA")+".pdf");
        startActivityForResult(intent,EXPORT_BADGE);
    }
    @Override protected void onActivityResult(int request,int result,Intent data){
        super.onActivityResult(request,result,data);
        if(request!=EXPORT_BADGE||result!=RESULT_OK||data==null||data.getData()==null||profile==null)return;
        Uri dest=data.getData();
        try(OutputStream output=getContentResolver().openOutputStream(dest)){
            if(output==null)throw new Exception("No fue posible crear el PDF");
            BadgePdf.write(output,profile,BitmapFactory.decodeResource(getResources(),R.drawable.logotipo_uadeo));message("Gafete PDF guardado correctamente.");
        }catch(Exception e){message("No fue posible exportar gafete: "+e.getMessage());}
    }
    private void beginCamera(){
        if(!needsCamera()||cameraView==null||isFinishing())return;
        if(ContextCompat.checkSelfPermission(this,Manifest.permission.CAMERA)!=PackageManager.PERMISSION_GRANTED){
            requestPermissions(new String[]{Manifest.permission.CAMERA},CAMERA_REQUEST);return;
        }
        final Mode requested=mode;final PreviewView target=cameraView;
        ListenableFuture<ProcessCameraProvider> f=ProcessCameraProvider.getInstance(this);
        f.addListener(()->{
            if(isFinishing()||requested!=mode||target!=cameraView)return;
            try{
                cameraProvider=f.get();cameraProvider.unbindAll();
                Preview preview=new Preview.Builder().build();preview.setSurfaceProvider(target.getSurfaceProvider());
                if(mode==Mode.EXPRESS){
                    imageCapture=new ImageCapture.Builder().setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY).build();
                    cameraProvider.bindToLifecycle(this,CameraSelector.DEFAULT_BACK_CAMERA,preview,imageCapture);
                }else{
                    ImageAnalysis analysis=new ImageAnalysis.Builder()
                        .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST).build();
                    analysis.setAnalyzer(cameraThread,frame->{
                        android.media.Image original=frame.getImage();if(original==null){frame.close();return;}
                        InputImage input=InputImage.fromMediaImage(original,frame.getImageInfo().getRotationDegrees());
                        scanner.process(input).addOnSuccessListener(values->{
                            String code=null;for(Barcode b:values){String v=b.getRawValue();if(v!=null&&!v.trim().isEmpty()){code=v.trim();break;}}
                            final String found=code;runOnUiThread(()->observed(found,requested));
                        }).addOnCompleteListener(t->frame.close());
                    });
                    cameraProvider.bindToLifecycle(this,CameraSelector.DEFAULT_BACK_CAMERA,preview,analysis);
                }
                cameraRunning=true;if(statusText!=null)statusText.setText("● CÁMARA ACTIVA");
            }catch(Exception e){if(statusText!=null)statusText.setText("No se pudo abrir la cámara: "+e.getMessage());}
        },ContextCompat.getMainExecutor(this));
    }
    private void observed(String found,Mode expected){
        if(!cameraRunning||mode!=expected)return;
        String fresh=gate.observe(found,SystemClock.elapsedRealtime());if(fresh==null)return;
        if(mode==Mode.SIGNIN){if(!loginPending)loginByBadge(fresh);}
        else if(mode==Mode.SCAN&&authenticated)enqueueScan(fresh);
    }
    private void loginByBadge(String code){
        loginPending=true;if(summaryText!=null)summaryText.setText("Validando gafete de vigilante…");
        networkThread.execute(()->{
            try{
                JSONObject result=api.post("/api/guard/qr-login",new JSONObject().put("code",code));
                if(!"guardia".equals(result.optString("role")))throw new Exception("Solo se permiten guardias.");
                runOnUiThread(()->{authenticated=true;guardLogin=result.optString("login","Vigilante");
                    notifyResult("BIENVENIDO",guardLogin,true);go(Mode.SCAN);});
            }catch(Exception e){runOnUiThread(()->{if(summaryText!=null)summaryText.setText("GAFETE NO AUTORIZADO: "+e.getMessage());notifyResult("ACCESO RECHAZADO",e.getMessage(),false);});}
            finally{runOnUiThread(()->loginPending=false);}
        });
    }
    private void enqueueScan(String code){
        String next=scanQueue.offer(code);
        if(next!=null)sendScan(next);
        else if(scanQueue.isFull()&&statusText!=null)statusText.setText("● COLA LLENA · ESPERA LA VALIDACIÓN");
    }
    private void sendScan(String code){
        if(statusText!=null)statusText.setText("● VALIDANDO CREDENCIAL");
        networkThread.execute(()->{
            try{
                JSONObject r=api.post("/api/scan",new JSONObject().put("code",code));
                JSONObject p=r.optJSONObject("person");String name=p==null?"":p.optString("name","");
                String action="entrada".equals(r.optString("action"))?"ENTRADA AUTORIZADA":"SALIDA REGISTRADA";
                runOnUiThread(()->notifyResult(action,name,true));
            }catch(Exception e){runOnUiThread(()->{notifyResult(e.getMessage()!=null&&e.getMessage().toLowerCase(Locale.ROOT).contains("repetido")?"ESCANEO REPETIDO":"ACCESO DENEGADO",e.getMessage(),false);sessionExpired(e);});}
            finally{runOnUiThread(()->{
                String next=scanQueue.complete();if(next!=null&&mode==Mode.SCAN&&authenticated)sendScan(next);
                else if(statusText!=null&&mode==Mode.SCAN)statusText.setText("● CÁMARA ACTIVA · ESCANEO CONTINUO");
                refreshStats();
            });}
        });
    }
    private void refreshStats(){
        if(!authenticated||mode!=Mode.SCAN||SystemClock.elapsedRealtime()-lastStatsAt<800)return;
        lastStatsAt=SystemClock.elapsedRealtime();
        networkThread.execute(()->{
            try{JSONObject r=api.get("/api/stats");runOnUiThread(()->{if(mode==Mode.SCAN&&statsText!=null)
                statsText.setText("PERSONAS DENTRO: "+r.optInt("total",0)+" / "+r.optInt("capacity",500));});}
            catch(Exception e){runOnUiThread(()->{if(mode==Mode.SCAN&&statsText!=null)statsText.setText("Aforo no disponible · revisa Wi-Fi");sessionExpired(e);});}
        });
    }
    private void notifyResult(String title,String details,boolean positive){
        if(summaryText!=null){summaryText.setText(title+"\n"+details);summaryText.setTextColor(positive?GREEN:RED);}
        if(tones!=null)tones.startTone(positive?ToneGenerator.TONE_PROP_ACK:ToneGenerator.TONE_PROP_NACK,190);
        if(ttsReady&&tts!=null)tts.speak(title,TextToSpeech.QUEUE_FLUSH,null,"lince-v04");
        try{Vibrator v=(Vibrator)getSystemService(VIBRATOR_SERVICE);if(v!=null&&v.hasVibrator())
            v.vibrate(VibrationEffect.createOneShot(positive?90:200,VibrationEffect.DEFAULT_AMPLITUDE));}catch(Exception ignored){}
        if(summaryText==null)message(title+" · "+details);
    }
    private void sessionExpired(Exception e){
        if(e instanceof ApiClient.ApiException&&((ApiClient.ApiException)e).status==401&&authenticated){
            authenticated=false;api.clearSession();runOnUiThread(()->{message("Sesión vencida. Escanea de nuevo el gafete.");go(Mode.SIGNIN);});
        }
    }
    private void logout(){
        authenticated=false;guardLogin="";stopCamera();
        networkThread.execute(()->{try{api.post("/api/logout",new JSONObject());}catch(Exception ignored){}finally{api.clearSession();}});
        go(api.getToken()==null?Mode.PAIR:Mode.SIGNIN);
    }
    private void stopCamera(){
        cameraRunning=false;if(cameraProvider!=null)cameraProvider.unbindAll();imageCapture=null;
    }
    @Override public void onRequestPermissionsResult(int request,@NonNull String[] permissions,@NonNull int[] results){
        super.onRequestPermissionsResult(request,permissions,results);
        if(request==CAMERA_REQUEST){if(results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED)beginCamera();
            else message("Autoriza la cámara en Ajustes para escanear credenciales.");}
    }
    @Override protected void onResume(){super.onResume();if(needsCamera()&&!cameraRunning&&cameraView!=null)cameraView.post(this::beginCamera);}
    @Override protected void onPause(){stopCamera();super.onPause();}
    @Override protected void onDestroy(){stopCamera();cameraThread.shutdown();networkThread.shutdown();
        if(scanner!=null)scanner.close();if(tts!=null)tts.shutdown();if(tones!=null)tones.release();super.onDestroy();}
}
