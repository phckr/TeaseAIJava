package me.goddragon.teaseai.api.chat;

import javafx.collections.ListChangeListener;
import javafx.scene.Node;
import javafx.scene.control.ScrollPane;
import javafx.scene.paint.Color;
import javafx.scene.text.Font;
import javafx.scene.text.FontWeight;
import javafx.scene.text.Text;
import javafx.scene.text.TextFlow;
import me.goddragon.teaseai.TeaseAI;
import me.goddragon.teaseai.api.chat.response.Response;
import me.goddragon.teaseai.api.chat.response.ResponseHandler;
import me.goddragon.teaseai.api.scripts.personality.PersonalityManager;
import me.goddragon.teaseai.api.texttospeech.TTSVoicable;
import me.goddragon.teaseai.api.texttospeech.TextToSpeech;
import me.goddragon.teaseai.gui.http.EventSocket;
import me.goddragon.teaseai.utils.TeaseLogger;

import java.io.IOException;
import java.util.*;
import java.util.logging.Level;
import static org.apache.commons.lang.StringEscapeUtils.escapeHtml;

/**
 * Created by GodDragon on 22.03.2018.
 */
public class ChatHandler {

    public static final int SUB_SENDER_ID = 0;
    public static final int MAIN_DOM_SENDER_ID = 1;

    private static ChatHandler handler = new ChatHandler();

    private TypeSpeed typeSpeed = TypeSpeed.valueOf(TeaseAI.application.DEFAULT_TYPE_SPEED.getValue());

    private Color defaultChatColor = Color.BLACK;

    private Color dateColor;
    /**
     * Millis waited after each message by default
     */
    private long messagePauseMillis = 1000;

    /**
     * Millis waited after each message per character by default
     */
    private long perMessageCharacterPauseMillis = 100;

    /**
     * Is the default pause after each message calculated based on each message or one default value
     */
    private boolean pausePerMessageCharacter = true;

    private HashMap<Integer, ChatParticipant> senders = new HashMap<>();

    /**
     * Holds all messages that are only temporary displayed
     */
    private Collection<Text> temporaryMessages = new HashSet<>();

    private Answer currentCallback = null;

    private ChatParticipant currentDom = null;
    private TextToSpeech textToSpeech;

    public ChatHandler() {
        this.dateColor = Color.DARKGRAY;

        TextFlow textFlow = TeaseAI.application.getController().getChatWindow();
        ScrollPane textContainer = TeaseAI.application.getController().getChatScrollPane();
        textFlow.getChildren().addListener(
                (ListChangeListener<Node>) ((change) -> {
                    textFlow.layout();
                    textContainer.layout();
                    textContainer.setVvalue(1.0f);
                }));
        textContainer.setContent(textFlow);

        //Initial space in chat
        addText(new Text(" "));
        textToSpeech = new TextToSpeech();

        if(textToSpeech.getProvider() instanceof TTSVoicable) {
            ((TTSVoicable) textToSpeech.getProvider()).setVoice("dfki-prudence-hsmm");
        }
    }

    public void load() {
        PersonalityManager.getManager().getProgressUpdate().accept(0, 5);

        registerSender(new ChatParticipant(0, SenderType.SUB, new Contact("sub", "Sub Name")).setNameColor(Color.DARKCYAN));
        PersonalityManager.getManager().getProgressUpdate().accept(1, 5);

        Contact dommeContact = new Contact("dom", "Dom Name");
        registerSender(new ChatParticipant(1, SenderType.DOM, dommeContact).setNameColor(Color.RED));
        PersonalityManager.getManager().getProgressUpdate().accept(2, 5);

        registerSender(new ChatParticipant(2, SenderType.DOM, new Contact("dommeFriend1", "Emma")).setNameColor(Color.ORANGE));
        PersonalityManager.getManager().getProgressUpdate().accept(3, 5);

        registerSender(new ChatParticipant(3, SenderType.DOM, new Contact("dommeFriend2", "Staicy")).setNameColor(Color.LIGHTGREEN));
        PersonalityManager.getManager().getProgressUpdate().accept(4, 5);

        registerSender(new ChatParticipant(4, SenderType.DOM, new Contact("dommeFriend3", "Amara")).setNameColor(Color.MEDIUMVIOLETRED));
        PersonalityManager.getManager().getProgressUpdate().accept(5, 5);
    }

