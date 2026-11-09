package mx.uadeo.linceguard;

import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** Synchronous HTTP client: call ONLY from a dedicated worker, never main thread. */
final class ApiClient {
    static final class ApiException extends Exception {
        final int status;
        ApiException(int code,String message){super(message);status=code;}
    }
    private String baseUrl;
    private String token;
    private String cookie;
    ApiClient(String server,String deviceToken){baseUrl=server;token=deviceToken;}
    void setBaseUrl(String value){baseUrl=value;}
    void setToken(String value){token=value;}
    String getToken(){return token;}
    void clearSession(){cookie=null;}
    boolean hasSession(){return cookie!=null&&!cookie.isEmpty();}
    static boolean allowedPrivateUrl(String address){
        try{
            URI u=new URI(address);String h=u.getHost();if(h==null||u.getUserInfo()!=null||u.getFragment()!=null)return false;
            if(!"http".equals(u.getScheme())&&!"https".equals(u.getScheme()))return false;
            return h.equals("localhost")||h.equals("127.0.0.1")||h.equals("10.0.2.2")
                ||h.startsWith("10.")||h.startsWith("192.168.")||h.matches("172\\.(1[6-9]|2[0-9]|3[01])\\..*");
        }catch(Exception e){return false;}
    }
    JSONObject get(String path)throws Exception{return request("GET",path,null);}
    JSONObject post(String path,JSONObject json)throws Exception{return request("POST",path,json);}
    JSONObject request(String method,String route,JSONObject body)throws Exception{
        if(!allowedPrivateUrl(baseUrl))throw new ApiException(0,"Servidor inválido. Usa la IP local de la laptop.");
        HttpURLConnection c=(HttpURLConnection)new URL(baseUrl+route).openConnection();
        try{
            c.setRequestMethod(method);c.setConnectTimeout(5500);c.setReadTimeout(16000);
            c.setRequestProperty("Accept","application/json");
            if(token!=null)c.setRequestProperty("X-Lince-Device-Token",token);
            if(cookie!=null)c.setRequestProperty("Cookie",cookie);
            if(body!=null){
                c.setDoOutput(true);c.setRequestProperty("Content-Type","application/json; charset=utf-8");
                try(OutputStream o=c.getOutputStream()){o.write(body.toString().getBytes(StandardCharsets.UTF_8));}
            }
            int status=c.getResponseCode();
            String set=c.getHeaderField("Set-Cookie");
            if(set!=null&&set.startsWith("lince_sid=")){
                String value=set.split(";",2)[0];
                cookie=value.startsWith("lince_sid=;")||value.equals("lince_sid=")?null:value;
            }
            try(InputStream stream=status<400?c.getInputStream():c.getErrorStream()){
                StringBuilder b=new StringBuilder();if(stream!=null){
                    try(BufferedReader r=new BufferedReader(new InputStreamReader(stream,StandardCharsets.UTF_8))){
                        String line;while((line=r.readLine())!=null)b.append(line);
                    }
                }
                JSONObject json=new JSONObject(b.length()==0?"{}":b.toString());
                if(status>=400){throw new ApiException(status,json.optString("reason",json.optString("error","Error HTTP "+status)));}
                return json;
            }
        }finally{c.disconnect();}
    }
}
