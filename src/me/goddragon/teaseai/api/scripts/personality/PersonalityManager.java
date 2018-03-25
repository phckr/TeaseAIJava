package me.goddragon.teaseai.api.scripts.personality;

import me.goddragon.teaseai.utils.TeaseLogger;

import java.io.File;
import java.util.Collection;
import java.util.HashMap;
import java.util.logging.Level;

/**
 * Created by GodDragon on 25.03.2018.
 */
public class PersonalityManager {
    public static String PERSONALITY_FOLDER_NAME = "Personalities";

    private static PersonalityManager manager = new PersonalityManager();

    private final HashMap<String, Personality> personalities = new HashMap<>();

    public void loadPersonalities() {
        personalities.clear();

        File personalityFolder = new File(PERSONALITY_FOLDER_NAME);
        personalityFolder.mkdirs();

        for(File file : personalityFolder.listFiles()) {
            //Ignore all non directories
            if (file.isDirectory()) {
                File propertiesFile = new File(file.getAbsolutePath() + "\\" + Personality.PROPERTIES_NAME);

                if(propertiesFile.exists()) {
                    Personality personality = new Personality(file.getName());
                    addPersonality(personality);
                    TeaseLogger.getLogger().log(Level.INFO, "Personality '" + personality.getName() + "' version " + personality.getVersion() + " loaded.");
                } else {
                    TeaseLogger.getLogger().log(Level.WARNING, "Personality '" + file.getName() + "' is missing a properties file. Skipping loading.");
                }
            }
        }
    }

    public void addPersonality(Personality personality) {
        personalities.put(personality.getName().getValue(), personality);
    }

    public Personality getPersonality(String name) {
        if(!personalities.containsKey(name)) {
            TeaseLogger.getLogger().log(Level.SEVERE, "Personality with name '" + name + "' does not exist.");
        }

        return personalities.get(name);
    }

    public Collection<Personality> getPersonalities() {
        return personalities.values();
    }

    public static PersonalityManager getManager() {
        return manager;
    }

    public static void setManager(PersonalityManager manager) {
        PersonalityManager.manager = manager;
    }
}
