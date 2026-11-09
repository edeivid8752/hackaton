package mx.uadeo.linceguard;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Rect;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.graphics.pdf.PdfDocument;
import android.util.Base64;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.MultiFormatWriter;
import com.google.zxing.common.BitMatrix;
import org.json.JSONObject;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Map;

/** Generates a printable prototype badge. Not a university-issued official credential. */
final class BadgePdf {
    private static final int WINE=Color.rgb(72,29,43), GOLD=Color.rgb(223,195,151), DARK=Color.rgb(56,35,43);
    static Bitmap qr(String code,int width)throws Exception{
        Map<EncodeHintType,Object> hints=new HashMap<>();hints.put(EncodeHintType.MARGIN,1);
        BitMatrix matrix=new MultiFormatWriter().encode(code,BarcodeFormat.QR_CODE,width,width,hints);
        Bitmap result=Bitmap.createBitmap(width,width,Bitmap.Config.ARGB_8888);
        for(int y=0;y<width;y++)for(int x=0;x<width;x++)result.setPixel(x,y,matrix.get(x,y)?Color.BLACK:Color.WHITE);
        return result;
    }
    static Bitmap photo(String data){
        try{
            if(data==null||!data.startsWith("data:image/"))return null;
            int i=data.indexOf(',');if(i<0)return null;
            byte[] raw=Base64.decode(data.substring(i+1),Base64.DEFAULT);
            BitmapFactory.Options opts=new BitmapFactory.Options();opts.inSampleSize=2;
            return BitmapFactory.decodeByteArray(raw,0,raw.length,opts);
        }catch(Exception e){return null;}
    }
    private static void txt(Canvas canvas,Paint p,String text,int x,int y,int size,int color,boolean bold){
        p.setColor(color);p.setTextSize(size);p.setTypeface(bold?Typeface.create("sans-serif",Typeface.BOLD):Typeface.create("sans-serif",Typeface.NORMAL));
        canvas.drawText(text==null?"":text,x,y,p);
    }
    private static String fit(String value,int limit){if(value==null)return "";return value.length()>limit?value.substring(0,limit-1)+"…":value;}
    static void write(OutputStream stream,JSONObject profile,Bitmap logo)throws Exception{
        String code=profile.optString("code",""),name=profile.optString("name",""),id=profile.optString("institutional_id",""),role=profile.optString("staff_role","GUARDIA");
        if(code.isEmpty())throw new Exception("Esta cuenta no tiene QR activo.");
        PdfDocument doc=new PdfDocument();
        PdfDocument.Page page=doc.startPage(new PdfDocument.PageInfo.Builder(595,842,1).create());
        Canvas c=page.getCanvas();Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);
        c.drawColor(Color.WHITE);
        if(logo!=null){p.setColor(GOLD);c.drawRoundRect(new RectF(36,22,89,88),9,9,p);
            c.drawBitmap(logo,null,new Rect(42,25,83,84),p);}
        txt(c,p,"ACCESO LINCE VIGILANCIA",102,48,17,WINE,true);
        txt(c,p,"Gafete demostrativo para el personal de vigilancia.",102,70,10,DARK,false);
        p.setColor(WINE);c.drawRoundRect(new RectF(34,114,560,444),18,18,p);
        p.setColor(GOLD);c.drawRect(34,114,560,159,p);
        txt(c,p,"ACCESO LINCE · VIGILANCIA",51,144,17,WINE,true);
        txt(c,p,"IDENTIFICACIÓN DE SEGURIDAD",51,182,11,Color.WHITE,true);
        p.setColor(Color.WHITE);c.drawRoundRect(new RectF(49,204,181,363),10,10,p);
        Bitmap portrait=photo(profile.optString("photo_data",""));
        if(portrait!=null){c.drawBitmap(portrait,null,new Rect(54,211,176,354),p);portrait.recycle();}
        else{txt(c,p,"FOTO",87,286,22,WINE,true);}
        txt(c,p,fit(name,27),195,234,17,Color.WHITE,true);
        txt(c,p,fit(id,30),195,260,13,Color.WHITE,false);
        txt(c,p,fit(role.toUpperCase(),28),195,287,13,GOLD,true);
        txt(c,p,"PERSONAL DE VIGILANCIA · PRUEBA",195,321,10,Color.WHITE,false);
        Bitmap bitmap=qr(code,135);p.setFilterBitmap(false);c.drawBitmap(bitmap,null,new Rect(395,285,531,421),p);bitmap.recycle();
        txt(c,p,fit(code,35),52,395,11,Color.WHITE,false);
        txt(c,p,"QR para registro de acceso. No sirve por sí solo como prueba de identidad.",36,480,10,DARK,false);
        txt(c,p,"PROTOTIPO EDUCATIVO - NO ES CREDENCIAL OFICIAL UAdeO",36,505,10,WINE,true);
        doc.finishPage(page);
        try{doc.writeTo(stream);}finally{doc.close();}
    }
}
