package me.goddragon.teaseai.gui.http;

import org.apache.commons.collections.map.LRUMap;
import org.apache.commons.io.IOUtils;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.*;
import java.net.URLDecoder;
import java.util.Collections;
import java.util.Map;

public class MediaServlet extends HttpServlet {
    private static final Map<String, String> urlMap = Collections.synchronizedMap(new LRUMap());

    public static String getUrlFor(String filename) {
        if (filename.startsWith("file:")) {
            filename = filename.substring(5);
            try {
                filename = URLDecoder.decode(filename, "utf-8");
            } catch (UnsupportedEncodingException e) {
                e.printStackTrace();
            }
        }
        // Get the last component of the filename
        String last = new File(filename).getName();
        String key = "/" + Integer.toHexString(filename.hashCode()) + "/" + last;
        urlMap.put(key, filename);

        return "/m" + key;
    }

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        String path = req.getPathInfo();
        System.out.println("Getting: " + path);
        if (!urlMap.containsKey(path)) {
            // return a 404
            resp.setStatus(404);
            return;
        }
        String fileName = urlMap.get(path);
        System.out.println("File: " + fileName);
        File file = new File(fileName);
        if (!file.isFile()) {
            resp.setStatus(404);
            return;
        }

        String contentType = getServletContext().getMimeType(fileName);
        if (contentType == null) {
            contentType = "application/octet-stream";
        }
        resp.reset();
        resp.setStatus(200);
        resp.setContentType(contentType);
        resp.setHeader("Cache-control", "public, max-age=10000");
        InputStream input = new FileInputStream(file);
        OutputStream output = resp.getOutputStream();
        IOUtils.copy(input, output);
    }
}
