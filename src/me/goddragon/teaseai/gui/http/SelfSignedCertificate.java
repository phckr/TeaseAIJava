package me.goddragon.teaseai.gui.http;

import org.bouncycastle.jce.X509Principal;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.bouncycastle.x509.X509V3CertificateGenerator;

import java.io.File;
import java.io.FileOutputStream;
import java.math.BigInteger;
import java.net.InetAddress;
import java.security.*;
import java.security.cert.X509Certificate;
import java.util.Date;

public class SelfSignedCertificate {
    private static final String CERTIFICATE_ALIAS = "main";
    private static final String CERTIFICATE_ALGORITHM = "RSA";
    private static final int CERTIFICATE_BITS = 1600;

    static {
        // adds the Bouncy castle provider to java security
        Security.addProvider(new BouncyCastleProvider());
    }

    @SuppressWarnings("deprecation")
    public static X509Certificate createCertificate(File keyStoreName) throws Exception{
        X509Certificate cert = null;
        KeyPairGenerator keyPairGenerator = KeyPairGenerator.getInstance(CERTIFICATE_ALGORITHM);
        keyPairGenerator.initialize(CERTIFICATE_BITS, new SecureRandom());
        KeyPair keyPair = keyPairGenerator.generateKeyPair();

        String dn = "cn=taj";
        String fqdn = InetAddress.getLocalHost().getCanonicalHostName();
        if (fqdn != null && fqdn.length() > 1) {
            dn = "cn=" + fqdn;
        }

        // GENERATE THE X509 CERTIFICATE
        X509V3CertificateGenerator v3CertGen =  new X509V3CertificateGenerator();
        v3CertGen.setSerialNumber(BigInteger.valueOf(System.currentTimeMillis()));
        v3CertGen.setIssuerDN(new X509Principal(dn));
        v3CertGen.setNotBefore(new Date(System.currentTimeMillis() - 1000L * 60 * 60 * 24));
        v3CertGen.setNotAfter(new Date(System.currentTimeMillis() + (1000L * 60 * 60 * 24 * 3678)));
        v3CertGen.setSubjectDN(new X509Principal(dn));
        v3CertGen.setPublicKey(keyPair.getPublic());
        v3CertGen.setSignatureAlgorithm("SHA256WithRSAEncryption");
        cert = v3CertGen.generateX509Certificate(keyPair.getPrivate());
        saveCert(cert, keyPair.getPrivate(), keyStoreName);
        return cert;
    }

    private static void saveCert(X509Certificate cert, PrivateKey key, File keyStoreName) throws Exception {
        KeyStore keyStore = KeyStore.getInstance("JKS");
        keyStore.load(null, null);
        keyStore.setKeyEntry(CERTIFICATE_ALIAS, key, "secret-taj".toCharArray(),  new java.security.cert.Certificate[]{cert});
        keyStore.store(new FileOutputStream(keyStoreName), "secret-taj".toCharArray() );
    }
}
