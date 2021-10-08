package me.goddragon.teaseai.gui.http;

import me.goddragon.teaseai.api.chat.ChatHandler;
import org.eclipse.jetty.http.HttpVersion;
import org.eclipse.jetty.security.ConstraintMapping;
import org.eclipse.jetty.security.ConstraintSecurityHandler;
import org.eclipse.jetty.security.HashLoginService;
import org.eclipse.jetty.security.UserStore;
import org.eclipse.jetty.security.authentication.BasicAuthenticator;
import org.eclipse.jetty.server.*;
import org.eclipse.jetty.servlet.DefaultServlet;
import org.eclipse.jetty.servlet.ServletContextHandler;
import org.eclipse.jetty.servlet.ServletHolder;
import org.eclipse.jetty.util.security.Constraint;
import org.eclipse.jetty.util.security.Password;
import org.eclipse.jetty.util.ssl.SslContextFactory;
import org.eclipse.jetty.websocket.server.NativeWebSocketServletContainerInitializer;
import org.eclipse.jetty.websocket.server.WebSocketUpgradeFilter;

import javax.servlet.ServletException;
import java.io.File;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URL;
//import org.eclipse.jetty.websocket.server.WebSocketUpgradeFilter;

/**
 * This provides the interface to the Jetty server and the various methods to
 * send information to the connected browser.
 */
public class HttpServer {
    private final Server server;

    public HttpServer(int port) {
        server = new Server();

        HashLoginService loginService = new HashLoginService("TeaseAI");

        UserStore userStore = new UserStore();
        userStore.addUser(ChatHandler.getHandler().getSubParticipant().getName(),
                new Password(ChatHandler.getHandler().getMainDomParticipant().getName()), new String[] { "user" });

        loginService.setUserStore(userStore);

        try {
            loginService.start();
        } catch (Exception e) {
            e.printStackTrace();
            return;
        }

        //server.addBean(loginService);

        final SslContextFactory sslContextFactory = new SslContextFactory.Server();
        File keyStore = new File("TeaseAI-keystore.jks");
        if (!keyStore.exists()) {
            try {
                SelfSignedCertificate.createCertificate(keyStore);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
        sslContextFactory.setKeyStorePath(keyStore.getPath());
        sslContextFactory.setKeyStorePassword("secret-taj");
        final HttpConfiguration httpsConfiguration = new HttpConfiguration();
        httpsConfiguration.addCustomizer(new SecureRequestCustomizer());
        final ServerConnector httpsConnector = new ServerConnector(server,
                new SslConnectionFactory(sslContextFactory, HttpVersion.HTTP_1_1.asString()),
                new HttpConnectionFactory(httpsConfiguration));
        httpsConnector.setPort(port);
        server.addConnector(httpsConnector);

        // Setup the basic application "context" for this application at "/"
        // This is also known as the handler tree (in jetty speak)
        ServletContextHandler context = new ServletContextHandler(ServletContextHandler.SESSIONS|ServletContextHandler.SECURITY);
        context.setContextPath("/");
        context.setWelcomeFiles(new String[] { "index.html" });

        final Constraint constraint = new Constraint();
        constraint.setName(Constraint.__BASIC_AUTH);
        constraint.setRoles(new String[]{"user"});
        constraint.setAuthenticate(true);

        final ConstraintMapping constraintMapping = new ConstraintMapping();
        constraintMapping.setConstraint(constraint);
        constraintMapping.setPathSpec("/*");

        final ConstraintSecurityHandler securityHandler = new ConstraintSecurityHandler();
        securityHandler.addConstraintMapping(constraintMapping);
        securityHandler.setAuthenticator(new BasicAuthenticator());
        securityHandler.setLoginService(loginService);
        securityHandler.setRealmName("TeaseAI");

        context.setSecurityHandler(securityHandler);

        server.setHandler(context);

        // Configure specific websocket behavior
        NativeWebSocketServletContainerInitializer.configure(context, (servletContext, nativeWebSocketConfiguration) ->
        {
            // Configure default max size
            nativeWebSocketConfiguration.getPolicy().setMaxTextMessageBufferSize(2 * 1000 * 1000);
            nativeWebSocketConfiguration.getPolicy().setMaxTextMessageSize(16 * 1000 * 1000);
            nativeWebSocketConfiguration.getPolicy().setIdleTimeout(1000 * 1800);

            // Add websockets
            nativeWebSocketConfiguration.addMapping("/socket", EventSocket.class);
        });

        try {
            WebSocketUpgradeFilter.configure(context);
        } catch (ServletException e) {
            e.printStackTrace();
        }

        context.addServlet(MediaServlet.class, "/m/*");

        ServletHolder holderPwd = new ServletHolder("default", DefaultServlet.class);
        holderPwd.setInitParameter("dirAllowed", "true");
        File html = new File("html");
        if (html.isDirectory()) {
            holderPwd.setInitParameter("resourceBase", html.getPath());
        } else {
            URL url = HttpServer.class.getClassLoader().getResource("html/");

            URI webRootUri = null;
            try {
                webRootUri = url.toURI();
            } catch (URISyntaxException e) {
                e.printStackTrace();
            }
            holderPwd.setInitParameter("resourceBase", webRootUri.toString());
        }
        context.addServlet(holderPwd, "/");

        try {
			server.start();
		} catch (Exception e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
			throw new RuntimeException(e);
		}
	}


}
