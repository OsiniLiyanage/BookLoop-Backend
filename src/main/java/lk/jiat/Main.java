package lk.jiat;

import lk.jiat.config.AppConfig;
import lk.jiat.util.FirebaseUtil;
import org.apache.catalina.Context;
import org.apache.catalina.LifecycleException;
import org.apache.catalina.startup.Tomcat;
import org.glassfish.jersey.servlet.ServletContainer;

import java.io.File;

/*
 * Main.java — Entry point. Starts the embedded Tomcat server.
 *
 * HOW THIS WORKS (relates to your class notes on Application Lifecycle):
 *   1. Initialize Firebase Admin SDK first (so controllers can use Firestore)
 *   2. Create Tomcat server object, set port 8080
 *   3. Tell Tomcat where to find the HTML files (src/main/webapp)
 *   4. Register Jersey servlet to handle /api/v1/* routes
 *   5. Start Tomcat — now it's listening for requests
 *   6. tomcat.getServer().await() — keeps the process alive (like an infinite loop)
 *
 * ABOUT THE OLD ERROR:
 *   "bad class file: wrong version 61.0, should be 55.0"
 *   This means: Tomcat 11 was compiled WITH Java 17 (class version 61)
 *               But your Java compiler is set to Java 11 (class version 55)
 *   FIX: Downgraded Tomcat to 10.1.x in pom.xml — Tomcat 10.1 works with Java 11.
 */
public class Main {

    private static final String API_PATH   = "/api/v1";
    private static final int    SERVER_PORT = 8080;

    public static void main(String[] args) {

        // Step 1 — Initialize Firebase before anything else
        // If serviceAccountKey.json is missing, this throws with a clear message.
        System.out.println("Initializing Firebase...");
        FirebaseUtil.initialize();

        // Step 2 — Create Tomcat server
        Tomcat tomcat = new Tomcat();
        tomcat.setPort(SERVER_PORT);
        tomcat.getConnector();  // must call this or Tomcat won't bind to the port

        // Step 3 — Serve the admin dashboard HTML from the webapp folder
        // The "" means serve at root path "/"
        // new File("src/main/webapp") tells Tomcat where to find index.html
//        String webappPath = new File("src/main/webapp").getAbsolutePath();

        String webappPath = new File(System.getProperty("user.dir"), "src/main/webapp").getAbsolutePath();
        System.out.println("Serving webapp from: " + webappPath); // add this to verify

        Context context = tomcat.addWebapp("", webappPath);

        // Step 4 — Register Jersey servlet to handle REST API calls at /api/v1/*
        // AppConfig tells Jersey which controller classes to scan
        Tomcat.addServlet(context, "API_Servlet", new ServletContainer(new AppConfig()));
        context.addServletMappingDecoded(API_PATH + "/*", "API_Servlet");

        // Step 5 — Start and wait
        try {
            tomcat.start();
            System.out.println("=====================================");
            System.out.println("BookLoop Admin Panel is running!");
            System.out.println("Admin Dashboard: http://localhost:" + SERVER_PORT);
            System.out.println("API Base URL:    http://localhost:" + SERVER_PORT + API_PATH);
            System.out.println("=====================================");
            tomcat.getServer().await();
        } catch (LifecycleException e) {
            System.err.println(" Server failed to start: " + e.getMessage());
            throw new RuntimeException(e);
        }
    }
}