    public void registerSender(ChatParticipant chatSender) {
        senders.put(chatSender.getId(), chatSender);
    }

    public ChatParticipant getParticipantByName(String name) {
        for (ChatParticipant sender : senders.values()) {
            if (sender.getName().equalsIgnoreCase(name)) {
                return sender;
            }
        }

        throw new IllegalArgumentException("Chat participant with name " + name + " does not exist.");
    }

    public ChatParticipant getParticipantById(int id) {
        if (!senders.containsKey(id)) {
            TeaseLogger.getLogger().log(Level.SEVERE, "Chat participant with id " + id + " does not exist.");
            return null;
        }

        return senders.get(id);
    }

    public ChatParticipant getSubParticipant() {
        return getParticipantById(SUB_SENDER_ID);
    }

    public ChatParticipant getMainDomParticipant() {
        return getParticipantById(MAIN_DOM_SENDER_ID);
    }

    public ChatParticipant getSelectedSender() {
        return currentDom != null ? currentDom : getMainDomParticipant();
    }

    private void handleRemoteSubMessage(String message, boolean realMessage) {
        Collection<Response> responses = ResponseHandler.getHandler().checkMessageForResponse(message);

        if (!responses.isEmpty()) {
            for (Response response : responses) {
                //Set the message of the response so we know what triggered it later on
                response.setMessage(message);

                //Queue the response so we can call it later
                ResponseHandler.getHandler().addQueuedResponse(response);
            }
        }

        if (realMessage) {
            onSubMessage(message);
        } else {
            TeaseAI.application.setResponsesDisabled(false);

            if (currentCallback != null && currentCallback.getAnswer() == null) {
                //Wake the script thread, the user might want some response
                synchronized (TeaseAI.application.getScriptThread()) {
                    TeaseAI.application.getScriptThread().notify();
                }
            }
        }
    }

    private static String getWebColor(Color color) {
        return String.format("%02x%02x%02x",
                Math.round(color.getRed() * 255),
                Math.round(color.getGreen() * 255),
                Math.round(color.getBlue() * 255)
        );
    }

    private String escapeJson(String string) {
        return string.replaceAll("\"", "\\\\\"");
    }

    private String mergeText(Text[] text) {
        String result = "[";
        String sep = "";
        for (Text item : text) {
            result += sep;
            sep = ",";
            String piece = escapeHtml(item.getText());
            // Now add tags
            String fontStyle = item.getFont().getStyle();
            if (fontStyle == "italic") {
                piece = "<em>" + piece + "</em>";
            }
            piece = piece.replaceAll("(http(s)?://[^ <]+)", "<a target=\"_blank\" href=\"$1\">$1</a>");
            piece = String.format("{\"color\":\"%s\",\"text\":\"%s\"}", getWebColor((Color) item.getFill()), escapeJson(piece));
            result += piece;
        }

        result += "]";

        return result;
    }

    private void sendTextToWebsocket(boolean temporary, Text... text) {
        EventSocket websocket = TeaseAI.getWebsocket();

        if (websocket != null) {
            websocket.onMessage((String message, Boolean realMessage) -> { this.handleRemoteSubMessage(message, realMessage);});
            try {
                String message = mergeText(text);
                if (!temporary) {
                    websocket.sendText(message);
                } else {
                    websocket.sendTempText(message);
                }
            } catch (IOException e) {
                e.printStackTrace();
            }
        }
    }

    public void addText(String message) {
        addText(new Text(message));
    }

    public void addText(Text text) {
        addText(text, false);
    }

