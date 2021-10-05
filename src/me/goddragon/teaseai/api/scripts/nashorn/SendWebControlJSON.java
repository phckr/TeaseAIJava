package me.goddragon.teaseai.api.scripts.nashorn;

import me.goddragon.teaseai.TeaseAI;
import me.goddragon.teaseai.gui.http.EventSocket;
import me.goddragon.teaseai.utils.TeaseLogger;

import java.util.logging.Level;

public class SendWebControlJSON extends CustomFunction {
    public SendWebControlJSON() {
        super("sendWebControlJson");
    }

    @Override
    public boolean isFunction() {
        return true;
    }

    @Override
    public Object call(Object object, Object... args) {
        super.call(object, args);

        if (args.length != 1) {
            TeaseLogger.getLogger().log(Level.SEVERE, "Called " + getFunctionName() + " method with incorrect number of parameters.");
            return null;
        }

        EventSocket websocket = TeaseAI.getWebsocket();
        if (websocket != null) {
            websocket.sendCommand(args[0].toString());
            return true;
        }

        return false;
    }
}
