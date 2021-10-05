package me.goddragon.teaseai.gui.http;

import javafx.scene.paint.Color;
import me.goddragon.teaseai.TeaseAI;
import me.goddragon.teaseai.api.chat.ChatHandler;
import me.goddragon.teaseai.api.chat.ChatParticipant;
import me.goddragon.teaseai.api.scripts.ScriptHandler;
import me.goddragon.teaseai.gui.main.MainGuiController;
import me.goddragon.teaseai.utils.TeaseLogger;
import org.eclipse.jetty.websocket.api.Session;
import org.eclipse.jetty.websocket.api.WebSocketAdapter;

import javax.script.Invocable;
import javax.script.ScriptEngine;
import javax.script.ScriptException;
import java.io.File;
import java.io.IOException;
import java.util.function.BiConsumer;
import java.util.function.Consumer;
import java.util.logging.Level;

public class EventSocket extends WebSocketAdapter {

    static private BiConsumer<String, Boolean> onMessageCallback;

    synchronized private void sendText(String prefix, String message) throws IOException {
        getRemote().sendString(String.format("%s%s", prefix, message));
    }

    public void sendText(String message) throws IOException {
        sendText("*", message);
    }

    public void sendTempText(String message) throws IOException {
        sendText("T", message);
    }

    synchronized public void displayMedia(String filename, String area) throws IOException {
        String uri = MediaServlet.getUrlFor(filename);
        getRemote().sendString('D' + area + ':' + uri);
    }

    synchronized private void sendStartStop() {
        try {
            if (TeaseAI.application.getSession().isStarted()) {
                getRemote().sendString("S");
            } else {
                getRemote().sendString("s");
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    @Override
    public void onWebSocketConnect(Session sess)
    {
        super.onWebSocketConnect(sess);
        System.out.println("Socket Connected: " + sess);
        TeaseAI.getApplication().registerWebsocket(this);

        sendStartStop();
        ChatParticipant domParticipant = ChatHandler.getHandler().getMainDomParticipant();

        File domImage = domParticipant.getContact().getImage();
        if (domImage != null && domImage.exists()) {
            try {
                displayMedia(domImage.getPath(), "dom");
            } catch (IOException e) {
                e.printStackTrace();
            }
        }

    }

    @Override
    public void onWebSocketText(String message)
    {
        super.onWebSocketText(message);
        //System.out.println("Received TEXT message: " + message);

        TeaseAI.application.runOnUIThread(new Runnable() {
            @Override
            public void run() {
                try {
                    if (message.startsWith("*")) {
                        // Treat as typed input
                        if (onMessageCallback != null) {
                            onMessageCallback.accept(message.substring(1), true);
                        }
                    }
                    if (message.startsWith("S")) {
                        // press the start button
                        MainGuiController.getController().getStartChatButton().fire();
                        sendStartStop();
                    }
                    if (message.startsWith("P")) {
                        // Rest is a JSON gtaj-browser blob
                        if (onMessageCallback != null) {
                            onMessageCallback.accept("taj-browser-data " + message.substring(1), false);
                        }
                    }
                } catch (RuntimeException e) {
                    e.printStackTrace();
                }
            }
        });
    }

    @Override
    public void onWebSocketClose(int statusCode, String reason)
    {
        super.onWebSocketClose(statusCode, reason);
        System.out.println("Socket Closed: [" + statusCode + "] " + reason);
        TeaseAI.getApplication().unregisterWebsocket();
    }

    @Override
    public void onWebSocketError(Throwable cause)
    {
        super.onWebSocketError(cause);
        cause.printStackTrace(System.err);
    }

    public void onMessage(BiConsumer<String, Boolean> callback) {
        this.onMessageCallback = callback;
    }

    synchronized public void sendMetronome(int bpm) {
        try {
            getRemote().sendString("M" + Integer.toString(bpm));
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    synchronized public void sendAudio(String uri, boolean wait) {
        try {
            if (uri == null) {
                uri = "";
            } else {
                uri = MediaServlet.getUrlFor(uri);
            }
            getRemote().sendString((wait ? "a" : "A") + uri);
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    synchronized public void sendVideo(String uri, boolean wait) {
        try {
            if (uri == null) {
                uri = "";
            } else {
                uri = MediaServlet.getUrlFor(uri);
            }
            getRemote().sendString((wait ? "v" : "V") + uri);
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    synchronized public void addOption(String optionName, String optionMessage) {
        try {
            if (optionName == null) {
                getRemote().sendString("o");
            } else {
                getRemote().sendString("O" + optionName + ";" + optionMessage);
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    synchronized public void sendCommand(String blob) {
        try {
            getRemote().sendString("J" + blob);
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}