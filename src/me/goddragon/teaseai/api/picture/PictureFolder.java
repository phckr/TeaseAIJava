package me.goddragon.teaseai.api.picture;

import me.goddragon.teaseai.utils.FileUtils;

import java.io.File;
import java.util.*;

/**
 * This represents a folder which actually contains pictures.
 */
public class PictureFolder {
    private static List<PictureFolder> allPictureFolders;

    private File directory;
    private int seenImages;
    private TagsFile tagsFile;
    private static Random random = new Random();

    public PictureFolder(File dir, int seenImages, TagsFile tagsFile) {
        this.directory = dir;
        this.seenImages = seenImages;
        this.tagsFile = tagsFile;
    }

    public static PictureFolder getRandomPictureFolderUntagged() {
        List<Integer> counts = new ArrayList<>();
        int total = 0;
        for (PictureFolder folder : getAllPictureFolders()) {
            int count = folder.getUntaggedImageCount();
            counts.add(count);
            total += count;
        }
        int index = random.nextInt(total);
        for (int i = 0; i < counts.size(); i++) {
            index -= counts.get(i);
            if (index < 0) {
                return allPictureFolders.get(i);
            }
        }

        return null;
    }

    private static boolean isFileAnImage(File f) {
        String name = f.getName().toLowerCase();

        return name.endsWith(".jpg") || name.endsWith(".png") || name.endsWith(".webp") || name.endsWith(".gif");
    }

    public int getTaggedImageCount() {
        if (this.tagsFile != null) {
            return this.tagsFile.getTaggedFiles().size();
        }
        return 0;
    }

    public int getUntaggedImageCount() {
        return this.seenImages - getTaggedImageCount();
    }

    public TaggedPicture getRandomUntaggedPicture() {
        Set<File> images = new HashSet<>(Arrays.asList(this.directory.listFiles(PictureFolder::isFileAnImage)));
        if (this.tagsFile != null) {
            for (File taggedFile : this.tagsFile.getTaggedFiles()) {
                images.remove(taggedFile);
            }
        }

        if (images.isEmpty()) {
            return null;
        }

        int item = random.nextInt(images.size());
        for (File untaggedFile : images) {
            if (item-- == 0) {
                return new TaggedPicture(untaggedFile, true);
            }
        }

        return null;
    }

    static public TaggedPicture getRandomUntaggedPictureAcrossAll() {
        PictureFolder f = getRandomPictureFolderUntagged();
        if (f != null) {
            return f.getRandomUntaggedPicture();
        }
        return null;
    }

    public static List<PictureFolder> getAllPictureFolders() {
        if (allPictureFolders == null) {
            allPictureFolders = new ArrayList<>();
            loadAllPictureFolders(new File(FileUtils.getTAJPath() + File.separator + "Images" + File.separator + "System"), true);
            loadAllPictureFolders(new File(FileUtils.getTAJPath() + File.separator + "Images"), false);
        }
        return allPictureFolders;
    }

    private static void loadAllPictureFolders(File dir, boolean allFolders) {
        int seenImages = 0;
        File seenTagsFile = null;
        for (File entry : dir.listFiles()) {
            String name = entry.getName().toLowerCase();
            if (name.endsWith(".jpg") || name.endsWith(".png") || name.endsWith(".webp") || name.endsWith(".gif")) {
                seenImages++;
            }
            if (entry.isDirectory()) {
                 loadAllPictureFolders(entry, allFolders);
            }
            if (name.equals("imagetags.txt")) {
                seenTagsFile = entry;
            }
        }
        if (seenImages > 0 && (allFolders || seenTagsFile != null)) {
            // Do we already have this one?
            for (PictureFolder old : allPictureFolders) {
                if (old.isSameDirectory(dir)) {
                    return;
                }
            }
            TagsFile tagsFile = null;
            if (seenTagsFile != null) {
                tagsFile = new TagsFile(seenTagsFile);
            }
            allPictureFolders.add(new PictureFolder(dir, seenImages, tagsFile));
        }
    }

    private boolean isSameDirectory(File dir) {
        return this.directory.equals(dir);
    }

    public int getSeenImages() {
        return this.seenImages;
    }
}
