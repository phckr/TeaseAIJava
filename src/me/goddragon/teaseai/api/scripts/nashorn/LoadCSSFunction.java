package me.goddragon.teaseai.api.scripts.nashorn;

import me.goddragon.teaseai.TeaseAI;
import me.goddragon.teaseai.api.scripts.ScriptHandler;
import me.goddragon.teaseai.utils.TeaseLogger;

import java.io.File;
import java.util.Arrays;
import java.util.logging.Level;

import javafx.scene.Scene;

/**
 * Created by Go-mei-sa on 15.06.2018.
 */
public class LoadCSSFunction extends CustomFunction {

    public LoadCSSFunction() {
        super("loadCSS");
    }

    @Override
    public boolean isFunction() {
        return true;
    }

    @Override
    public Object call(Object object, Object... args) {
        super.call(object, args);

        if(args.length == 1) {
            File cssFile = ScriptHandler.getHandler().getPersonnalityFile(args[0].toString());
            if (cssFile != null) {
            	Scene scene = TeaseAI.application.getScene();
            	scene.getStylesheets().clear();
            	scene.getStylesheets().add("file://" + cssFile.getAbsolutePath());
            }
            return null;
        }

        TeaseLogger.getLogger().log(Level.SEVERE, getFunctionName() + " called with invalid args:" + Arrays.asList(args).toString());
        return null;
    }
}