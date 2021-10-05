package me.goddragon.teaseai.api.chat;

import jdk.nashorn.api.scripting.JSObject;
import jdk.nashorn.api.scripting.ScriptObjectMirror;
import me.goddragon.teaseai.TeaseAI;
import me.goddragon.teaseai.gui.http.EventSocket;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Created by GodDragon on 23.03.2018.
 */
public class Answer {

    private long millisTimeout = 0;
    private String answer;
    private long startedAt;
    private boolean timeout = false;

    public Answer() {
    }

    public Answer(long timeoutSeconds) {
        this.millisTimeout = timeoutSeconds * 1000;
    }

    public void addOption(String optionMessage) {
        addOption(optionMessage, optionMessage);
    }

    private static void sendToWebsocket(String optionName, String optionMessage) {
        EventSocket websocket = TeaseAI.getWebsocket();
        if (websocket != null) {
            websocket.addOption(optionName, optionMessage);
        }
    }

    public static void addOption(String optionName, String optionMessage) {
        sendToWebsocket(optionName, optionMessage);
        TeaseAI.application.runOnUIThread(new Runnable() {
            @Override
            public void run() {
                TeaseAI.application.getController().getLazySubController().addButton(TeaseAI.application.getController().getLazySubController().createSendMessageButton(optionName, optionMessage));
            }
        });
    }

    public void clearOptions() {
        sendToWebsocket(null, null);
        TeaseAI.application.runOnUIThread(new Runnable() {
            @Override
            public void run() {
                TeaseAI.application.getController().getLazySubController().clear();
                TeaseAI.application.getController().getLazySubController().createDefaults();
            }
        });
    }

    public void loop() {
      loop(null);
    }

    public void loop(ScriptObjectMirror exitIf) {
        this.answer = null;
        this.timeout = false;

        TeaseAI.application.setResponsesDisabled(true);

        startedAt = System.currentTimeMillis();

        while (true) {
            long left = timeoutLeft();
            if (left < 0) {
                System.out.println("Answer-loop: timed out");
                break;
            }
            TeaseAI.application.waitPossibleScripThread(100);
            if (answer != null && answer.length() > 0) {
                System.out.println(String.format("Answer-loop: answer '%s'", answer));
                break;
            }
            if (TeaseAI.application.getSession() != null && TeaseAI.application.getSession().isStarted() && Thread.currentThread() == TeaseAI.application.getScriptThread()) {
                TeaseAI.application.getSession().checkForInteraction();
            }
            if (exitIf != null && exitIf.isFunction()) {
              Object result = exitIf.call(null);
              if (result != null && result instanceof Boolean) {
                if ((Boolean) result) {
                  break;
                }
              }
            }
        }

        checkTimeout();
    }

    public boolean matchesRegex(String regex) {
        Pattern p = Pattern.compile(regex);
        Matcher m = p.matcher(answer);
        return m.find();
    }

    public boolean matchesRegex(String... regexs) {
        for (String regex : regexs) {
            if (matchesRegex(regex)) {
                return true;
            }
        }

        return false;
    }

    public boolean matchesRegexLowerCase(String regex) {
        Pattern p = Pattern.compile(regex);
        Matcher m = p.matcher(answer.toLowerCase());
        return m.find();
    }

    public boolean matchesRegexLowerCase(String... regexs) {
        for (String regex : regexs) {
            if (matchesRegexLowerCase(regex)) {
                return true;
            }
        }

        return false;
    }


    public boolean contains(String string) {
        return answer != null && answer.contains(string);
    }

    public boolean contains(String... strings) {
        for (String string : strings) {
            if (contains(string)) {
                return true;
            }
        }

        return false;
    }

    public boolean isLike(String string) {
        return containsIgnoreCase(string);
    }


    public boolean isLike(String... strings) {
        return containsIgnoreCase(strings);
    }

    public boolean containsIgnoreCase(String string) {
        return answer != null && answer.toLowerCase().contains(string.toLowerCase());
    }

    public boolean containsIgnoreCase(String... strings) {
        for (String string : strings) {
            if (containsIgnoreCase(string)) {
                return true;
            }
        }

        return false;
    }

    public boolean isInteger() {
        try {
            Integer.parseInt(answer);
            return true;
        } catch (NumberFormatException ex) {
        }

        return false;
    }

    public boolean isInt() {
        try {
            Integer.parseInt(answer);
            return true;
        } catch (NumberFormatException ex) {
        }

        return false;
    }

    public boolean isDouble() {
        try {
            Double.parseDouble(answer);
            return true;
        } catch (NumberFormatException ex) {
        }

        return false;
    }

    public int getInteger() {
        return getInt();
    }

    public int getInt() {
        try {
            return Integer.parseInt(answer);
        } catch (NumberFormatException ex) {
        }

        return 0;
    }

    public double getDouble() {
        try {
            return Double.parseDouble(answer);
        } catch (NumberFormatException ex) {
        }

        return 0;
    }

    public long getMillisTimeout() {
        return millisTimeout;
    }

    public void setTimeoutSeconds(long timeoutSeconds) {
        this.millisTimeout = timeoutSeconds * 1000;
    }

    public void setMillisTimeout(long millisTimeout) {
        this.millisTimeout = millisTimeout;
    }

    public String getAnswer() {
        return answer;
    }

    public void setAnswer(String answer) {
        this.answer = answer;
    }

    public void setStartedAt(long startedAt) {
        this.startedAt = startedAt;
    }

    private long timeoutLeft() {
        if (millisTimeout > 0) {
            long left = millisTimeout - (System.currentTimeMillis() - startedAt);
            if (left > 0) {
                return left;
            }
            return -1;
        }

        return millisTimeout;
    }

    public void checkTimeout() {
        if (System.currentTimeMillis() - startedAt >= millisTimeout - 100 && millisTimeout > 0) {
            timeout = true;
        }
    }

    public boolean isTimeout() {
        return timeout;
    }

    public void setTimeout(boolean timeout) {
        this.timeout = timeout;
    }
}
