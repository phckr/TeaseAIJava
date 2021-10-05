package me.goddragon.teaseai.api.scripts.nashorn;

import me.goddragon.teaseai.gui.http.MediaServlet;
import me.goddragon.teaseai.utils.FileUtils;
import me.goddragon.teaseai.utils.TeaseLogger;

import java.io.File;
import java.util.Arrays;
import java.util.logging.Level;

public class AllocateTempUrlFunction extends CustomFunction {

    public AllocateTempUrlFunction() {
        super("allocateTempUrl");
    }

    @Override
    public boolean isFunction() {
        return true;
    }

    @Override
    public Object call(Object object, Object... args) {
        super.call(object, args);

        switch (args.length) {
            case 1:
                return MediaServlet.getUrlFor(FileUtils.getRandomMatchingFile(args[0].toString()).toString());
        }
        TeaseLogger.getLogger().log(Level.SEVERE, getFunctionName() + " called with invalid args:" + Arrays.asList(args).toString());
        return null;
    }
}