    public void addText(Text text, boolean temporary) {
        TextFlow textFlow = TeaseAI.application.getController().getChatWindow();

        TeaseAI.application.runOnUIThread(new Runnable() {
            @Override
            public void run() {
                if (!textFlow.getChildren().contains(text)) {
                    if (!temporary) {
                        removeAllTemporaryMessages();
                    }

                    textFlow.getChildren().add(text);

                    if (!temporary) {
                        addAllTemporaryMessages();
                    }
                } else {
                    TeaseLogger.getLogger().log(Level.SEVERE, "Tried to add same text instance multiple times.");
                }
            }
        });

        if (!temporary) {
            TeaseLogger.getLogger().log(Level.FINE, text.getText());
        }
        sendTextToWebsocket(temporary, text);
    }

    public void addText(Text... text) {
        TextFlow textFlow = TeaseAI.application.getController().getChatWindow();

        TeaseAI.application.runOnUIThread(new Runnable() {
            @Override
            public void run() {
                removeAllTemporaryMessages();

                textFlow.getChildren().addAll(text);

                addAllTemporaryMessages();
            }
        });

        String resultingText = "";
        for (Text textPiece : text) {
            resultingText += textPiece.getText();
        }

        sendTextToWebsocket(false, text);

        TeaseLogger.getLogger().log(Level.FINE, resultingText);
    }

    public void addLine(String message) {
        addLine(new Text(message));
    }

    public void addLine(Text text) {
        TextFlow textFlow = TeaseAI.application.getController().getChatWindow();

        TeaseAI.application.runOnUIThread(new Runnable() {
            @Override
            public void run() {
                if (!textFlow.getChildren().contains(text)) {
                    textToSpeech.preFetch(text.getText());
                    textToSpeech.speakFetched(text.getText(), 1.0f, false, true);
                    removeAllTemporaryMessages();
                    textFlow.getChildren().add(text);
                    nextRow();
                    addAllTemporaryMessages();
                } else {
                    TeaseLogger.getLogger().log(Level.SEVERE, "Tried to add same text instance multiple times.");
                }
            }
        });

        sendTextToWebsocket(false, text);
        TeaseLogger.getLogger().log(Level.FINE, text.getText());
    }

    public void addLine(Node... text) {
        addLine(Arrays.asList(text));
    }

    public void addLine(List<Node> text) {
        TextFlow textFlow = TeaseAI.application.getController().getChatWindow();

        TeaseAI.application.runOnUIThread(new Runnable() {
            @Override
            public void run() {
                removeAllTemporaryMessages();

                /*for (Text t: text)
                {
                    if (t.getText() != null)
                    {
                        textToSpeech.speak(t.getText(), 1.0f, false, false);
                    }
                }*/

                textFlow.getChildren().addAll(text);

                nextRow();

                addAllTemporaryMessages();
            }
        });

        String resultingText = "";
        List<Text> textList = new ArrayList<>();
        for (Node textPiece : text) {
            if(textPiece instanceof Text) {
                resultingText += ((Text) textPiece).getText();
                textList.add((Text) textPiece);
            }
        }

        sendTextToWebsocket(false, textList.toArray(new Text[textList.size()]));

        TeaseLogger.getLogger().log(Level.FINE, resultingText);
    }

    public void addTemporaryMessage(Text text) {
        addText(text, true);
        synchronized (temporaryMessages) {
            temporaryMessages.add(text);
        }
    }

    public void removeTemporaryMessage(Text text) {
        TeaseAI.application.runOnUIThread(new Runnable() {
            @Override
            public void run() {
                TeaseAI.application.getController().getChatWindow().getChildren().remove(text);
            }
        });

        synchronized (temporaryMessages) {
            temporaryMessages.remove(text);
        }
    }

    public void removeAllTemporaryMessages() {
        synchronized (temporaryMessages) {
            for (Text text : temporaryMessages) {
                TeaseAI.application.getController().getChatWindow().getChildren().remove(text);
            }
        }
    }

    public void addAllTemporaryMessages() {
        TextFlow textFlow = TeaseAI.application.getController().getChatWindow();

        synchronized (temporaryMessages) {
            for (Text text : temporaryMessages) {
                //Only add it if it is not yet existent
                if (!textFlow.getChildren().contains(text)) {
                    TeaseAI.application.getController().getChatWindow().getChildren().add(text);
                }
            }
        }
    }

