package mx.uadeo.linceguard;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Android Keystore + AES/GCM for the device credential. Never backs up private tokens. */
final class SecureDeviceStore {
    private static final String KEY="acceso_lince_guard_device_v04";
    private final SharedPreferences prefs;
    SecureDeviceStore(Context context){ prefs=context.getSharedPreferences("lince_guard_prefs",Context.MODE_PRIVATE); }
    String server(){return prefs.getString("server","http://192.168.137.1:3000");}
    void saveServer(String url){prefs.edit().putString("server",url).apply();}
    private SecretKey secret()throws Exception {
        KeyStore ks=KeyStore.getInstance("AndroidKeyStore"); ks.load(null);
        if(ks.containsAlias(KEY))return (SecretKey)ks.getKey(KEY,null);
        KeyGenerator gen=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
        gen.init(new KeyGenParameterSpec.Builder(KEY,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256).build());
        return gen.generateKey();
    }
    void saveDeviceToken(String token)throws Exception {
        if(token==null||!token.matches("dev_[a-f0-9]{64}"))throw new IllegalArgumentException("Token inválido");
        Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.ENCRYPT_MODE,secret());
        byte[] sealed=c.doFinal(token.getBytes(StandardCharsets.UTF_8));
        prefs.edit().putString("device_iv",Base64.encodeToString(c.getIV(),Base64.NO_WRAP))
            .putString("device_cipher",Base64.encodeToString(sealed,Base64.NO_WRAP)).commit();
    }
    String deviceToken(){
        String iv=prefs.getString("device_iv",null),encrypted=prefs.getString("device_cipher",null);
        if(iv==null||encrypted==null)return null;
        try{
            Cipher c=Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE,secret(),new GCMParameterSpec(128,Base64.decode(iv,Base64.NO_WRAP)));
            String result=new String(c.doFinal(Base64.decode(encrypted,Base64.NO_WRAP)),StandardCharsets.UTF_8);
            return result.matches("dev_[a-f0-9]{64}")?result:null;
        }catch(Exception e){clearDeviceToken();return null;}
    }
    void clearDeviceToken(){prefs.edit().remove("device_iv").remove("device_cipher").apply();}
}