    public void removeLatestLine() {
        removeLine(TeaseAI.application.getController().getChatWindow().getChildren().size() - 1);
    }

    public void removeLine(int index) {
        TextFlow textFlow = TeaseAI.application.getController().getChatWindow();

        if (index > textFlow.getChildren().size() - 1) {
            throw new IndexOutOfBoundsException("There are no " + (index + 1) + " rows of chat thus we were unable to remove the line.");
        }

        TeaseAI.application.runOnUIThread(new Runnable() {
            @Override
            public void run() {
                textFlow.getChildren().remove(index);
            }
        });
    }

    public void onSubMessage(String message) {
        TeaseAI.application.setResponsesDisabled(false);

        if (currentCallback != null && currentCallback.getAnswer() == null) {
            currentCallback.setAnswer(message);

            //Wake the script thread, the user might want some response
            synchronized (TeaseAI.application.getScriptThread()) {
                TeaseAI.application.getScriptThread().notify();
            }
        }
    }

    public long getMillisToPause(String message) {
        if (!pausePerMessageCharacter) {
            return messagePauseMillis;
        } else {
            return perMessageCharacterPauseMillis * message.trim().length();
        }
    }

    public Text getDefaultFormatText(String s) {
        Text text = new Text(s);
        text.setFont(Font.font(null, FontWeight.MEDIUM, TeaseAI.application.CHAT_TEXT_SIZE.getDouble()));
        text.setFill(ChatHandler.getHandler().getDefaultChatColor());
        return text;
    }

    public Collection<ChatParticipant> getParticipants() {
        return senders.values();
    }

    public Answer getCurrentCallback() {
        return currentCallback;
    }

    public TypeSpeed getTypeSpeed() {
        return typeSpeed;
    }

    public void setCurrentCallback(Answer currentCallback) {
        this.currentCallback = currentCallback;
    }

    public long getMessagePauseMillis() {
        return messagePauseMillis;
    }

    public void setMessagePauseMillis(long messagePauseMillis) {
        this.messagePauseMillis = messagePauseMillis;
    }

    public void setDefaultWaitSeconds(int seconds) {
        setMessagePauseMillis(seconds * 1000);
    }

    public long getPerMessageCharacterPauseMillis() {
        return perMessageCharacterPauseMillis;
    }

    public void setPerMessageCharacterPauseMillis(long perMessageCharacterPauseMillis) {
        this.perMessageCharacterPauseMillis = perMessageCharacterPauseMillis;
    }

    public void setPerMessageCharacterPauseSeconds(long perMessageCharacterPauseSeconds) {
        setPerMessageCharacterPauseMillis(perMessageCharacterPauseSeconds * 1000);
    }

    public boolean isPausePerMessageCharacter() {
        return pausePerMessageCharacter;
    }

    public void setPausePerMessageCharacter(boolean pausePerMessageCharacter) {
        this.pausePerMessageCharacter = pausePerMessageCharacter;
    }

    public void nextRow() {
        addText("\n ");
    }

    public ChatParticipant getCurrentDom() {
        return currentDom;
    }

    public void setCurrentDom(ChatParticipant currentDom) {
        this.currentDom = currentDom;
    }

    public static ChatHandler getHandler() {
        return handler;
    }

    public HashMap<Integer, ChatParticipant> getSenders() {
        return senders;
    }

    public Color getDefaultChatColor() {
        return defaultChatColor;
    }

    public Color getDateColor() {
        return dateColor;
    }

    public void setDateColor(Color newColor) {
        this.dateColor = newColor;
    }

    public void setDefaultChatColor(Color newColor) {
        this.defaultChatColor = newColor;
    }

    public TextToSpeech getTextToSpeech() {
        return textToSpeech;
    }

    public static void setHandler(ChatHandler handler) {
        ChatHandler.handler = handler;
    }

}
